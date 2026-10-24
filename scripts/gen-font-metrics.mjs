// Builds src/layout/fonts/<id>.json: advance widths (1/1000 em) of every glyph
// layout may need from each embedded font, per style. Measuring from tables
// keeps layout synchronous; the TTFs themselves load only for preview/export.
//   node scripts/gen-font-metrics.mjs
import { jsPDF } from 'jspdf';
import { readFileSync, writeFileSync } from 'node:fs';

const WINANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const TEXT_RANGES = [[0x20, 0x7e], [0xa0, 0x24f], [0x370, 0x3ff], [0x2000, 0x206f], [0x2070, 0x209f], [0x20a0, 0x20cf], [0x2100, 0x214f], [0x2190, 0x21ff], [0x2200, 0x22ff]];
const FALLBACK_RANGES = [...TEXT_RANGES, [0x250, 0x2ff], [0x400, 0x4ff], [0x2150, 0x218f], [0x2300, 0x23ff], [0x2460, 0x24ff], [0x2500, 0x25ff], [0x2600, 0x26ff], [0x2700, 0x27bf]];

const FAMILIES = {
  inter: ['regular', 'bold', 'italic', 'bolditalic'],
  roboto: ['regular', 'bold', 'italic', 'bolditalic'],
  'open-sans': ['regular', 'bold', 'italic', 'bolditalic'],
  lato: ['regular', 'bold', 'italic', 'bolditalic'],
  'source-serif-4': ['regular', 'bold', 'italic', 'bolditalic'],
  merriweather: ['regular', 'bold', 'italic', 'bolditalic'],
};

function widths(path, ranges) {
  const d = new jsPDF();
  d.addFileToVFS('f.ttf', readFileSync(new URL(`../public/fonts/${path}`, import.meta.url)).toString('base64'));
  d.addFont('f.ttf', 'F', 'normal');
  d.setFont('F', 'normal');
  const meta = d.getFont().metadata;
  const out = {};
  const add = (cp) => {
    if (!meta.characterToGlyph(cp)) return;
    out[cp.toString(36)] = Math.round(d.getStringUnitWidth(String.fromCodePoint(cp)) * 1000);
  };
  for (const [a, b] of ranges) for (let cp = a; cp <= b; cp++) add(cp);
  for (const ch of WINANSI_EXTRA) add(ch.codePointAt(0));
  return out;
}

for (const [id, styles] of Object.entries(FAMILIES)) {
  const out = {};
  for (const st of styles) out[st] = widths(`${id}/${st}.ttf`, TEXT_RANGES);
  writeFileSync(new URL(`../src/layout/fonts/${id}.json`, import.meta.url), JSON.stringify(out));
  console.log(id, Object.keys(out.regular).length, 'glyphs');
}
writeFileSync(new URL('../src/layout/fonts/dejavu.json', import.meta.url), JSON.stringify({
  regular: widths('DejaVuSans.ttf', FALLBACK_RANGES),
  bold: widths('DejaVuSans-Bold.ttf', FALLBACK_RANGES),
}));
