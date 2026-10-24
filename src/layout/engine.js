import { pageDims, IMAGE_SIZES } from '../model/defaults';
import { computeNumbers, attachments } from '../model/numbering';
import { paginate } from './paginate';
import { STYLE, fmtDate, lineH, baseline, textRows, bodyRows, headingRows, plainLines, textBox, indentRows } from './text';
import { calloutRows } from './callout';
import { needsFallback, segments } from './winansi';
import { tableRows } from './table';
import { coverBoxes, controlCells, CONTROL_COLUMNS } from './cover';
import { tocEntries, tocRows } from './toc';

export { STYLE, fmtDate };

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
 *   { t:'image', x, y, w, h, src | imageId }  (imageId: a stored photo)
 *   { t:'link', x, y, w, h, page }
 *   { t:'circle', cx, cy, r, fill }    { t:'tri', pts: [[x,y]×3], fill }
 *
 * A document is up to four parts, each starting on a new page: cover,
 * revision history, contents, body. Each flowing part goes through the same
 * paginator (paginate.js); the cover is a fixed composition (cover.js).
 */

function titleBlockRows(doc, { width, measure }) {
  const rows = [];
  const lines = plainLines(doc.title || 'Untitled SOP', width, measure, STYLE.titleSize, { bold: true });
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
      boxes: [textBox(0, baseline(9), meta, 9, STYLE.muted)],
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
      const lines = plainLines((block.title || 'Untitled section').toUpperCase(), width - indent, measure, size, { bold: true });
      const rows = textRows(lines, { size, x0: indent, color: accent, blockId: id, gapFirst: STYLE.gap.section, glueAll: true });
      rows[0].boxes.unshift(textBox(0, baseline(size), numbers[id], size, accent, { bold: true }));
      rows.push({
        blockId: id, h: 2.5, gap: 0.5, glue: true,
        boxes: [{ t: 'line', x1: 0, y1: 0.4, x2: width, y2: 0.4, color: STYLE.rule, lw: 0.3 }],
      });
      if (doc.style.sectionNewPage && !isFirstSection) rows[0].forceBreak = true;
      return rows;
    }
    case 'step': {
      const gapFirst = STYLE.gap.step;
      const numBox = (size) => textBox(0, baseline(size), numbers[id], size, accent, { bold: true });
      const rows = [];
      if (block.title?.trim()) {
        const size = STYLE.stepTitleSize;
        const lines = plainLines(block.title.trim(), width - indent, measure, size, { bold: true });
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
    case 'text':
      return bodyRows(block.body || '', { width, x0: 0, measure, blockId: id, gapFirst: STYLE.gap.text })
        .filter((r) => r.boxes.length);
    case 'table':
    case 'callout':
    case 'image': {
      const dx = ctx.attached[id] ? indent : 0;
      const w = width - dx;
      const rows = block.kind === 'table' ? tableBlockRows(block, { ...ctx, width: w })
        : block.kind === 'image' ? imageRows(block, { ...ctx, width: w })
          : calloutRows(block, { width: w, measure, blockId: id, gapFirst: STYLE.gap.block });
      return indentRows(rows, dx);
    }
    case 'pageBreak':
      return [{ blockId: id, h: 0, gap: 0, glue: false, forceBreak: true, boxes: [] }];
    default:
      return [];
  }
}

/** Most of a page, so a tall portrait photo never leaves room for nothing else. */
export const IMAGE_MAX_H = 0.6;

/**
 * A photo is one unbreakable row, centred, sized as a share of the column
 * and capped in height; its caption is glued underneath. With no photo yet
 * the space is held by a grey placeholder so pagination is already right.
 */
function imageRows(block, { width, measure, numbers, contentH }) {
  const id = block.id;
  const ratio = block.w && block.h ? block.h / block.w : 0.75;
  let w = width * (IMAGE_SIZES[block.size]?.frac ?? 0.75);
  let h = w * ratio;
  const maxH = contentH * IMAGE_MAX_H;
  if (h > maxH) {
    h = maxH;
    w = h / ratio;
  }
  const x = (width - w) / 2;
  const boxes = block.imageId
    ? [{ t: 'image', x, y: 0, w, h, imageId: block.imageId }]
    : [{ t: 'rect', x, y: 0, w, h, fill: '#EEF0F3' }, textBox(x + w / 2 - measure.width('Photo', { size: 9 }) / 2, h / 2 + 1, 'Photo', 9, STYLE.muted)];
  if (block.frame !== false && block.imageId) boxes.push({ t: 'rect', x, y: 0, w, h, stroke: '#B8BEC7', lw: 0.25 });
  const rows = [{ blockId: id, h, gap: STYLE.gap.block, glue: false, boxes }];

  if (block.caption?.trim()) {
    const size = 9;
    const label = `${numbers[id]}  `;
    const lw = measure.width(label, { size, bold: true });
    const lines = plainLines(block.caption.trim(), Math.max(40, width - lw), measure, size, { italic: true });
    lines.forEach((ln, i) => {
      const lineW = (i === 0 ? lw : 0) + ln.width;
      const x0 = (width - lineW) / 2 + (i === 0 ? lw : 0);
      const bx = ln.runs.map((r) => textBox(x0 + r.x, baseline(size), r.text, size, STYLE.ink, { italic: true }));
      if (i === 0) bx.unshift(textBox(x0 - lw, baseline(size), label, size, STYLE.ink, { bold: true }));
      rows.push({ blockId: id, h: lineH(size), gap: i === 0 ? 1.5 : 0, glue: false, boxes: bx });
    });
    rows.forEach((r, i) => { r.glue = i < rows.length - 1; });
  }
  return rows;
}

