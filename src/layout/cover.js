import { STYLE, lineH, baseline, plainLines, textBox, mix, fmtDate, shiftBox } from './text';
import { tableRows, detailRows } from './table';
import { PT } from './measure';

/**
 * The cover is a fixed composition, not a flow: logo and company at the
 * top, title in the upper third, document details below it and the approval
 * table anchored to the bottom — the way controlled documents are usually
 * laid out. Three styles share the same pieces.
 */

export const COVER_STYLES = {
  classic: 'Classic',
  band: 'Corporate band',
  minimal: 'Minimal',
  boxed: 'Bordered',
  sidebar: 'Sidebar',
  centered: 'Centred',
};

/** Place rows one under another at (x, y) with no pagination. Returns [boxes, height]. */
function stack(rows, x, y) {
  const boxes = [];
  let cy = 0;
  rows.forEach((r, i) => {
    if (i > 0) cy += r.gap;
    for (const b of r.boxes) boxes.push(shiftBox(b, x, y + cy));
    cy += r.h;
  });
  return [boxes, cy];
}

function fit(logo, maxW, maxH) {
  const s = Math.min(maxW / logo.w, maxH / logo.h);
  return { w: logo.w * s, h: logo.h * s };
}

export function controlCells(doc) {
  const c = doc.control || {};
  return [
    ['Prepared by', c.prepared],
    ['Reviewed by', c.reviewed],
    ['Approved by', c.approved],
  ].map(([role, p]) => [role, p?.name || '', p?.position || '', '', fmtDate(p?.date || '')]);
}

export const CONTROL_COLUMNS = [
  { label: '', w: 0.17, bold: true },
  { label: 'Name', w: 0.25 },
  { label: 'Position', w: 0.23 },
  { label: 'Signature', w: 0.2 },
  { label: 'Date', w: 0.15 },
];

export function detailPairs(doc) {
  return [
    ['Document No.', doc.docNo || '—'],
    ['Revision', doc.revision !== '' && doc.revision != null ? String(doc.revision) : '—'],
    ['Effective date', fmtDate(doc.effectiveDate) || '—'],
    doc.reviewDate && ['Next review', fmtDate(doc.reviewDate)],
    doc.department && ['Department', doc.department],
  ].filter(Boolean);
}

/**
 * Each style is a recipe over the same pieces: header (logo + company),
 * title block, details table, approval table, footer note.
 */
const RECIPES = {
  classic: { align: 'left', headRule: true },
  band: { align: 'left', band: true },
  minimal: { align: 'left', table: 'lines', underline: true },
  boxed: { align: 'center', frame: true, headRule: true, detailsFrac: 0.72 },
  sidebar: { align: 'left', sidebar: true, underline: true },
  centered: { align: 'center', headRule: false, underline: true, detailsFrac: 0.72 },
};

