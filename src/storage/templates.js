import { dbp } from './db';
import { PRESETS } from '../templates/presets';
import { newId } from '../model/defaults';

export async function listTemplates() {
  const db = await dbp;
  let all = await db.getAll('templates');
  if (!all.length) {
    const tx = db.transaction('templates', 'readwrite');
    await Promise.all(PRESETS.map((t) => tx.store.put(t)));
    await tx.done;
    all = PRESETS;
  }
  return all.sort((a, b) => (b.isDefault - a.isDefault) || a.name.localeCompare(b.name));
}

export async function getTemplate(id) {
  return (await dbp).get('templates', id);
}

export async function defaultTemplate() {
  const all = await listTemplates();
  return all.find((t) => t.isDefault) || all[0] || null;
}

export async function saveTemplate(t) {
  await (await dbp).put('templates', t);
  return t;
}

export async function setDefaultTemplate(id) {
  const db = await dbp;
  const all = await db.getAll('templates');
  const tx = db.transaction('templates', 'readwrite');
  await Promise.all(all.map((t) => tx.store.put({ ...t, isDefault: t.id === id })));
  await tx.done;
}

export async function deleteTemplate(id) {
  const db = await dbp;
  const t = await db.get('templates', id);
  await db.delete('templates', id);
  if (t?.isDefault) {
    const rest = await db.getAll('templates');
    if (rest[0]) await db.put('templates', { ...rest[0], isDefault: true });
  }
}

export function copyTemplate(t) {
  return { ...structuredClone(t), id: newId(), name: `${t.name} (copy)`, isDefault: false };
}
