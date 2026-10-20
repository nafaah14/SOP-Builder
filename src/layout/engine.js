import { pageDims } from '../model/defaults';
import { computeNumbers } from '../model/numbering';
import { PT } from './measure';
import { parseBody, wrapRuns } from './rich';

/**
 * The layout engine: document JSON in, positioned page boxes out. Both the
 * on-screen preview and the PDF writer draw exactly these boxes, and the
 * editor reads `blocks[id].startPage` to draw its page-break markers — one
 * source of truth for where every page ends.
 *
 * Boxes are primitives in mm, absolute on their page:
 *   { t:'text', x, y (baseline), text, size (pt), bold, italic, color }
 *   { t:'rect', x, y, w, h, fill?, stroke?, lw? }
 *   { t:'line', x1, y1, x2, y2, color, lw }
 *
 * Pagination works on rows. A row is one unbreakable strip (a line of text, a
 * heading line, later an image or a table row) with a `gap` above it that is
 * dropped at the top of a page, and `glue` meaning "never break between me
 * and the next row". Keep-with-next and widow/orphan control are all just
 * glue, so the paginator itself stays a few lines long.
 */

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
  gap: { section: 8, step: 5, text: 3, para: 1.6, list: 0.6, blank: 3 },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const lineH = (size) => size * PT * STYLE.lineHeight;
const baseline = (size) => {
  const s = size * PT;
  return (lineH(size) - s) / 2 + s * 0.78;
};

function textRows(lines, { size, x0, color, blockId, gapFirst, glueAll = false }) {
  const h = lineH(size);
  const n = lines.length;
  return lines.map((ln, i) => ({
    blockId,
    h,
    gap: i === 0 ? gapFirst : 0,
    // widow/orphan: the first two and last two lines of a paragraph stay together
    glue: glueAll || n <= 3 || i === 0 || i >= n - 2,
    boxes: ln.runs.map((r) => ({
      t: 'text', x: x0 + r.x, y: baseline(size), text: r.text, size, bold: r.bold, italic: r.italic, color,
    })),
  })).map((row, i, arr) => (i === arr.length - 1 ? { ...row, glue: glueAll } : row));
}

function bodyRows(body, { width, x0, measure, blockId, gapFirst }) {
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
      pr[0].boxes.unshift({ t: 'text', x: x0, y: baseline(size), text: marker, size, bold: false, italic: false, color: STYLE.ink });
    }
    rows.push(...pr);
  });
  return rows;
}

function titleBlockRows(doc, ctx) {
  const { width, measure } = ctx;
  const rows = [];
  const title = doc.title || 'Untitled SOP';
  const lines = wrapRuns([{ text: title, bold: true, italic: false }], width, measure, STYLE.titleSize);
  rows.push(...textRows(lines, { size: STYLE.titleSize, x0: 0, color: doc.style.accent, blockId: '__title', gapFirst: 0, glueAll: true }));
  const meta = [
    doc.docNo && `Doc No. ${doc.docNo}`,
    doc.revision !== '' && doc.revision != null && `Revision ${doc.revision}`,
    doc.effectiveDate && `Effective ${fmtDate(doc.effectiveDate)}`,
    doc.department,
  ].filter(Boolean).join('   ·   ');
  if (meta) {
    rows.push({
      blockId: '__title', h: lineH(9), gap: 1, glue: true,
      boxes: [{ t: 'text', x: 0, y: baseline(9), text: meta, size: 9, bold: false, italic: false, color: STYLE.muted }],
    });
  }
  rows.push({
    blockId: '__title', h: 2, gap: 2, glue: false,
    boxes: [{ t: 'line', x1: 0, y1: 0.5, x2: width, y2: 0.5, color: doc.style.accent, lw: 0.6 }],
  });
  return rows;
}

function blockRows(block, ctx, isFirstSection) {
  const { width, measure, numbers, doc } = ctx;
  const accent = doc.style.accent;
  const indent = STYLE.indent;
  const id = block.id;

  switch (block.kind) {
    case 'section': {
      const size = STYLE.sectionSize;
      const title = (block.title || 'Untitled section').toUpperCase();
      const lines = wrapRuns([{ text: title, bold: true, italic: false }], width - indent, measure, size);
      const rows = textRows(lines, { size, x0: indent, color: accent, blockId: id, gapFirst: STYLE.gap.section, glueAll: true });
      rows[0].boxes.unshift({ t: 'text', x: 0, y: baseline(size), text: numbers[id], size, bold: true, italic: false, color: accent });
      rows.push({
        blockId: id, h: 2.5, gap: 0.5, glue: true,
        boxes: [{ t: 'line', x1: 0, y1: 0.4, x2: width, y2: 0.4, color: STYLE.rule, lw: 0.3 }],
      });
      if (doc.style.sectionNewPage && !isFirstSection) rows[0].forceBreak = true;
      return rows;
    }
    case 'step': {
      const gapFirst = STYLE.gap.step;
      const numBox = (size) => ({ t: 'text', x: 0, y: baseline(size), text: numbers[id], size, bold: true, italic: false, color: accent });
      const rows = [];
      if (block.title?.trim()) {
        const size = STYLE.stepTitleSize;
        const lines = wrapRuns([{ text: block.title.trim(), bold: true, italic: false }], width - indent, measure, size);
        const tr = textRows(lines, { size, x0: indent, color: STYLE.ink, blockId: id, gapFirst, glueAll: true });
        tr[0].boxes.unshift(numBox(size));
        rows.push(...tr);
      }
      const br = bodyRows(block.body || '', { width: width - indent, x0: indent, measure, blockId: id, gapFirst: rows.length ? 1 : gapFirst })
        .filter((r) => r.boxes.length);
      if (!rows.length) {
        if (!br.length) return [{ blockId: id, h: lineH(STYLE.body), gap: gapFirst, glue: false, boxes: [numBox(STYLE.body)] }];
        br[0].boxes.unshift(numBox(STYLE.body));
      }
      rows.push(...br);
      return rows;
    }
    case 'text': {
      return bodyRows(block.body || '', { width, x0: 0, measure, blockId: id, gapFirst: STYLE.gap.text })
        .filter((r) => r.boxes.length);
    }
    case 'pageBreak':
      return [{ blockId: id, h: 0, gap: 0, glue: false, forceBreak: true, boxes: [] }];
    default:
      return [];
  }
}

