// Builds src/layout/fallbackWidths.json: advance widths (1/1000 em) of the
// DejaVu glyphs used for characters Helvetica can't print. Measuring from a
// table keeps layout synchronous; the fonts themselves load only at export.
//   node scripts/gen-fallback-widths.mjs
import { jsPDF } from 'jspdf';
import { readFileSync, writeFileSync } from 'node:fs';

const RANGES = [
  [0x0100, 0x024f], // Latin Extended-A/B
  [0x0250, 0x02ff], // IPA, spacing modifiers
  [0x0370, 0x03ff], // Greek (Ω, µ, Δ …)
  [0x0400, 0x04ff], // Cyrillic
  [0x2000, 0x206f], // general punctuation
  [0x2070, 0x209f], // super/subscripts
  [0x20a0, 0x20cf], // currency
  [0x2100, 0x214f], // letterlike (℃ №)
  [0x2150, 0x218f], // number forms (⅓)
  [0x2190, 0x21ff], // arrows
  [0x2200, 0x22ff], // math operators (≤ ≥ ≠ √ ∆)
  [0x2300, 0x23ff], // misc technical (⏚ ⌀)
  [0x2460, 0x24ff], // enclosed alphanumerics (① ②)
  [0x2500, 0x25ff], // box drawing, geometric shapes
  [0x2600, 0x26ff], // misc symbols (⚠ ⚡)
  [0x2700, 0x27bf], // dingbats (✓ ✗)
];

const out = {};
for (const [style, file] of [['normal', 'DejaVuSans.ttf'], ['bold', 'DejaVuSans-Bold.ttf']]) {
  const d = new jsPDF();
  d.addFileToVFS(file, readFileSync(new URL(`../public/fonts/${file}`, import.meta.url)).toString('base64'));
  d.addFont(file, 'DejaVu', style);
  d.setFont('DejaVu', style);
  const meta = d.getFont().metadata;
  const widths = {};
  for (const [a, b] of RANGES) {
    for (let cp = a; cp <= b; cp++) {
      if (!meta.characterToGlyph(cp)) continue;
      widths[cp.toString(36)] = Math.round(d.getStringUnitWidth(String.fromCodePoint(cp)) * 1000);
    }
  }
  out[style] = widths;
}
writeFileSync(new URL('../src/layout/fallbackWidths.json', import.meta.url), JSON.stringify(out));
console.log(Object.keys(out.normal).length, 'glyphs');
