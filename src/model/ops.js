import { cloneBlock, newBlock } from './defaults';
import { sectionRange } from './numbering';

/** Pure document operations. Every edit goes through one of these, so undo is just snapshots. */

const withBlocks = (doc, blocks) => ({ ...doc, blocks });

export function insertBlock(doc, index, kindOrBlock) {
  const block = typeof kindOrBlock === 'string' ? newBlock(kindOrBlock) : kindOrBlock;
  const blocks = [...doc.blocks];
  blocks.splice(index, 0, block);
  return [withBlocks(doc, blocks), block];
}

export function updateBlock(doc, id, patch) {
  return withBlocks(doc, doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
}

export function removeBlock(doc, id) {
  return withBlocks(doc, doc.blocks.filter((b) => b.id !== id));
}

export function duplicateBlock(doc, id) {
  const i = doc.blocks.findIndex((b) => b.id === id);
  if (i < 0) return [doc, null];
  const copy = cloneBlock(doc.blocks[i]);
  const blocks = [...doc.blocks];
  blocks.splice(i + 1, 0, copy);
  return [withBlocks(doc, blocks), copy];
}

/** Move one block by `delta` positions (−1 up, +1 down). */
export function nudgeBlock(doc, id, delta) {
  const i = doc.blocks.findIndex((b) => b.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= doc.blocks.length) return doc;
  return moveBlock(doc, i, j);
}

export function moveBlock(doc, from, to) {
  if (from === to) return doc;
  const blocks = [...doc.blocks];
  const [b] = blocks.splice(from, 1);
  blocks.splice(to, 0, b);
  return withBlocks(doc, blocks);
}

/**
 * Move a section together with everything under it so it lands before the
 * block `beforeId` (or at the end when null). Used by the outline, where
 * dragging "3 Maintenance" should carry its steps along.
 */
export function moveSection(doc, sectionId, beforeId) {
  const i = doc.blocks.findIndex((b) => b.id === sectionId);
  if (i < 0) return doc;
  const [start, end] = sectionRange(doc.blocks, i);
  const group = doc.blocks.slice(start, end);
  if (beforeId && group.some((b) => b.id === beforeId)) return doc;
  const rest = [...doc.blocks.slice(0, start), ...doc.blocks.slice(end)];
  const at = beforeId ? rest.findIndex((b) => b.id === beforeId) : rest.length;
  rest.splice(at < 0 ? rest.length : at, 0, ...group);
  return withBlocks(doc, rest);
}

/** Put a removed block back at its old index — the undo toast's action. */
export function restoreBlock(doc, block, index) {
  const blocks = [...doc.blocks];
  blocks.splice(Math.min(index, blocks.length), 0, block);
  return withBlocks(doc, blocks);
}

/** Revision rows drive the document's current revision: the last row is "now". */
export function setRevisions(doc, revisions) {
  const last = revisions[revisions.length - 1];
  return {
    ...doc,
    revisions,
    ...(last ? { revision: last.rev, effectiveDate: last.date || doc.effectiveDate } : {}),
  };
}

export function nextRev(rev) {
  const s = String(rev ?? '').trim();
  if (/^\d+$/.test(s)) return String(Number(s) + 1);
  if (/^[A-Y]$/i.test(s)) return String.fromCharCode(s.charCodeAt(0) + 1);
  return '';
}

/**
 * Put photos into the document: the first fills `into` (an existing photo
 * block) if given, the rest become new photo blocks after it — or after
 * `after`, or at the end.
 */
export function placePhotos(doc, photos, { into = null, after = null } = {}) {
  let d = doc;
  let queue = photos;
  let anchor = after;
  if (into && queue.length) {
    const [first, ...rest] = queue;
    d = updateBlock(d, into, first);
    queue = rest;
    anchor = into;
  }
  let at = anchor ? d.blocks.findIndex((b) => b.id === anchor) + 1 : d.blocks.length;
  if (at <= 0) at = d.blocks.length;
  for (const p of queue) {
    [d] = insertBlock(d, at, { ...newBlock('image'), ...p });
    at += 1;
  }
  return d;
}
