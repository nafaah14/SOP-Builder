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
  return out;
}

/** Index range [start, end) of a section and everything under it, up to the next section. */
export function sectionRange(blocks, index) {
  let end = index + 1;
  while (end < blocks.length && blocks[end].kind !== 'section') end += 1;
  return [index, end];
}
