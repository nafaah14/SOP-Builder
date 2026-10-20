import { jsPDF } from 'jspdf';

export const PT = 0.352778; // 1pt in mm

const styleName = (bold, italic) =>
  bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';

/**
 * Text widths come from jsPDF's own Helvetica metrics — the same numbers the
 * PDF writer uses — so a line that fits in the preview fits in the PDF too.
 * The preview draws each run at the x the engine computed, never reflowing
 * on its own, which is what keeps the two in lockstep.
 */
export function createMeasurer() {
  const doc = new jsPDF({ unit: 'mm' });
  const cache = new Map();
  return {
    width(text, { size, bold = false, italic = false }) {
      if (!text) return 0;
      const key = `${size}|${bold}|${italic}|${text}`;
      let w = cache.get(key);
      if (w === undefined) {
        doc.setFont('helvetica', styleName(bold, italic));
        doc.setFontSize(size);
        w = doc.getTextWidth(text);
        if (cache.size > 20000) cache.clear();
        cache.set(key, w);
      }
      return w;
    },
  };
}

export { styleName };