/** Fill {title} {docNo} {rev} {page} {pages} {date} {department}. */
export function fillTokens(tpl, doc, page, pages) {
  if (!tpl) return '';
  return tpl
    .replaceAll('{title}', doc.title || '')
    .replaceAll('{docNo}', doc.docNo || '')
    .replaceAll('{rev}', doc.revision ?? '')
    .replaceAll('{page}', String(page))
    .replaceAll('{pages}', String(pages))
    .replaceAll('{date}', fmtDate(doc.effectiveDate))
    .replaceAll('{department}', doc.department || '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function headerFooterBoxes(doc, dims, page, pages, measure) {
  const { margins } = doc.page;
  const size = STYLE.headerSize;
  const left = margins.left;
  const right = dims.w - margins.right;
  const out = [];
  const slots = (cfg, y) => {
    for (const pos of ['left', 'center', 'right']) {
      const text = fillTokens(cfg?.[pos], doc, page, pages);
      if (!text) continue;
      const w = measure.width(text, { size });
      const x = pos === 'left' ? left : pos === 'right' ? right - w : (left + right) / 2 - w / 2;
      out.push({ t: 'text', x, y, text, size, bold: false, italic: false, color: STYLE.muted });
    }
  };
  const hasAny = (cfg) => cfg && (cfg.left || cfg.center || cfg.right);
  if (hasAny(doc.header)) {
    const ruleY = margins.top - 6;
    slots(doc.header, ruleY - 1.8);
    out.push({ t: 'line', x1: left, y1: ruleY, x2: right, y2: ruleY, color: STYLE.rule, lw: 0.25 });
  }
  if (hasAny(doc.footer)) {
    const ruleY = dims.h - margins.bottom + 6;
    out.push({ t: 'line', x1: left, y1: ruleY, x2: right, y2: ruleY, color: STYLE.rule, lw: 0.25 });
    slots(doc.footer, ruleY + 4.2);
  }
  return out;
}

/** Group rows into unbreakable chunks along their glue. */
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
  chunk.reduce((s, r, i) => s + r.h + (i === 0 && atTop ? 0 : r.gap), 0);

export function layout(doc, measure) {
  const dims = pageDims(doc.page);
  const { margins } = doc.page;
  const width = dims.w - margins.left - margins.right;
  const contentH = dims.h - margins.top - margins.bottom;
  const numbers = computeNumbers(doc.blocks);
  const ctx = { width, measure, numbers, doc };

  const rows = [...titleBlockRows(doc, ctx)];
  // the first section follows the title on page 1 even with "sections start a new page"
  const firstSection = doc.blocks.find((b) => b.kind === 'section');
  for (const b of doc.blocks) rows.push(...blockRows(b, ctx, b === firstSection));

  const pages = [{ boxes: [] }];
  const blocks = {};
  let y = 0;
  const newPage = () => {
    pages.push({ boxes: [] });
    y = 0;
  };
  const place = (row) => {
    if (y > 0) y += row.gap;
    const ox = margins.left;
    const oy = margins.top + y;
    const page = pages[pages.length - 1];
    for (const b of row.boxes) {
      const bid = row.blockId;
      if (b.t === 'line') page.boxes.push({ ...b, bid, x1: b.x1 + ox, x2: b.x2 + ox, y1: b.y1 + oy, y2: b.y2 + oy });
      else page.boxes.push({ ...b, bid, x: b.x + ox, y: b.y + oy });
    }
    const p = pages.length;
    const meta = blocks[row.blockId] || (blocks[row.blockId] = { startPage: p, endPage: p });
    meta.endPage = p;
    y += row.h;
  };

  for (const chunk of chunkRows(rows)) {
    if (chunk[0].forceBreak && y > 0) newPage();
    if (y > 0 && y + chunkHeight(chunk, false) > contentH) newPage();
    if (chunkHeight(chunk, y === 0) <= contentH - y) {
      chunk.forEach(place);
    } else {
      // taller than a whole page: glue has to give somewhere
      for (const row of chunk) {
        if (y > 0 && y + row.gap + row.h > contentH) newPage();
        place(row);
      }
    }
  }
  // a page break with nothing after it shouldn't leave a blank last page
  if (pages.length > 1 && !pages[pages.length - 1].boxes.length) pages.pop();

  const total = pages.length;
  pages.forEach((pg, i) => pg.boxes.push(...headerFooterBoxes(doc, dims, i + 1, total, measure)));

  for (const b of doc.blocks) {
    if (blocks[b.id]) {
      blocks[b.id].startPage = Math.min(blocks[b.id].startPage, total);
      blocks[b.id].endPage = Math.min(blocks[b.id].endPage, total);
    }
  }

  return { w: dims.w, h: dims.h, pages, blocks, numbers, pageCount: total };
}
