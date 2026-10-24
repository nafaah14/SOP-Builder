import inter from './fonts/inter.json';
import roboto from './fonts/roboto.json';
import openSans from './fonts/open-sans.json';
import lato from './fonts/lato.json';
import sourceSerif from './fonts/source-serif-4.json';
import merriweather from './fonts/merriweather.json';
import dejavu from './fonts/dejavu.json';

/**
 * Document fonts. Built-ins are PDF's standard fonts (no embedding, WinAnsi
 * only); the rest are embedded from public/fonts/<id>/ — subset, and only
 * the styles a document actually uses. `metrics` are generated widths
 * (scripts/gen-font-metrics.mjs) so layout never waits on a download.
 * `css` is the family the preview draws with: the same TTFs via @font-face.
 */
export const FONTS = {
  helvetica: { label: 'Helvetica', kind: 'Sans', builtin: 'helvetica', css: "Helvetica, Arial, 'Liberation Sans', sans-serif" },
  times: { label: 'Times', kind: 'Serif', builtin: 'times', css: "'Times New Roman', Times, 'Liberation Serif', serif" },
  inter: { label: 'Inter', kind: 'Sans', metrics: inter, css: "'SOP Inter', sans-serif" },
  roboto: { label: 'Roboto', kind: 'Sans', metrics: roboto, css: "'SOP Roboto', sans-serif" },
  'open-sans': { label: 'Open Sans', kind: 'Sans', metrics: openSans, css: "'SOP Open Sans', sans-serif" },
  lato: { label: 'Lato', kind: 'Sans', metrics: lato, css: "'SOP Lato', sans-serif" },
  'source-serif-4': { label: 'Source Serif', kind: 'Serif', metrics: sourceSerif, css: "'SOP Source Serif', serif" },
  merriweather: { label: 'Merriweather', kind: 'Serif', metrics: merriweather, css: "'SOP Merriweather', serif" },
};

export const FALLBACK = { label: 'DejaVu Sans', metrics: dejavu, css: "'DejaVu Sans', sans-serif" };

export const styleKey = (bold, italic) =>
  bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'regular';

export const fontOf = (id) => FONTS[id] || FONTS.helvetica;

/** Where the TTF for a family/style lives, relative to the site root. */
export const fontFile = (id, style) => (id === 'dejavu'
  ? `/fonts/${style === 'bold' ? 'DejaVuSans-Bold' : 'DejaVuSans'}.ttf`
  : `/fonts/${id}/${style}.ttf`);
