import { fontFile } from '../layout/fonts';

/**
 * Everything an export needs beyond the layout itself, fetched only when the
 * document actually uses it: embedded font files (each style separately)
 * and photos stored outside the document.
 */
const fontP = new Map();

const toBase64 = async (blob) => {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
};

function loadFont(key) {
  if (!fontP.has(key)) {
    const [fam, st] = key.split(':');
    const p = fetch(fontFile(fam, st))
      .then((r) => {
        if (!r.ok) throw new Error(`font ${key}: ${r.status}`);
        return r.blob();
      })
      .then(toBase64)
      .catch((e) => { fontP.delete(key); throw e; });
    fontP.set(key, p);
  }
  return fontP.get(key);
}

export async function exportAssets(result, { loadImage } = {}) {
  const assets = {};
  if (result.fontFiles?.length) {
    assets.fonts = Object.fromEntries(await Promise.all(result.fontFiles.map(async (k) => [k, await loadFont(k)])));
  }
  const ids = new Set();
  for (const p of result.pages) for (const b of p.boxes) if (b.t === 'image' && b.imageId) ids.add(b.imageId);
  if (ids.size && loadImage) {
    assets.images = {};
    await Promise.all([...ids].map(async (id) => { assets.images[id] = await loadImage(id); }));
  }
  return assets;
}
