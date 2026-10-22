import { dbp } from './db';
import { migrate } from '../model/migrate';

/**
 * Local-first: every SOP lives in IndexedDB on this device, so the editor is
 * instant and works offline. Drive sync (a later phase) layers on top of this
 * rather than replacing it.
 */
export async function listDocs() {
  const all = await (await dbp).getAll('docs');
  return all.map(migrate).filter((d) => !d.deletedAt).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getDoc(id) {
  return migrate(await (await dbp).get('docs', id));
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
