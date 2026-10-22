import { jsPDF } from 'jspdf';
import { styleName } from '../layout/measure';

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

/** Draws the engine's page boxes into a jsPDF document. No layout decisions happen here. */
export function writePdf(result, doc) {
  const pdf = new jsPDF({
    unit: 'mm',
    format: [result.w, result.h].sort((a, b) => a - b),
    orientation: result.w > result.h ? 'landscape' : 'portrait',
    compress: true,
  });
  pdf.setProperties({ title: doc.title || 'SOP', subject: doc.docNo || '', creator: 'SOP Builder' });

  result.pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    for (const b of page.boxes) {
      if (b.t === 'text') {
        pdf.setFont('helvetica', styleName(b.bold, b.italic));
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
      } else if (b.t === 'image') {
        const fmt = /^data:image\/jpe?g/i.test(b.src) ? 'JPEG' : 'PNG';
        pdf.addImage(b.src, fmt, b.x, b.y, b.w, b.h, aliasOf(b.src), 'FAST');
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
