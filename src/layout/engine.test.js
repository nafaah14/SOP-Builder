import { describe, it, expect } from 'vitest';
import { layout, fillTokens, fmtDate } from './engine';
import { createMeasurer } from './measure';
import { parseBody, parseInline, wrapRuns } from './rich';
import { newSop, newBlock } from '../model/defaults';
import { computeNumbers } from '../model/numbering';
import { moveSection, nudgeBlock } from '../model/ops';
import { writePdf } from '../render/pdfWriter';

const measure = createMeasurer();

const BODY_ONLY = { cover: false, revisionHistory: false, toc: false, tocDepth: 2 };
const sop = (blocks, patch = {}) => ({ ...newSop('Test'), front: BODY_ONLY, blocks, ...patch });
const section = (title) => ({ ...newBlock('section'), title });
const step = (title, body = '') => ({ ...newBlock('step'), title, body });
const text = (body) => ({ ...newBlock('text'), body });
const lorem = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const textOf = (page) => page.boxes.filter((b) => b.t === 'text').map((b) => b.text);

describe('numbering', () => {
  it('numbers sections and steps from order', () => {
    const blocks = [step('a'), section('S1'), step('b'), step('c'), section('S2'), step('d')];
    const n = computeNumbers(blocks);
    expect(blocks.map((b) => n[b.id])).toEqual(['1', '1', '1.1', '1.2', '2', '2.1']);
  });

  it('renumbers after a reorder', () => {
    const blocks = [section('S1'), step('a'), step('b')];
    const doc = nudgeBlock(sop(blocks), blocks[2].id, -1);
    const n = computeNumbers(doc.blocks);
    expect(doc.blocks.map((b) => [b.title, n[b.id]])).toEqual([['S1', '1'], ['b', '1.1'], ['a', '1.2']]);
  });

  it('moves a section together with its steps', () => {
    const blocks = [section('A'), step('a1'), section('B'), step('b1'), step('b2')];
    const doc = moveSection(sop(blocks), blocks[2].id, blocks[0].id);
    expect(doc.blocks.map((b) => b.title)).toEqual(['B', 'b1', 'b2', 'A', 'a1']);
  });
});

describe('rich text', () => {
  it('parses bullets, numbers and inline styles', () => {
    const p = parseBody('Intro **bold** and *it*\n- one\n- two\n1. first\n2. second');
    expect(p.map((x) => x.kind)).toEqual(['p', 'bullet', 'bullet', 'num', 'num']);
    expect(p[4].n).toBe(2);
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false, italic: false },
      { text: 'b', bold: true, italic: false },
      { text: ' c', bold: false, italic: false },
    ]);
  });

  it('never lets a line exceed the width', () => {
    const lines = wrapRuns([{ text: `${lorem(80)} ${'x'.repeat(200)}`, bold: false, italic: false }], 100, measure, 10);
    expect(lines.length).toBeGreaterThan(3);
    for (const ln of lines) expect(ln.width).toBeLessThanOrEqual(100.01);
  });
});