function tableBlockRows(block, { width, measure, numbers, doc }) {
  const id = block.id;
  const rows = [];
  if (block.caption?.trim()) {
    const size = 9;
    const label = `${numbers[id]}  `;
    const lw = measure.width(label, { size, bold: true });
    const lines = plainLines(block.caption.trim(), width - lw, measure, size, { bold: true });
    const cr = textRows(lines, { size, x0: lw, color: STYLE.ink, blockId: id, gapFirst: STYLE.gap.block, glueAll: true });
    cr[0].boxes.unshift(textBox(0, baseline(size), label, size, doc.style.accent, { bold: true }));
    cr[cr.length - 1].glue = true;
    rows.push(...cr);
  }
  rows.push(...tableRows({
    columns: block.columns,
    cells: block.rows.map((r) => r.cells),
    width,
    measure,
    accent: doc.style.accent,
    style: tableStyleOf(doc),
    headerRow: block.headerRow !== false,
    striped: !!block.striped,
    blockId: id,
    gapFirst: rows.length ? 1.2 : STYLE.gap.block,
  }));
  return rows;
}

export const REVISION_COLUMNS = [
  { label: 'Rev', w: 0.1, align: 'center' },
  { label: 'Date', w: 0.17 },
  { label: 'Description of change', w: 0.51 },
  { label: 'Author', w: 0.22 },
];

export function revisionCells(doc) {
  if (doc.revisions?.length) {
    return doc.revisions.map((r) => [r.rev, fmtDate(r.date), r.description, r.author]);
  }
  return [[doc.revision ?? '0', fmtDate(doc.effectiveDate), 'Initial issue', doc.control?.prepared?.name || '']];
}

const tableStyleOf = (doc) => (doc.brand?.coverStyle === 'minimal' ? 'lines' : 'grid');

function revisionRows(doc, ctx) {
  return [
    ...headingRows('Revision history', { ...ctx, accent: doc.style.accent, blockId: '__rev' }),
    ...tableRows({
      columns: REVISION_COLUMNS, cells: revisionCells(doc), width: ctx.width, measure: ctx.measure,
      accent: doc.style.accent, style: tableStyleOf(doc), blockId: '__rev', gapFirst: 2,
    }),
  ];
}

/** Without a cover, the approval table follows the title block — if anyone is named in it. */
function bodyControlRows(doc, ctx) {
  const c = doc.control || {};
  if (![c.prepared, c.reviewed, c.approved].some((p) => p?.name)) return [];
  const rows = tableRows({
    columns: CONTROL_COLUMNS, cells: controlCells(doc), width: ctx.width, measure: ctx.measure,
    accent: doc.style.accent, style: tableStyleOf(doc), minRowH: 10, blockId: '__title', gapFirst: 3,
  });
  rows[rows.length - 1].glue = false;
  return rows;
}

