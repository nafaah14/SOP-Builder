import { STYLE, lineH, baseline, plainLines, textBox, mix } from './text';

/**
 * A table as paginator rows: one row per table row, never split, header row
 * glued to the first body row and repeated at the top of every page the
 * table continues onto.
 *
 * columns: [{ label, w (fraction of width), align?: 'left'|'center'|'right', bold? }]
 * cells:   [[string]]  (rows)
 * style:   'grid' (ruled cells, tinted header) | 'lines' (horizontal rules only)
 * opts.minRowH: minimum body row height in mm (signature rows want room)
 */
const PAD_X = 2;
const PAD_Y = 1.6;

function rowFrom(cells, { columns, width, measure, size, bold, fill, style, minH, color, lineColor }) {
  const xs = [];
  let x = 0;
  for (const c of columns) {
    xs.push(x);
    x += c.w * width;
  }
  const lh = lineH(size);
  const cellLines = columns.map((c, i) =>
    plainLines(String(cells[i] ?? ''), c.w * width - PAD_X * 2, measure, size, { bold: bold || c.bold }));
  const h = Math.max(minH || 0, Math.max(...cellLines.map((l) => l.length)) * lh + PAD_Y * 2);

  const boxes = [];
  if (fill) boxes.push({ t: 'rect', x: 0, y: 0, w: width, h, fill });
  cellLines.forEach((lines, i) => {
    const c = columns[i];
    const cw = c.w * width;
    lines.forEach((ln, li) => {
      for (const r of ln.runs) {
        let tx = xs[i] + PAD_X + r.x;
        if (c.align === 'center') tx += (cw - PAD_X * 2 - ln.width) / 2;
        else if (c.align === 'right') tx += cw - PAD_X * 2 - ln.width;
        boxes.push(textBox(tx, PAD_Y + li * lh + baseline(size), r.text, size, color, { bold: r.bold }));
      }
    });
  });
  if (style === 'grid') {
    columns.forEach((c, i) => boxes.push({ t: 'rect', x: xs[i], y: 0, w: c.w * width, h, stroke: lineColor, lw: 0.25 }));
  } else {
    boxes.push({ t: 'line', x1: 0, y1: h, x2: width, y2: h, color: lineColor, lw: 0.25 });
  }
  return { h, boxes };
}

export function tableRows({ columns, cells, width, measure, accent, style = 'grid', size = STYLE.tableSize, minRowH = 0, blockId, gapFirst = 0 }) {
  const lineColor = style === 'grid' ? '#9AA3AE' : STYLE.rule;
  const headerFill = style === 'grid' ? mix(accent, '#ffffff', 0.88) : null;
  const header = rowFrom(columns.map((c) => c.label), {
    columns, width, measure, size, bold: true, fill: headerFill, style, color: style === 'grid' ? STYLE.ink : accent, lineColor,
  });
  if (style === 'lines') header.boxes.push({ t: 'line', x1: 0, y1: header.h, x2: width, y2: header.h, color: accent, lw: 0.5 });
  const headerRow = { blockId, h: header.h, gap: 0, glue: true, boxes: header.boxes };

  const body = cells.map((cs) => {
    const r = rowFrom(cs, { columns, width, measure, size, style, minH: minRowH, color: STYLE.ink, lineColor });
    return { blockId, h: r.h, gap: 0, glue: false, boxes: r.boxes, repeat: headerRow };
  });
  return [{ ...headerRow, gap: gapFirst, glue: body.length > 0 }, ...body];
}

/** Two-column label/value table without a header row — the cover's document details. */
export function detailRows({ pairs, width, measure, accent, style = 'grid', size = STYLE.tableSize + 0.5 }) {
  const columns = [{ w: 0.32, bold: true }, { w: 0.68 }];
  const lineColor = style === 'grid' ? '#9AA3AE' : STYLE.rule;
  const fill = style === 'grid' ? mix(accent, '#ffffff', 0.92) : null;
  return pairs.map(([k, v]) => {
    const r = rowFrom([k, v], { columns, width, measure, size, style, color: STYLE.ink, lineColor });
    if (fill) r.boxes.unshift({ t: 'rect', x: 0, y: 0, w: width * 0.32, h: r.h, fill });
    return { h: r.h, gap: 0, glue: true, boxes: r.boxes };
  });
}
