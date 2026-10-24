/**
 * The body text format is deliberately small: one paragraph per line,
 * "- " bullets, "1. " numbered items, **bold** and *italic*. Anything richer
 * would let an SOP drift away from looking official.
 */

const BULLET = /^\s*[-•*]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function parseInline(text) {
  const runs = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false, italic: false });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true, italic: false });
    else runs.push({ text: m[2], bold: false, italic: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false, italic: false });
  return runs.filter((r) => r.text);
}

// A line that stops mid-sentence and is followed by one starting in lower
// case was wrapped by hand (or by whatever it was pasted from): join it.
const ENDS_SENTENCE = /[.!?:;]["'”’)\]]*$/;
const CONTINUES = /^[a-z0-9(“‘"']/;

/** body string -> [{ kind: 'p'|'bullet'|'num', n?, runs, blank }] */
export function parseBody(body = '') {
  const items = [];
  let n = 0;
  let blank = false;
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blank = true;
      n = 0;
      continue;
    }
    let kind = 'p';
    let text = line.trim();
    if (BULLET.test(line)) {
      kind = 'bullet';
      text = line.replace(BULLET, '');
      n = 0;
    } else if (NUMBERED.test(line)) {
      kind = 'num';
      text = line.replace(NUMBERED, '');
      n += 1;
    } else {
      const prev = items[items.length - 1];
      if (prev && !blank && !ENDS_SENTENCE.test(prev.text) && CONTINUES.test(text)) {
        prev.text += ` ${text}`;
        continue;
      }
      n = 0;
    }
    items.push({ kind, n: kind === 'num' ? n : undefined, text, blank });
    blank = false;
  }
  return items.map(({ text, ...it }) => ({ ...it, runs: parseInline(text) }));
}

/**
 * Greedy word wrap over styled runs. Returns lines of positioned runs:
 * [{ runs: [{ text, bold, italic, font, x }], width, last }]. Words longer
 * than the line are broken by character so nothing ever overflows the
 * margin. With `justify`, every line but a paragraph's last is stretched
 * to the full width by widening the gaps between words.
 */
export function wrapRuns(runs, maxW, measure, size, { justify = false } = {}) {
  const words = [];
  for (const r of runs) {
    for (const p of r.text.split(/(\s+)/)) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        if (words.length) words[words.length - 1].space = true;
      } else {
        words.push({ text: p, bold: !!r.bold, italic: !!r.italic, font: r.font, space: false });
      }
    }
  }

  const st = (w) => ({ size, bold: w.bold, italic: w.italic, font: w.font });
  const lines = [];
  let cur = [];
  let x = 0;
  const flush = () => {
    lines.push(cur);
    cur = [];
    x = 0;
  };

  for (const w of words) {
    let ww = measure.width(w.text, st(w));
    if (ww > maxW) {
      let piece = '';
      for (const ch of w.text) {
        const test = piece + ch;
        if (x + measure.width(test, st(w)) > maxW && (piece || cur.length)) {
          if (piece) cur.push({ ...w, text: piece, x, w: measure.width(piece, st(w)), space: false });
          flush();
          piece = ch;
        } else {
          piece = test;
        }
      }
      w.text = piece;
      ww = measure.width(piece, st(w));
    }
    if (cur.length && x + ww > maxW) flush();
    cur.push({ ...w, x, w: ww });
    x += ww + (w.space ? measure.width(' ', st(w)) : 0);
  }
  if (cur.length || !lines.length) flush();

  return lines.map((ws, li) => {
    const last = li === lines.length - 1;
    const end = ws.length ? ws[ws.length - 1].x + ws[ws.length - 1].w : 0;
    const gaps = ws.slice(0, -1).filter((w) => w.space).length;
    let stretch = justify && !last && gaps > 0 ? (maxW - end) / gaps : 0;
    // a line of a few long words would open rivers of white: leave it ragged
    if (stretch > size * 0.352778 * 1.4) stretch = 0;
    if (stretch > 0) {
      // every word its own run, pushed right by the gaps before it
      let k = 0;
      const runsOut = ws.map((w) => {
        const r = { text: w.text, bold: w.bold, italic: w.italic, font: w.font, x: w.x + k * stretch };
        if (w.space) k += 1;
        return r;
      });
      return { runs: runsOut, width: maxW, last };
    }
    const merged = [];
    for (const w of ws) {
      const prev = merged[merged.length - 1];
      if (prev && prev.bold === w.bold && prev.italic === w.italic && prev.font === w.font) {
        prev.text += w.text;
      } else {
        merged.push({ text: w.text, bold: w.bold, italic: w.italic, font: w.font, x: w.x });
      }
      if (w.space) merged[merged.length - 1].text += ' ';
    }
    const lastRun = merged[merged.length - 1];
    if (lastRun) lastRun.text = lastRun.text.trimEnd();
    return { runs: merged, width: end, last };
  });
}