/** Fill {title} {docNo} {rev} {page} {pages} {date} {department} {company}. */
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
    .replaceAll('{company}', doc.brand?.company || '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function headerFooterBoxes(doc, dims, page, pages, measure) {
  const { margins } = doc.page;
  const size = STYLE.headerSize;
  let left = margins.left;
  const right = dims.w - margins.right;
  const out = [];
  const slots = (cfg, y, x0) => {
    for (const pos of ['left', 'center', 'right']) {
      const text = fillTokens(cfg?.[pos], doc, page, pages);
      if (!text) continue;
      const w = measure.width(text, { size });
      const x = pos === 'left' ? x0 : pos === 'right' ? right - w : (margins.left + right) / 2 - w / 2;
      out.push(textBox(x, y, text, size, STYLE.muted));
    }
  };
  const hasAny = (cfg) => cfg && (cfg.left || cfg.center || cfg.right);
  const logo = doc.brand?.headerLogo && doc.brand?.logo?.dataUrl ? doc.brand.logo : null;
  if (hasAny(doc.header) || logo) {
    const ruleY = margins.top - 6;
    if (logo) {
      const h = Math.min(7, margins.top - 9);
      const w = Math.min((logo.w / logo.h) * h, 40);
      const hh = (w / logo.w) * logo.h;
      out.push({ t: 'image', x: left, y: ruleY - 1.5 - hh, w, h: hh, src: logo.dataUrl });
      left += w + 3;
    }
    slots(doc.header, ruleY - 1.8, left);
    out.push({ t: 'line', x1: margins.left, y1: ruleY, x2: right, y2: ruleY, color: STYLE.rule, lw: 0.25 });
  }
  if (hasAny(doc.footer)) {
    const ruleY = dims.h - margins.bottom + 6;
    out.push({ t: 'line', x1: margins.left, y1: ruleY, x2: right, y2: ruleY, color: STYLE.rule, lw: 0.25 });
    slots(doc.footer, ruleY + 4.2, margins.left);
  }
  return out;
}

/** One text box -> several, each run of non-Helvetica characters marked font:'fallback'. */
function splitFallback(b, measure) {
  let x = b.x;
  return segments(b.text).map((seg) => {
    const box = { ...b, text: seg.text, x, ...(seg.fallback ? { font: 'fallback' } : {}) };
    x += measure.width(seg.text, b);
    return box;
  });
}

export function layout(doc, measure) {
  const dims = pageDims(doc.page);
  const { margins } = doc.page;
  const width = dims.w - margins.left - margins.right;
  const frame = { left: margins.left, top: margins.top, height: dims.h - margins.top - margins.bottom };
  const numbers = computeNumbers(doc.blocks);
  const ctx = { width, measure, numbers, doc, attached: attachments(doc.blocks), contentH: frame.height };
  const front = doc.front || {};

  // ---- body
  const bodyRowsAll = [];
  if (!front.cover) bodyRowsAll.push(...titleBlockRows(doc, ctx), ...bodyControlRows(doc, ctx));
  // the first section follows the title on page 1 even with "sections start a new page"
  const firstSection = doc.blocks.find((b) => b.kind === 'section');
  for (const b of doc.blocks) bodyRowsAll.push(...blockRows(b, ctx, b === firstSection));
  if (!bodyRowsAll.length) bodyRowsAll.push({ h: 0, gap: 0, glue: false, boxes: [] });
  const body = paginate(bodyRowsAll, frame);

  // ---- front matter
  const cover = front.cover ? [{ boxes: coverBoxes(doc, { dims, measure }), kind: 'cover' }] : [];
  const rev = front.revisionHistory ? paginate(revisionRows(doc, ctx), frame).pages : [];

  // Contents is laid out twice: once to learn how many pages it takes, then
  // with real page numbers (which can't change its length — titles wrap
  // against a fixed page-number column).
  let toc = [];
  const tocCtx = { width, measure, accent: doc.style.accent };
  if (front.toc) {
    const depth = front.tocDepth || 2;
    const guess = paginate(tocRows(tocEntries(doc, numbers, body.blocks, depth, 0), tocCtx), frame).pages.length;
    const offset = cover.length + rev.length + guess;
    toc = paginate(tocRows(tocEntries(doc, numbers, body.blocks, depth, offset), tocCtx), frame).pages;
  }

  const offset = cover.length + rev.length + toc.length;
  const pages = [
    ...cover,
    ...rev.map((p) => ({ ...p, kind: 'front' })),
    ...toc.map((p) => ({ ...p, kind: 'front' })),
    ...body.pages.map((p) => ({ ...p, kind: 'body' })),
  ];
  const total = pages.length;
  pages.forEach((pg, i) => {
    if (pg.kind !== 'cover') pg.boxes.push(...headerFooterBoxes(doc, dims, i + 1, total, measure));
  });

  let usesFallback = false;
  for (const pg of pages) {
    if (!pg.boxes.some((b) => b.t === 'text' && needsFallback(b.text))) continue;
    usesFallback = true;
    pg.boxes = pg.boxes.flatMap((b) => (b.t === 'text' && needsFallback(b.text) ? splitFallback(b, measure) : [b]));
  }

  const blocks = {};
  for (const [id, m] of Object.entries(body.blocks)) {
    blocks[id] = { startPage: m.startPage + offset, endPage: m.endPage + offset };
  }

  return { w: dims.w, h: dims.h, pages, blocks, numbers, pageCount: total, bodyStartPage: offset + 1, usesFallback };
}