export function coverBoxes(doc, { dims, measure }) {
  const { margins } = doc.page;
  const brand = doc.brand || {};
  const recipe = RECIPES[brand.coverStyle] || RECIPES.classic;
  const accent = doc.style.accent;
  const H = dims.h;
  const out = [];
  const center = recipe.align === 'center';
  const tableStyle = recipe.table || 'grid';
  const H_FONT = { bold: true, font: 'heading' };

  // ---- page furniture
  let L = margins.left;
  let R = dims.w - margins.right;
  if (recipe.frame) {
    const o = 9;
    out.push({ t: 'rect', x: o, y: o, w: dims.w - 2 * o, h: H - 2 * o, stroke: accent, lw: 0.9 });
    out.push({ t: 'rect', x: o + 1.6, y: o + 1.6, w: dims.w - 2 * o - 3.2, h: H - 2 * o - 3.2, stroke: accent, lw: 0.25 });
    L = Math.max(L, o + 10);
    R = Math.min(R, dims.w - o - 10);
  }
  if (recipe.sidebar) {
    const bw = 16;
    out.push({ t: 'rect', x: 0, y: 0, w: bw, h: H, fill: accent });
    out.push({ t: 'rect', x: bw, y: 0, w: 1.2, h: H, fill: mix(accent, '#ffffff', 0.55) });
    L = Math.max(L, bw + 14);
  }
  const W = R - L;
  const bandH = Math.max(H * 0.36, 90);
  if (recipe.band) out.push({ t: 'rect', x: 0, y: 0, w: dims.w, h: bandH, fill: accent });
  const onBand = !!recipe.band;
  const at = (w) => (center ? L + (W - w) / 2 : L);

  // ---- logo + company
  let y = onBand ? 14 : recipe.frame ? Math.max(margins.top - 2, 22) : margins.top - 6;
  const hasLogo = !!brand.logo?.dataUrl;
  let headH = 0;
  if (hasLogo) {
    const s = fit(brand.logo, center ? 60 : 55, center ? 20 : 16);
    const lx = at(s.w);
    if (onBand) out.push({ t: 'rect', x: lx - 2.5, y: y - 2.5, w: s.w + 5, h: s.h + 5, fill: '#ffffff' });
    out.push({ t: 'image', x: lx, y, w: s.w, h: s.h, src: brand.logo.dataUrl });
    headH = s.h;
  }
  if (brand.company) {
    const size = center ? 12 : 11;
    const w = measure.width(brand.company, { size, ...H_FONT });
    const color = onBand ? '#ffffff' : accent;
    if (center) {
      const cy = y + headH + (hasLogo ? 4 : 0) + size * PT;
      out.push(textBox(at(w), cy, brand.company, size, color, H_FONT));
      headH += (hasLogo ? 4 : 0) + size * PT + 1.5;
    } else {
      const cx = hasLogo ? R - w : L;
      const cy = y + (hasLogo ? headH / 2 + size * PT * 0.35 : size * PT);
      out.push(textBox(cx, cy, brand.company, size, color, H_FONT));
      headH = Math.max(headH, 6);
    }
  }
  y += headH + 4;
  if (recipe.headRule && (hasLogo || brand.company)) out.push({ t: 'line', x1: L, y1: y, x2: R, y2: y, color: accent, lw: recipe.frame ? 0.35 : 0.6 });

  // ---- title block
  const label = (brand.docType || 'Standard Operating Procedure').toUpperCase();
  const titleSize = onBand || recipe.sidebar || center ? 26 : 24;
  const titleW = center ? W * 0.9 : W;
  const titleLines = plainLines(doc.title || 'Untitled SOP', titleW, measure, titleSize, H_FONT);
  const titleH = titleLines.length * lineH(titleSize);
  let ty = onBand ? bandH - 14 - titleH - lineH(9) - 2 : Math.max(y + 24, H * (center ? 0.3 : 0.27));
  const labelColor = onBand ? mix(accent, '#ffffff', 0.7) : accent;
  const lw = measure.width(label, { size: 9, ...H_FONT });
  out.push(textBox(at(lw), ty + baseline(9), label, 9, labelColor, H_FONT));
  ty += lineH(9) + 2;
  titleLines.forEach((ln, i) => {
    const x0 = at(ln.width);
    for (const r of ln.runs) {
      out.push(textBox(x0 + r.x, ty + i * lineH(titleSize) + baseline(titleSize), r.text, titleSize, onBand ? '#ffffff' : STYLE.ink, { ...H_FONT, font: r.font || 'heading' }));
    }
  });
  ty += titleH;
  if (recipe.underline) {
    const uw = center ? 40 : 30;
    out.push({ t: 'line', x1: at(uw), y1: ty + 3, x2: at(uw) + uw, y2: ty + 3, color: accent, lw: 1.2 });
  }

  // ---- details
  const dW = W * (recipe.detailsFrac || 1);
  const detailsY = onBand ? bandH + 14 : ty + 14;
  const [dBoxes, dH] = stack(detailRows({ pairs: detailPairs(doc), width: dW, measure, accent, style: tableStyle }), at(dW), detailsY);
  out.push(...dBoxes);

  // ---- approvals, anchored to the bottom
  const note = brand.footerNote;
  const floor = recipe.frame ? Math.min(H - margins.bottom, H - 22) : H - margins.bottom;
  const bottom = floor - (note ? 4 : 0);
  const ctl = tableRows({ columns: CONTROL_COLUMNS, cells: controlCells(doc), width: W, measure, accent, style: tableStyle, minRowH: 11 });
  const ctlH = ctl.reduce((sum, r) => sum + r.h, 0);
  const headingGap = lineH(9.5) + 1.5;
  const ctlY = Math.max(bottom - ctlH, detailsY + dH + 12 + headingGap);
  const ah = 'DOCUMENT APPROVAL';
  out.push(textBox(at(measure.width(ah, { size: 9.5, ...H_FONT })), ctlY - headingGap + baseline(9.5), ah, 9.5, accent, H_FONT));
  out.push(...stack(ctl, L, ctlY)[0]);

  if (note) {
    const size = 8;
    const w = measure.width(note, { size, italic: true });
    out.push(textBox(L + W / 2 - w / 2, floor + 6, note, size, STYLE.muted, { italic: true }));
  }
  return out;
}
