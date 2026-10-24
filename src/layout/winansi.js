import FALLBACK from './fallbackWidths.json';

/**
 * PDF's built-in Helvetica only covers WinAnsi (Latin-1 plus a few extras
 * like € – — “ ” •). Anything else — Ω, ≤, √, →, ✓ — is printed in an
 * embedded DejaVu Sans instead. Text is split into runs of each.
 */
const EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const extra = new Set([...EXTRA].map((c) => c.codePointAt(0)));

export const isWinAnsi = (cp) => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || extra.has(cp) || cp === 0x09;

export function needsFallback(text) {
  for (const ch of text) if (!isWinAnsi(ch.codePointAt(0))) return true;
  return false;
}

/** 'MΩ ≥ 5' -> [{ text:'M', fallback:false }, { text:'Ω', fallback:true }, { text:' ', … }] */
export function segments(text) {
  const out = [];
  for (const ch of text) {
    const fb = !isWinAnsi(ch.codePointAt(0));
    const last = out[out.length - 1];
    if (last && last.fallback === fb) last.text += ch;
    else out.push({ text: ch, fallback: fb });
  }
  return out;
}

/** Width in em of a fallback run, from the generated DejaVu table (unknown glyphs: 0.6em). */
export function fallbackEm(text, bold) {
  const table = bold ? FALLBACK.bold : FALLBACK.normal;
  let w = 0;
  for (const ch of text) w += (table[ch.codePointAt(0).toString(36)] ?? 600) / 1000;
  return w;
}
