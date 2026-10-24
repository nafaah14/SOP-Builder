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

export function coverBoxes(doc, { dims, measure }) {
  const { margins } = doc.page;
  const brand = doc.brand || {};
  const style = brand.coverStyle || 'classic';
  const accent = doc.style.accent;
  const L = margins.left;
  const R = dims.w - margins.right;
  const W = R - L;
  const H = dims.h;
  const out = [];
  const onBand = style === 'band';
  const tableStyle = style === 'minimal' ? 'lines' : 'grid';

  // ---- band background
  const bandH = Math.max(H * 0.36, 90);
  if (onBand) out.push({ t: 'rect', x: 0, y: 0, w: dims.w, h: bandH, fill: accent });

  // ---- logo + company
  let y = onBand ? 14 : margins.top - 6;
  let headH = 0;
  if (brand.logo?.dataUrl) {
    const s = fit(brand.logo, 55, 16);
    if (onBand) out.push({ t: 'rect', x: L - 2.5, y: y - 2.5, w: s.w + 5, h: s.h + 5, fill: '#ffffff' });
    out.push({ t: 'image', x: L, y, w: s.w, h: s.h, src: brand.logo.dataUrl });
    headH = s.h;
  }
  if (brand.company) {
    const size = 11;
    const w = measure.width(brand.company, { size, bold: true });
    const hasLogo = !!brand.logo?.dataUrl;
    const cx = hasLogo ? R - w : L;
    const cy = y + (hasLogo ? headH / 2 + size * PT * 0.35 : size * PT);
    out.push(textBox(cx, cy, brand.company, size, onBand ? '#ffffff' : accent, { bold: true }));
    headH = Math.max(headH, 6);
  }
  y += headH + 4;
  if (style === 'classic') out.push({ t: 'line', x1: L, y1: y, x2: R, y2: y, color: accent, lw: 0.6 });

  // ---- title block
  const label = (brand.docType || 'Standard Operating Procedure').toUpperCase();
  const titleSize = onBand ? 26 : 24;
  const titleLines = plainLines(doc.title || 'Untitled SOP', W, measure, titleSize, { bold: true });
  const titleH = titleLines.length * lineH(titleSize);
  let ty;
  if (onBand) {
    ty = bandH - 14 - titleH - lineH(9) - 2;
  } else {
    ty = Math.max(y + 24, H * 0.27);
  }
  out.push(textBox(L, ty + baseline(9), label, 9, onBand ? mix(accent, '#ffffff', 0.7) : accent, { bold: true }));
  ty += lineH(9) + 2;
  titleLines.forEach((ln, i) => {
    for (const r of ln.runs) {
      out.push(textBox(L + r.x, ty + i * lineH(titleSize) + baseline(titleSize), r.text, titleSize, onBand ? '#ffffff' : STYLE.ink, { bold: true }));
    }
  });
  ty += titleH;
  if (style === 'minimal') {
    out.push({ t: 'line', x1: L, y1: ty + 3, x2: L + 30, y2: ty + 3, color: accent, lw: 1.2 });
  }

  // ---- details
  const detailsY = onBand ? bandH + 14 : ty + 14;
  const [dBoxes, dH] = stack(detailRows({ pairs: detailPairs(doc), width: W, measure, accent, style: tableStyle }), L, detailsY);
  out.push(...dBoxes);

  // ---- approvals, anchored to the bottom
  const note = brand.footerNote;
  const bottom = H - margins.bottom - (note ? 4 : 0);
  const ctl = tableRows({ columns: CONTROL_COLUMNS, cells: controlCells(doc), width: W, measure, accent, style: tableStyle, minRowH: 11 });
  const ctlH = ctl.reduce((s, r) => s + r.h, 0);
  const headingGap = lineH(9.5) + 1.5;
  const ctlY = Math.max(bottom - ctlH, detailsY + dH + 12 + headingGap);
  out.push(textBox(L, ctlY - headingGap + baseline(9.5), 'DOCUMENT APPROVAL', 9.5, accent, { bold: true }));
  out.push(...stack(ctl, L, ctlY)[0]);

  if (note) {
    const size = 8;
    const w = measure.width(note, { size, italic: true });
    out.push(textBox(L + W / 2 - w / 2, H - margins.bottom + 6, note, size, STYLE.muted, { italic: true }));
  }
  return out;
}
