/**
 * Section and step numbers are never stored — they're derived from order, so
 * reordering can't leave a stale "3.2" behind. Steps before any section are
 * numbered 1, 2, 3; steps under section N are N.1, N.2.
 */
export function computeNumbers(blocks) {
  const out = {};
  let section = 0;
  let step = 0;
  for (const b of blocks) {
    if (b.kind === 'section') {
      section += 1;
      step = 0;
      out[b.id] = String(section);
    } else if (b.kind === 'step') {
      step += 1;
      out[b.id] = section ? `${section}.${step}` : String(step);
    }
  }
  // captioned tables and photos are numbered through the whole document: "Table 1", "Figure 1"
  let table = 0;
  let figure = 0;
  for (const b of blocks) {
    if (b.kind === 'table' && b.caption?.trim()) out[b.id] = `Table ${++table}`;
    if (b.kind === 'image' && b.caption?.trim()) out[b.id] = `Figure ${++figure}`;
  }
  return out;
}

/** Kinds that sit inside the step above them, indented to its text. */
export const ATTACHABLE = new Set(['table', 'callout', 'image', 'pageBreak']);

/**
 * blockId -> stepId for tables, callouts and photos that follow a step with nothing
 * but other tables, callouts or page breaks in between. They're laid out at
 * the step's indent, so a warning placed after step 2.3 visibly belongs to it.
 */
export function attachments(blocks) {
  const out = {};
  let step = null;
  for (const b of blocks) {
    if (b.kind === 'step') step = b.id;
    else if (!ATTACHABLE.has(b.kind)) step = null;
    else if (step && b.kind !== 'pageBreak') out[b.id] = step;
  }
  return out;
}

/** Index range [start, end) of a section and everything under it, up to the next section. */
export function sectionRange(blocks, index) {
  let end = index + 1;
  while (end < blocks.length && blocks[end].kind !== 'section') end += 1;
  return [index, end];
}
