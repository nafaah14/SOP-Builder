/**
 * PDF's built-in fonts only cover WinAnsi (Latin-1 plus a few extras like
 * € – — “ ” •). Embedded fonts cover what their metrics table lists. Any
 * character the chosen font can't draw — Ω, ≤, √, →, ✓ in Helvetica, say —
 * is printed in an embedded DejaVu Sans instead.
 */
const EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const extra = new Set([...EXTRA].map((c) => c.codePointAt(0)));

export const isWinAnsi = (cp) => (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || extra.has(cp) || cp === 0x09;

/** 'MΩ ≥ 5' -> [{ text:'M', fallback:false }, { text:'Ω', fallback:true }, …] for a coverage test. */
export function segments(text, covers = isWinAnsi) {
  const out = [];
  for (const ch of text) {
    const fb = !covers(ch.codePointAt(0));
    const last = out[out.length - 1];
    if (last && last.fallback === fb) last.text += ch;
    else out.push({ text: ch, fallback: fb });
  }
  return out;
}

export function needsFallback(text, covers = isWinAnsi) {
  for (const ch of text) if (!covers(ch.codePointAt(0))) return true;
  return false;
}
