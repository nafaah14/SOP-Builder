import { STYLE, lineH, baseline, plainLines, textBox, headingRows } from './text';

/** Contents entries from the body's layout: [{ level, number, title, page, bid }]. */
export function tocEntries(doc, numbers, blockPages, depth, offset) {
  const out = [];
  for (const b of doc.blocks) {
    if (b.kind === 'section') {
      out.push({ level: 1, number: numbers[b.id], title: b.title || 'Untitled section', bid: b.id });
    } else if (b.kind === 'step' && depth >= 2) {
      const title = b.title?.trim() || (b.body || '').split('\n').find((l) => l.trim())?.replace(/[*]/g, '').trim();
      out.push({ level: 2, number: numbers[b.id], title: title || 'Step', bid: b.id });
    } else {
      continue;
    }
    const meta = blockPages[b.id];
    out[out.length - 1].page = meta ? meta.startPage + offset : '';
  }
  return out;
}

export function tocRows(entries, { width, measure, accent }) {
  const rows = headingRows('Contents', { width, measure, accent, blockId: '__toc' });
  const pageW = 12;
  entries.forEach((e, i) => {
    const top = e.level === 1;
    const size = top ? 10 : 9.5;
    const numX = top ? 0 : STYLE.indent;
    const titleX = numX + (top ? STYLE.indent : 13);
    const lines = plainLines(e.title, width - titleX - pageW - 4, measure, size, { bold: top });
    const lh = lineH(size);
    const boxes = [textBox(numX, baseline(size), e.number, size, top ? accent : STYLE.muted, { bold: top })];
    lines.forEach((ln, li) => {
      for (const r of ln.runs) boxes.push(textBox(titleX + r.x, li * lh + baseline(size), r.text, size, STYLE.ink, { bold: top }));
    });
    const lastY = (lines.length - 1) * lh + baseline(size);
    const pageText = String(e.page);
    const pw = measure.width(pageText, { size, bold: top });
    boxes.push(textBox(width - pw, lastY, pageText, size, STYLE.ink, { bold: top }));
    const from = titleX + (lines[lines.length - 1]?.width || 0) + 2;
    const to = width - pw - 2;
    const unit = measure.width(' .', { size: 8 });
    const n = Math.floor((to - from) / unit);
    // right-aligned so the leaders line up into a column
    if (n > 1) boxes.push(textBox(to - n * unit, lastY, ' .'.repeat(n), 8, STYLE.muted));
    const h = lines.length * lh;
    boxes.push({ t: 'link', x: 0, y: 0, w: width, h, page: e.page });
    rows.push({ blockId: '__toc', h, gap: i === 0 ? 2 : top ? 3 : 0.8, glue: false, boxes });
  });
  return rows;
}
