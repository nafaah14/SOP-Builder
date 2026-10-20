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

/** body string -> [{ kind: 'p'|'bullet'|'num', n?, runs, gapBefore }] */
export function parseBody(body = '') {
  const out = [];
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
      n = 0;
    }
    out.push({ kind, n: kind === 'num' ? n : undefined, runs: parseInline(text), blank });
    blank = false;
  }
  return out;
}

/**
 * Greedy word wrap over styled runs. Returns lines of positioned runs:
 * [{ runs: [{ text, bold, italic, x }], width }]. Words longer than the
 * line are broken by character so nothing ever overflows the margin.
 */
export function wrapRuns(runs, maxW, measure, size) {
  const words = [];
  for (const r of runs) {
    const parts = r.text.split(/(\s+)/);
    for (const p of parts) {
      if (!p) continue;
      if (/^\s+$/.test(p)) {
        if (words.length) words[words.length - 1].space = true;
      } else {
        words.push({ text: p, bold: r.bold, italic: r.italic, space: false });
      }
    }
  }

  const lines = [];
  let cur = [];
  let x = 0;
  const flush = () => {
    lines.push(cur);
    cur = [];
    x = 0;
  };

  for (const w of words) {
    const st = { size, bold: w.bold, italic: w.italic };
    let ww = measure.width(w.text, st);
    if (ww > maxW) {
      // break an over-long token by character
      let piece = '';
      for (const ch of w.text) {
        const test = piece + ch;
        if (x + measure.width(test, st) > maxW && (piece || cur.length)) {
          if (piece) cur.push({ ...w, text: piece, x, space: false });
          flush();
          piece = ch;
        } else {
          piece = test;
        }
      }
      w.text = piece;
      ww = measure.width(piece, st);
    }
    if (cur.length && x + ww > maxW) flush();
    cur.push({ ...w, x });
    x += ww + (w.space ? measure.width(' ', st) : 0);
  }
  if (cur.length || !lines.length) flush();

  // merge adjacent words of the same style into runs
  return lines.map((ws) => {
    const merged = [];
    for (const w of ws) {
      const prev = merged[merged.length - 1];
      if (prev && prev.bold === w.bold && prev.italic === w.italic) {
        prev.text += w.text;
      } else {
        merged.push({ text: w.text, bold: w.bold, italic: w.italic, x: w.x });
      }
      if (w.space) merged[merged.length - 1].text += ' ';
    }
    const last = merged[merged.length - 1];
    if (last) last.text = last.text.trimEnd();
    const width = last ? last.x + measure.width(last.text, { size, bold: last.bold, italic: last.italic }) : 0;
    return { runs: merged, width };
  });
}
