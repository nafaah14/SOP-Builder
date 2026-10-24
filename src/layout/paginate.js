import { shiftBox } from './text';

/**
 * Rows in, pages out. A row is one unbreakable strip with a `gap` above it
 * (dropped at the top of a page) and `glue` ("never break after me").
 * Keep-with-next and widow/orphan control are expressed as glue, so this
 * stays small. A row may carry `repeat`: a header row to re-place first
 * whenever the row lands at the top of a new page — table headers.
 *
 * Page numbers in the result are local to this flow (1-based); the engine
 * offsets them once it knows what comes before.
 */

function chunkRows(rows) {
  const chunks = [];
  let cur = [];
  for (const r of rows) {
    if (r.forceBreak && cur.length) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(r);
    if (!r.glue) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

const chunkHeight = (chunk, atTop) =>
  chunk.reduce((s, r, i) => s + r.h + (i === 0 && atTop ? 0 : r.gap), 0) + (atTop && chunk[0].repeat ? chunk[0].repeat.h : 0);

export function paginate(rows, { left, top, height }) {
  const pages = [{ boxes: [] }];
  const blocks = {};
  let y = 0;

  const newPage = () => {
    pages.push({ boxes: [] });
    y = 0;
  };
  const place = (row) => {
    if (y === 0 && row.repeat) place({ ...row.repeat, gap: 0, blockId: row.blockId });
    if (y > 0) y += row.gap;
    const page = pages[pages.length - 1];
    for (const b of row.boxes) page.boxes.push({ ...shiftBox(b, left, top + y), bid: row.blockId });
    const p = pages.length;
    if (row.blockId) {
      const meta = blocks[row.blockId] || (blocks[row.blockId] = { startPage: p, endPage: p });
      meta.endPage = p;
    }
    y += row.h;
  };

  for (const chunk of chunkRows(rows)) {
    if (chunk[0].forceBreak && y > 0) newPage();
    if (y > 0 && y + chunkHeight(chunk, false) > height) newPage();
    if (chunkHeight(chunk, y === 0) <= height - y) {
      chunk.forEach(place);
    } else {
      // taller than a whole page: glue has to give somewhere
      for (const row of chunk) {
        if (y > 0 && y + row.gap + row.h > height) newPage();
        place(row);
      }
    }
  }
  // a page break with nothing after it shouldn't leave a blank last page
  if (pages.length > 1 && !pages[pages.length - 1].boxes.length) pages.pop();
  const n = pages.length;
  for (const m of Object.values(blocks)) {
    m.startPage = Math.min(m.startPage, n);
    m.endPage = Math.min(m.endPage, n);
  }
  return { pages, blocks };
}
