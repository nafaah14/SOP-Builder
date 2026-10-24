import { useEffect, useState } from 'react';
import { dbp } from './db';
import { newId } from '../model/defaults';

/**
 * Photos are stored once, as JPEG blobs keyed by id, and never changed —
 * an edit (step 5) writes a new image. A block only holds { imageId, w, h },
 * so documents stay small and copies of an SOP share their photos.
 */
export async function putImage({ blob, w, h }) {
  const id = newId();
  await (await dbp).put('images', { id, blob, w, h, type: blob.type, createdAt: new Date().toISOString() });
  return id;
}

export async function getImage(id) {
  return (await dbp).get('images', id);
}

export async function imageDataUrl(id) {
  const rec = await getImage(id);
  if (!rec) throw new Error(`Photo ${id} is missing on this device`);
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(rec.blob);
  });
}

const urls = new Map();

/** An object URL for a stored photo, shared across every place it's shown. */
export function useImageUrl(id) {
  const [, loaded] = useState(0);
  useEffect(() => {
    if (!id || urls.has(id)) return undefined;
    let live = true;
    getImage(id).then((rec) => {
      if (!rec) return;
      if (!urls.has(id)) urls.set(id, URL.createObjectURL(rec.blob));
      if (live) loaded((n) => n + 1);
    });
    return () => { live = false; };
  }, [id]);
  return (id && urls.get(id)) || null;
}
