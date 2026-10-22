import { PT } from './measure';
import { parseBody, wrapRuns } from './rich';

export const STYLE = {
  body: 10,
  lineHeight: 1.42,
  muted: '#5B6573',
  ink: '#1A1F29',
  rule: '#C9CED6',
  indent: 12,
  bulletIndent: 5,
  titleSize: 18,
  sectionSize: 13,
  stepTitleSize: 10.5,
  headerSize: 8,
  tableSize: 9,
  gap: { section: 8, step: 5, text: 3, para: 1.6, list: 0.6, blank: 3 },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export const lineH = (size) => size * PT * STYLE.lineHeight;
export const baseline = (size) => {
  const s = size * PT;
  return (lineH(size) - s) / 2 + s * 0.78;
};

export const textBox = (x, y, text, size, color, { bold = false, italic = false } = {}) => ({
  t: 'text', x, y, text, size, bold, italic, color,
});

/** Wrapped single-style text -> positioned lines, for headings and table cells. */
export function plainLines(text, width, measure, size, style = {}) {
  return wrapRuns([{ text: text || '', bold: !!style.bold, italic: !!style.italic }], width, measure, size);
}

export function textRows(lines, { size, x0, color, blockId, gapFirst, glueAll = false }) {
  const h = lineH(size);
  const n = lines.length;
  return lines.map((ln, i) => ({
    blockId,
    h,
    gap: i === 0 ? gapFirst : 0,
    // widow/orphan: the first two and last two lines of a paragraph stay together
    glue: glueAll || n <= 3 || i === 0 || i >= n - 2,
    boxes: ln.runs.map((r) => textBox(x0 + r.x, baseline(size), r.text, size, color, r)),
  })).map((row, i, arr) => (i === arr.length - 1 ? { ...row, glue: glueAll } : row));
}

export function bodyRows(body, { width, x0, measure, blockId, gapFirst }) {
  const size = STYLE.body;
  const rows = [];
  const paras = parseBody(body);
  paras.forEach((p, pi) => {
    const listIndent = p.kind === 'p' ? 0 : STYLE.bulletIndent;
    const lines = wrapRuns(p.runs, width - listIndent, measure, size);
    const inList = p.kind !== 'p' && paras[pi - 1]?.kind !== 'p';
    const gap = pi === 0 ? gapFirst : p.blank ? STYLE.gap.blank : inList ? STYLE.gap.list : STYLE.gap.para;
    const pr = textRows(lines, { size, x0: x0 + listIndent, color: STYLE.ink, blockId, gapFirst: gap });
    if (p.kind !== 'p' && pr.length) {
      const marker = p.kind === 'bullet' ? '•' : `${p.n}.`;
      pr[0].boxes.unshift(textBox(x0, baseline(size), marker, size, STYLE.ink));
    }
    rows.push(...pr);
  });
  return rows;
}

/** An unnumbered heading in the section style — "Revision history", "Contents". */
export function headingRows(title, { width, measure, accent, blockId }) {
  const size = STYLE.sectionSize;
  const lines = plainLines(title.toUpperCase(), width, measure, size, { bold: true });
  const rows = textRows(lines, { size, x0: 0, color: accent, blockId, gapFirst: 0, glueAll: true });
  rows.push({
    blockId, h: 4, gap: 0.5, glue: true,
    boxes: [{ t: 'line', x1: 0, y1: 0.4, x2: width, y2: 0.4, color: STYLE.rule, lw: 0.3 }],
  });
  return rows;
}

/** '#rrggbb' mixed toward '#rrggbb' by t (0..1). */
export function mix(a, b, t) {
  const p = (h) => {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