describe('pagination', () => {
  it('fits a short SOP on one page with header and footer', () => {
    const r = layout({ ...newSop('Lockout procedure'), front: BODY_ONLY }, measure);
    expect(r.pageCount).toBe(1);
    expect(textOf(r.pages[0])).toContain('Page 1 of 1');
  });

  it('overflows long content and counts pages in the footer', () => {
    const blocks = [section('Long')];
    for (let i = 0; i < 40; i++) blocks.push(step(`Step ${i}`, lorem(60)));
    const r = layout(sop(blocks), measure);
    expect(r.pageCount).toBeGreaterThan(3);
    r.pages.forEach((p, i) => expect(textOf(p)).toContain(`Page ${i + 1} of ${r.pageCount}`));
  });

  it('keeps every box inside the content area', () => {
    const blocks = [section('Long')];
    for (let i = 0; i < 30; i++) blocks.push(step(`Step ${i}`, lorem(90)));
    const doc = sop(blocks);
    const r = layout(doc, measure);
    const { top, bottom } = doc.page.margins;
    for (const p of r.pages) {
      for (const b of p.boxes) {
        if (b.t !== 'text' || b.size === 8) continue; // header/footer live in the margins
        expect(b.y).toBeGreaterThan(top);
        expect(b.y).toBeLessThanOrEqual(r.h - bottom);
      }
    }
  });

  it('never leaves a step heading alone at the bottom of a page', () => {
    for (let fill = 20; fill < 70; fill += 3) {
      const blocks = [text(lorem(fill * 12)), step('The heading', lorem(200))];
      const r = layout(sop(blocks), measure);
      const meta = r.blocks[blocks[1].id];
      const page = r.pages[meta.startPage - 1];
      const texts = textOf(page);
      const hi = texts.indexOf('The heading');
      expect(hi).toBeGreaterThanOrEqual(0);
      // at least two body lines follow the heading on the same page
      const after = page.boxes.filter((b) => b.t === 'text' && b.size === 10 && b.y > page.boxes.find((x) => x.text === 'The heading').y);
      expect(after.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('applies widow/orphan control to paragraphs', () => {
    let splits = 0;
    for (let fill = 30; fill < 80; fill += 1) {
      const blocks = [text(lorem(fill * 12)), text(lorem(70))];
      const r = layout(sop(blocks), measure);
      const meta = r.blocks[blocks[1].id];
      if (meta.startPage === meta.endPage) continue;
      splits += 1;
      const lines = (pg) => new Set(r.pages[pg - 1].boxes.filter((b) => b.bid === blocks[1].id).map((b) => b.y)).size;
      expect(lines(meta.startPage)).toBeGreaterThanOrEqual(2);
      expect(lines(meta.endPage)).toBeGreaterThanOrEqual(2);
    }
    expect(splits).toBeGreaterThan(0);
  });

  it('honours explicit page breaks and does not end on a blank page', () => {
    const blocks = [text('one'), newBlock('pageBreak'), text('two'), newBlock('pageBreak')];
    const r = layout(sop(blocks), measure);
    expect(r.pageCount).toBe(2);
    expect(r.blocks[blocks[2].id].startPage).toBe(2);
  });

  it('starts sections on new pages when asked, except the first', () => {
    const blocks = [section('A'), text('a'), section('B'), text('b'), section('C')];
    const r = layout(sop(blocks, { style: { accent: '#000000', sectionNewPage: true } }), measure);
    expect(blocks.filter((b) => b.kind === 'section').map((b) => r.blocks[b.id].startPage)).toEqual([1, 2, 3]);
  });

  it('lays out landscape Letter pages', () => {
    const r = layout(sop([text('x')], { page: { size: 'Letter', orientation: 'landscape', margins: { top: 20, right: 15, bottom: 20, left: 15 } } }), measure);
    expect(r.w).toBeCloseTo(279.4);
    expect(r.h).toBeCloseTo(215.9);
  });
});

describe('header/footer tokens', () => {
  it('fills tokens', () => {
    const doc = { title: 'T', docNo: 'SOP-01', revision: '2', effectiveDate: '2026-10-20', department: 'Ops' };
    expect(fillTokens('{docNo} Rev {rev} · {date}', doc, 3, 9)).toBe('SOP-01 Rev 2 · 20 Oct 2026');
    expect(fillTokens('Page {page} of {pages}', doc, 3, 9)).toBe('Page 3 of 9');
    expect(fmtDate('2026-01-05')).toBe('5 Jan 2026');
  });
});

describe('pdf writer', () => {
  it('writes one PDF page per layout page', () => {
    const blocks = [section('Long')];
    for (let i = 0; i < 25; i++) blocks.push(step(`Step ${i}`, lorem(60)));
    const doc = sop(blocks);
    const r = layout(doc, measure);
    const pdf = writePdf(r, doc);
    expect(pdf.internal.getNumberOfPages()).toBe(r.pageCount);
    const bytes = new Uint8Array(pdf.output('arraybuffer'));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-');
  });
});
