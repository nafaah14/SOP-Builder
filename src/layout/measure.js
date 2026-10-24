import { jsPDF } from 'jspdf';
import { FONTS, FALLBACK, fontOf, styleKey } from './fonts';
import { isWinAnsi, segments, needsFallback } from './winansi';

export const PT = 0.352778; // 1pt in mm

const styleName = (bold, italic) =>
  bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal';

/**
 * Text widths come from the same metrics the PDF uses — jsPDF's for the
 * built-in fonts, generated tables for embedded ones — so a line that fits
 * in the preview fits in the PDF too. The preview draws each run at the x
 * the engine computed, never reflowing on its own.
 *
 * `st.font` is a role: undefined (body), 'heading' or 'fallback'. A
 * measurer bound to a document (forDoc) maps roles to its chosen families.
 */
export function createMeasurer() {
  const doc = new jsPDF({ unit: 'mm' });
  const cache = new Map();

  const covers = (family) => {
    const f = fontOf(family);
    return f.builtin ? isWinAnsi : (cp) => f.metrics.regular[cp.toString(36)] !== undefined;
  };

  function fallbackW(text, size, bold) {
    const t = FALLBACK.metrics[bold ? 'bold' : 'regular'];
    let em = 0;
    for (const ch of text) em += (t[ch.codePointAt(0).toString(36)] ?? 600) / 1000;
    return em * size * PT;
  }

  function familyW(family, text, size, bold, italic) {
    const f = fontOf(family);
    if (f.builtin) {
      doc.setFont(f.builtin, styleName(bold, italic));
      doc.setFontSize(size);
      return doc.getTextWidth(text);
    }
    const t = f.metrics[styleKey(bold, italic)] || f.metrics.regular;
    let em = 0;
    for (const ch of text) em += (t[ch.codePointAt(0).toString(36)] ?? 600) / 1000;
    return em * size * PT;
  }

  function raw(family, text, { size, bold = false, italic = false }) {
    if (!text) return 0;
    const key = `${family}|${size}|${bold}|${italic}|${text}`;
    let w = cache.get(key);
    if (w === undefined) {
      const cov = covers(family);
      w = needsFallback(text, cov)
        ? segments(text, cov).reduce((s, seg) => s + (seg.fallback ? fallbackW(seg.text, size, bold) : familyW(family, seg.text, size, bold, italic)), 0)
        : familyW(family, text, size, bold, italic);
      if (cache.size > 40000) cache.clear();
      cache.set(key, w);
    }
    return w;
  }

  const bound = new Map();
  const api = {
    covers,
    /** A measurer for one document's body and heading fonts. */
    forDoc(fonts = {}) {
      const body = FONTS[fonts.body] ? fonts.body : 'helvetica';
      const heading = FONTS[fonts.heading] ? fonts.heading : body;
      const key = `${body}|${heading}`;
      if (!bound.has(key)) {
        const family = (role) => (role === 'heading' ? heading : body);
        bound.set(key, {
          fonts: { body, heading },
          family,
          covers: (role) => covers(family(role)),
          width: (text, st) => (st.font === 'fallback' ? fallbackW(text, st.size, st.bold) : raw(family(st.font), text, st)),
        });
      }
      return bound.get(key);
    },
  };
  // unbound use measures in Helvetica, as before
  api.width = (text, st) => api.forDoc().width(text, st);
  return api;
}

let shared;
/** One measurer for the whole app — its width cache is worth sharing. */
export const sharedMeasurer = () => shared || (shared = createMeasurer());

export { styleName };
