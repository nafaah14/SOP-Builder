import { openDB } from 'idb';

/**
 * Local-first: every SOP lives in IndexedDB on this device, so the editor is
 * instant and works offline. Drive sync (a later phase) layers on top of this
 * rather than replacing it.
 */
const dbp = openDB('sop-builder', 1, {
  upgrade(db) {
    db.createObjectStore('docs', { keyPath: 'id' });
  },
});

export async function listDocs() {
  const all = await (await dbp).getAll('docs');
  return all.filter((d) => !d.deletedAt).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getDoc(id) {
  return (await dbp).get('docs', id);
}

export async function saveDoc(doc) {
  const stored = { ...doc, updatedAt: new Date().toISOString() };
  await (await dbp).put('docs', stored);
  return stored;
}

export async function softDeleteDoc(id) {
  const db = await dbp;
  const doc = await db.get('docs', id);
  if (doc) await db.put('docs', { ...doc, deletedAt: new Date().toISOString() });
}

export async function restoreDoc(id) {
  const db = await dbp;
  const doc = await db.get('docs', id);
  if (doc) await db.put('docs', { ...doc, deletedAt: null });
}
