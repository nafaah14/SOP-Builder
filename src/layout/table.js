import { STYLE, lineH, baseline, textBox, mix } from './text';
import { parseInline, wrapRuns } from './rich';

/**
 * A table as paginator rows: one row per table row, never split, header row
 * glued to the first body row and repeated at the top of every page the
 * table continues onto.
 *
 * columns: [{ label, w (relative weight), align?: 'left'|'center'|'right', bold? }]
 * cells:   [[string]]  (rows)
 * style:   'grid' (ruled cells, tinted header) | 'lines' (horizontal rules only)
 * opts.minRowH: minimum body row height in mm (signature rows want room)
 */
const PAD_X = 2;
const PAD_Y = 1.6;

/** Cell text keeps line breaks and **bold** / *italic*; a bold column or header row forces bold. */
function cellText(text, width, measure, size, bold) {
  return text.split('\n').flatMap((line) => {
    const runs = parseInline(line).map((r) => (bold ? { ...r, bold: true } : r));
    return wrapRuns(runs.length ? runs : [{ text: '', bold, italic: false }], width, measure, size);
  });
}

function rowFrom(cells, { columns, width, measure, size, bold, fill, style, minH, color, lineColor }) {
  const total = columns.reduce((a, c) => a + c.w, 0) || 1;
  columns = columns.map((c) => ({ ...c, w: c.w / total }));
  const xs = [];
  let x = 0;
  for (const c of columns) {
    xs.push(x);
    x += c.w * width;
  }
  const lh = lineH(size);
  const cellLines = columns.map((c, i) => cellText(String(cells[i] ?? ''), c.w * width - PAD_X * 2, measure, size, bold || c.bold));
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
        boxes.push(textBox(tx, PAD_Y + li * lh + baseline(size), r.text, size, color, r));
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

export function tableRows({
  columns, cells, width, measure, accent, style = 'grid', size = STYLE.tableSize, minRowH = 0, blockId, gapFirst = 0,
  headerRow = true, striped = false,
}) {
  const lineColor = style === 'grid' ? '#9AA3AE' : STYLE.rule;
  const headerFill = style === 'grid' ? mix(accent, '#ffffff', 0.88) : null;
  const header = rowFrom(columns.map((c) => c.label), {
    columns, width, measure, size, bold: true, fill: headerFill, style, color: style === 'grid' ? STYLE.ink : accent, lineColor,
  });
  if (style === 'lines') header.boxes.push({ t: 'line', x1: 0, y1: header.h, x2: width, y2: header.h, color: accent, lw: 0.5 });
  const head = { blockId, h: header.h, gap: 0, glue: true, boxes: header.boxes };

  const stripe = mix(accent, '#ffffff', 0.95);
  const body = cells.map((cs, i) => {
    const r = rowFrom(cs, { columns, width, measure, size, style, minH: minRowH, color: STYLE.ink, lineColor, fill: striped && i % 2 ? stripe : null });
    return { blockId, h: r.h, gap: 0, glue: false, boxes: r.boxes, repeat: headerRow ? head : undefined };
  });
  if (!headerRow) {
    // without a header the top rule of the first row has to come from somewhere
    if (body[0] && style === 'lines') body[0].boxes.push({ t: 'line', x1: 0, y1: 0, x2: width, y2: 0, color: accent, lw: 0.5 });
    return body.map((r, i) => (i === 0 ? { ...r, gap: gapFirst } : r));
  }
  return [{ ...head, gap: gapFirst, glue: body.length > 0 }, ...body];
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
