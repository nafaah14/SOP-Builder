import { jsPDF } from 'jspdf';
import { styleName } from '../layout/measure';
import { FONTS } from '../layout/fonts';

const rgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// the same logo on every page should be embedded once
const aliasOf = (src) => {
  let h = 0;
  for (let i = 0; i < src.length; i += 97) h = (h * 31 + src.charCodeAt(i)) | 0;
  return `img${src.length}_${h >>> 0}`;
};

/**
 * Draws the engine's page boxes into a jsPDF document. No layout decisions
 * happen here. `assets` carries what the boxes reference but the engine
 * doesn't hold: { fonts: { 'family:style': base64 TTF }, images: { id: dataUrl } }.
 */
export function writePdf(result, doc, assets = {}) {
  const pdf = new jsPDF({
    unit: 'mm',
    format: [result.w, result.h].sort((a, b) => a - b),
    orientation: result.w > result.h ? 'landscape' : 'portrait',
    compress: true,
  });
  pdf.setProperties({ title: doc.title || 'SOP', subject: doc.docNo || '', creator: 'SOP Builder' });
  const loaded = new Set();
  // register only what the layout uses: jsPDF embeds every font it's given
  for (const key of result.fontFiles || []) {
    const b64 = assets.fonts?.[key];
    if (!b64) continue;
    const [fam, st] = key.split(':');
    pdf.addFileToVFS(`${fam}-${st}.ttf`, b64);
    pdf.addFont(`${fam}-${st}.ttf`, fam, st === 'regular' ? 'normal' : st);
    loaded.add(key);
  }
  const fonts = result.fonts || { body: 'helvetica', heading: 'helvetica' };
  const setFont = (b) => {
    if (b.font === 'fallback') {
      const st = b.bold ? 'bold' : 'regular';
      if (loaded.has(`dejavu:${st}`)) return pdf.setFont('dejavu', st === 'regular' ? 'normal' : st);
      return pdf.setFont('helvetica', styleName(b.bold, b.italic));
    }
    const fam = b.font === 'heading' ? fonts.heading : fonts.body;
    const f = FONTS[fam];
    const st = styleName(b.bold, b.italic);
    if (f && !f.builtin && loaded.has(`${fam}:${st === 'normal' ? 'regular' : st}`)) return pdf.setFont(fam, st);
    return pdf.setFont(f?.builtin || 'helvetica', st);
  };

  result.pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    for (const b of page.boxes) {
      if (b.t === 'text') {
        setFont(b);
        pdf.setFontSize(b.size);
        pdf.setTextColor(...rgb(b.color));
        pdf.text(b.text, b.x, b.y, { baseline: 'alphabetic' });
      } else if (b.t === 'line') {
        pdf.setDrawColor(...rgb(b.color));
        pdf.setLineWidth(b.lw);
        pdf.line(b.x1, b.y1, b.x2, b.y2);
      } else if (b.t === 'rect') {
        if (b.fill) pdf.setFillColor(...rgb(b.fill));
        if (b.stroke) {
          pdf.setDrawColor(...rgb(b.stroke));
          pdf.setLineWidth(b.lw || 0.3);
        }
        pdf.rect(b.x, b.y, b.w, b.h, b.fill && b.stroke ? 'FD' : b.fill ? 'F' : 'S');
      } else if (b.t === 'circle') {
        pdf.setFillColor(...rgb(b.fill));
        pdf.circle(b.cx, b.cy, b.r, 'F');
      } else if (b.t === 'tri') {
        const [[x1, y1], [x2, y2], [x3, y3]] = b.pts;
        pdf.setFillColor(...rgb(b.fill));
        pdf.triangle(x1, y1, x2, y2, x3, y3, 'F');
      } else if (b.t === 'image') {
        const src = b.src || assets.images?.[b.imageId];
        if (!src) continue;
        const fmt = /^data:image\/jpe?g/i.test(src) ? 'JPEG' : 'PNG';
        pdf.addImage(src, fmt, b.x, b.y, b.w, b.h, b.imageId || aliasOf(src), 'FAST');
      } else if (b.t === 'link' && b.page) {
        pdf.link(b.x, b.y, b.w, b.h, { pageNumber: b.page });
      }
    }
  });
  return pdf;
}

export function pdfFileName(doc) {
  const base = [doc.docNo, doc.title].filter(Boolean).join(' ') || 'SOP';
  const rev = doc.revision !== '' && doc.revision != null ? ` Rev ${doc.revision}` : '';
  return `${base}${rev}.pdf`.replace(/[\\/:*?"<>|]+/g, '-');
}
