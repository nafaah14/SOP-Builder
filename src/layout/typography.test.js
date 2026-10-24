import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { layout } from './engine';
import { createMeasurer } from './measure';
import { parseBody, wrapRuns } from './rich';
import { FONTS } from './fonts';
import { newSop, newBlock } from '../model/defaults';
import { writePdf } from '../render/pdfWriter';

const measure = createMeasurer();
const lorem = (n) => Array.from({ length: n }, (_, i) => `word${i % 7 === 0 ? 'longer' : ''}${i}`).join(' ');
const sop = (body, style = {}) => ({
  ...newSop('T'),
  front: { cover: false, revisionHistory: false, toc: false, tocDepth: 2 },
  style: { ...newSop('T').style, ...style },
  blocks: [{ ...newBlock('text'), body }],
});
const lineEnds = (r) => {
  const byY = new Map();
  for (const b of r.pages[0].boxes) {
    if (b.t !== 'text' || b.size !== 10 || b.bid === '__title') continue;
    const end = b.x + measure.forDoc({ body: 'helvetica' }).width(b.text, b);
    byY.set(b.y, Math.max(byY.get(b.y) ?? 0, end));
  }
  return [...byY.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e);
};

describe('justified paragraphs', () => {
  it('stretches every line but the last to the right margin', () => {
    const ends = lineEnds(layout(sop(lorem(120)), measure));
    expect(ends.length).toBeGreaterThan(4);
    for (const e of ends.slice(0, -1)) expect(e).toBeCloseTo(210 - 20, 1);
    expect(ends.at(-1)).toBeLessThan(190);
  });

  it('stays ragged when set to left aligned', () => {
    const ends = lineEnds(layout(sop(lorem(120), { align: 'left' }), measure));
    expect(ends.slice(0, -1).some((e) => e < 189)).toBe(true);
  });

  it('never stretches a line into rivers of white', () => {
    const lines = wrapRuns([{ text: 'a verylongwordthatfillsmostoftheline b', bold: false, italic: false }], 60, measure, 10, { justify: true });
    expect(lines[0].runs.length).toBeLessThanOrEqual(2);
  });
});

describe('hand-wrapped lines', () => {
  it('joins a line broken mid-sentence back into its paragraph', () => {
    const p = parseBody('This can be done by going to the BJA panel and turning\nthe knob labeled Prelube Pump.\nNext paragraph.');
    expect(p.length).toBe(2);
    expect(p[0].runs.map((r) => r.text).join('')).toBe('This can be done by going to the BJA panel and turning the knob labeled Prelube Pump.');
  });

  it('keeps lines that end a sentence, start a capital, or follow a blank line', () => {
    expect(parseBody('Open valve A\nClose valve B').length).toBe(2);
    expect(parseBody('First line.\nsecond line').length).toBe(2);
    expect(parseBody('first part\n\nsecond part').length).toBe(2);
  });
});

describe('fonts', () => {
  it('measures each family with its own metrics', () => {
    const w = (font) => measure.forDoc({ body: font }).width('The quick brown fox', { size: 10 });
    const widths = Object.keys(FONTS).map(w);
    expect(new Set(widths.map((x) => x.toFixed(2))).size).toBeGreaterThan(5);
  });

  it('uses the heading font for titles and the body font for text, and lists the files to embed', () => {
    const r = layout({ ...sop('Body text here.', { font: 'source-serif-4', headingFont: 'inter' }), blocks: [
      { ...newBlock('section'), title: 'Purpose' },
      { ...newBlock('step'), title: 'Do it', body: 'Body text with **bold**.' },
    ] }, measure);
    expect(r.fonts).toEqual({ body: 'source-serif-4', heading: 'inter' });
    const sec = r.pages[0].boxes.find((b) => b.text === 'PURPOSE');
    expect(sec.font).toBe('heading');
    expect(r.fontFiles.sort()).toEqual(['inter:bold', 'source-serif-4:bold', 'source-serif-4:regular']);
  });

  it('wraps differently in a wider font', () => {
    const lines = (font) => new Set(layout(sop(lorem(200), { font }), measure).pages[0].boxes.filter((b) => b.t === 'text' && b.size === 10).map((b) => b.y)).size;
    expect(lines('merriweather')).not.toBe(lines('helvetica'));
  });

  it('embeds only the font files a document uses', () => {
    const doc = { ...sop('Plain body', { font: 'roboto', headingFont: 'roboto' }) };
    const r = layout(doc, measure);
    const fonts = Object.fromEntries(r.fontFiles.map((k) => {
      const [fam, st] = k.split(':');
      return [k, readFileSync(new URL(`../../public/fonts/${fam}/${st}.ttf`, import.meta.url)).toString('base64')];
    }));
    const raw = writePdf(r, doc, { fonts }).output();
    expect(raw).toMatch(/roboto/i);
    expect((raw.match(/\/FontFile2/g) || []).length).toBe(r.fontFiles.length);
  });

  it('text size scales body text', () => {
    const size = (textSize) => layout(sop('x', { textSize }), measure).pages[0].boxes.find((b) => b.text === 'x').size;
    expect([size('small'), size('normal'), size('large')]).toEqual([9.5, 10, 11]);
  });
});
