import { CALLOUTS } from '../model/defaults';
import { STYLE, lineH, baseline, bodyRows, textBox, mix, plainLines } from './text';

/**
 * Danger / Warning / Caution / Note / Tip boxes. Each line is its own row
 * carrying its slice of the tinted background and coloured bar, so a long
 * callout can still split across pages and both halves look like a box.
 * Short ones (most of them) are glued whole.
 */
const BAR = 1.4;
const PAD = 2.6;
const ICON = 5;
const KEEP_WHOLE = 12;

function icon(kind, cx, top, color) {
  if (kind === 'hazard') {
    return [
      { t: 'tri', pts: [[cx, top + 0.3], [cx - 2.5, top + 4.5], [cx + 2.5, top + 4.5]], fill: color },
      textBox(cx - 0.55, top + 4.05, '!', 7.5, '#ffffff', { bold: true }),
    ];
  }
  return [
    { t: 'circle', cx, cy: top + 2.45, r: 2.25, fill: color },
    textBox(cx - 0.45, top + 3.75, 'i', 7.5, '#ffffff', { bold: true }),
  ];
}

export function calloutRows(block, { width, measure, blockId, gapFirst, size, justify }) {
  const def = CALLOUTS[block.variant] || CALLOUTS.note;
  const fill = mix(def.color, '#ffffff', 0.9);
  const textX = BAR + PAD + ICON + PAD;
  const textW = width - textX - PAD;
  const labelSize = 9.5;

  const rows = [];
  // label line: "WARNING — custom title"
  const label = def.label.toUpperCase();
  const lw = measure.width(label, { size: labelSize, bold: true });
  const titleLines = block.title?.trim()
    ? plainLines(block.title.trim(), textW - lw - 4, measure, labelSize, { bold: true })
    : [];
  const lh = lineH(labelSize);
  const labelRows = Math.max(1, titleLines.length);
  const head = [textBox(textX, PAD + baseline(labelSize), label, labelSize, def.color, { bold: true })];
  titleLines.forEach((ln, i) => {
    for (const r of ln.runs) head.push(textBox(textX + lw + 3 + r.x, PAD + i * lh + baseline(labelSize), r.text, labelSize, STYLE.ink, { bold: true }));
  });
  head.push(...icon(def.icon, BAR + PAD + ICON / 2, PAD, def.color));
  rows.push({ blockId, h: PAD + labelRows * lh, gap: gapFirst, glue: true, boxes: head });

  const body = bodyRows(block.body || '', { width: textW, x0: textX, measure, blockId, gapFirst: 0.8, size, justify }).filter((r) => r.boxes.length);
  // fold each row's gap into its height so the background has no holes
  for (const r of body) {
    rows.push({ ...r, h: r.h + r.gap, gap: 0, boxes: r.boxes.map((b) => ({ ...b, y: b.y + r.gap })) });
  }
  const last = rows[rows.length - 1];
  last.h += PAD;
  last.glue = false;
  if (rows.length <= KEEP_WHOLE) rows.forEach((r, i) => { r.glue = i < rows.length - 1; });
  else rows[0].glue = true;

  return rows.map((r) => ({
    ...r,
    boxes: [
      { t: 'rect', x: 0, y: 0, w: width, h: r.h, fill },
      { t: 'rect', x: 0, y: 0, w: BAR, h: r.h, fill: def.color },
      ...r.boxes,
    ],
  }));
}
