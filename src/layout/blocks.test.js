import { describe, it, expect } from 'vitest';
import { layout } from './engine';
import { createMeasurer } from './measure';
import { newSop, newBlock, newTable, cloneBlock } from '../model/defaults';
import { attachments, computeNumbers } from '../model/numbering';
import * as T from '../model/table';
import { writePdf } from '../render/pdfWriter';

const measure = createMeasurer();
const BODY_ONLY = { cover: false, revisionHistory: false, toc: false, tocDepth: 2 };
const sop = (blocks) => ({ ...newSop('T'), front: BODY_ONLY, blocks });
const step = (title, body = '') => ({ ...newBlock('step'), title, body });
const section = (title) => ({ ...newBlock('section'), title });
const callout = (variant, body, title = '') => ({ ...newBlock('callout'), variant, body, title });
const table = (rows, cols = 3, patch = {}) => {
  let t = { ...newBlock('table'), ...newTable(cols, 0), ...patch };
  for (let i = 0; i < rows; i++) {
    t = T.addRow(t);
    t = T.setCell(t, i, 0, `R${i} first cell`);
    t = T.setCell(t, i, 1, i % 5 === 0 ? 'A much longer cell that has to wrap onto several lines inside its column so the row grows' : `value ${i}`);
  }
  return t;
};
const lorem = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const texts = (p, bid) => p.boxes.filter((b) => b.t === 'text' && (!bid || b.bid === bid)).map((b) => b.text);

describe('table model', () => {
  it('adds, removes and moves rows and columns', () => {
    let t = newTable(2, 2);
    t = T.setCell(t, 0, 0, 'a');
    t = T.addColumn(t, 1);
    expect(t.columns.length).toBe(3);
    expect(t.rows[0].cells).toEqual(['a', '', '']);
    t = T.moveColumn(t, 0, 1);
    expect(t.rows[0].cells).toEqual(['', 'a', '']);
    t = T.addRow(t, 0);
    expect(t.rows.length).toBe(3);
    t = T.moveRow(t, 1, 1);
    expect(t.rows[2].cells[1]).toBe('a');
    t = T.removeColumn(T.removeColumn(T.removeColumn(t, 0), 0), 0);
    expect(t.columns.length).toBe(1);
  });

  it('pastes a grid from a spreadsheet, growing the table', () => {
    let t = newTable(2, 1);
    t = T.pasteGrid(t, -1, 0, T.parseGrid('Item\tQty\tUnit\r\nBolt\t4\tpcs\r\nNut\t4\tpcs\r\n'));
    expect(t.columns.map((c) => c.label)).toEqual(['Item', 'Qty', 'Unit']);
    expect(t.rows.map((r) => r.cells)).toEqual([['Bolt', '4', 'pcs'], ['Nut', '4', 'pcs']]);
  });

  it('duplicating a table gives fresh row and column ids', () => {
    const t = table(2);
    const c = cloneBlock(t);
    expect(c.rows[0].id).not.toBe(t.rows[0].id);
    expect(c.columns[0].id).not.toBe(t.columns[0].id);
  });
});

describe('tables in the layout', () => {
  it('numbers captioned tables and prints the caption', () => {
    const a = table(1, 2, { caption: 'Tools' });
    const b = table(1, 2);
    const c = table(1, 2, { caption: 'Spares' });
    const n = computeNumbers([a, b, c]);
    expect([n[a.id], n[b.id], n[c.id]]).toEqual(['Table 1', undefined, 'Table 2']);
    const r = layout(sop([a, b, c]), measure);
    expect(texts(r.pages[0])).toEqual(expect.arrayContaining(['Table 1  ', 'Tools', 'Table 2  ', 'Spares']));
  });

  it('splits a long table between rows and repeats the header', () => {
    const t = table(90, 3, { caption: 'Checklist' });
    const r = layout(sop([section('Checks'), t]), measure);
    const pages = r.pages.filter((p) => p.boxes.some((b) => b.bid === t.id));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const p of pages) expect(texts(p, t.id)).toContain('Column 1');
    for (let i = 0; i < 90; i++) {
      expect(pages.filter((p) => texts(p, t.id).includes(`R${i} first cell`)).length).toBe(1);
    }
    // nothing spills into the bottom margin
    for (const p of pages) for (const b of p.boxes) if (b.bid === t.id && b.t === 'rect') expect(b.y + b.h).toBeLessThanOrEqual(r.h - 22 + 0.01);
  });

  it('can drop the header row', () => {
    const t = table(3, 3, { headerRow: false });
    const r = layout(sop([t]), measure);
    expect(texts(r.pages[0], t.id)).not.toContain('Column 1');
  });

  it('keeps the caption with the table', () => {
    for (let fill = 30; fill < 70; fill += 2) {
      const t = table(4, 3, { caption: 'Readings' });
      const r = layout(sop([{ ...newBlock('text'), body: lorem(fill * 12) }, t]), measure);
      const capPage = r.pages.findIndex((p) => texts(p, t.id).includes('Readings'));
      expect(texts(r.pages[capPage], t.id)).toContain('R0 first cell');
    }
  });
});

describe('callouts', () => {
  it('draws label, icon, tinted box and bar', () => {
    const c = callout('warning', 'Hazardous voltage. **Isolate** before work.', 'Live parts');
    const r = layout(sop([c]), measure);
    const boxes = r.pages[0].boxes.filter((b) => b.bid === c.id);
    const t = texts(r.pages[0], c.id);
    expect(t).toEqual(expect.arrayContaining(['WARNING', 'Live parts']));
    expect(t.some((x) => x.trim() === 'Isolate')).toBe(true);
    expect(boxes.some((b) => b.t === 'tri')).toBe(true);
    expect(boxes.filter((b) => b.t === 'rect').length).toBeGreaterThanOrEqual(2);
    const note = callout('note', 'FYI');
    expect(layout(sop([note]), measure).pages[0].boxes.some((b) => b.bid === note.id && b.t === 'circle')).toBe(true);
  });

  it('keeps a short callout whole and still splits a very long one', () => {
    for (let fill = 30; fill < 70; fill += 2) {
      const c = callout('caution', 'Line one.\nLine two.\nLine three.');
      const r = layout(sop([{ ...newBlock('text'), body: lorem(fill * 12) }, c]), measure);
      expect(r.blocks[c.id].startPage).toBe(r.blocks[c.id].endPage);
    }
    const big = callout('danger', Array.from({ length: 80 }, (_, i) => `Hazard line ${i}`).join('\n'));
    const r = layout(sop([big]), measure);
    expect(r.blocks[big.id].endPage).toBeGreaterThan(r.blocks[big.id].startPage);
  });

  it('indents tables and callouts that follow a step', () => {
    const s = step('Isolate', 'Do it.');
    const c = callout('warning', 'Careful');
    const t = table(1, 2);
    const loose = callout('note', 'General');
    const blocks = [section('A'), s, c, t, section('B'), loose];
    expect(attachments(blocks)).toEqual({ [c.id]: s.id, [t.id]: s.id });
    const r = layout(sop(blocks), measure);
    const minX = (id) => Math.min(...r.pages[0].boxes.filter((b) => b.bid === id && b.t === 'rect').map((b) => b.x));
    expect(minX(c.id)).toBeCloseTo(20 + 12);
    expect(minX(t.id)).toBeCloseTo(20 + 12);
    expect(minX(loose.id)).toBeCloseTo(20);
  });

  it('writes triangles and circles to the PDF', () => {
    const doc = sop([callout('danger', 'x'), callout('tip', 'y'), table(3)]);
    const pdf = writePdf(layout(doc, measure), doc);
    expect(pdf.internal.getNumberOfPages()).toBe(1);
  });
});

describe('photos', () => {
  const photo = (w, h, patch = {}) => ({ ...newBlock('image'), imageId: 'img1', w, h, ...patch });

  it('sizes a photo as a share of the column, centred, keeping its aspect ratio', () => {
    const p = photo(1600, 1200, { size: 'medium' });
    const r = layout(sop([p]), measure);
    const img = r.pages[0].boxes.find((b) => b.t === 'image');
    expect(img.w).toBeCloseTo(170 * 0.5);
    expect(img.h).toBeCloseTo(img.w * 0.75);
    expect(img.x + img.w / 2).toBeCloseTo(105);
  });

  it('caps a tall portrait photo so it never fills the page', () => {
    const p = photo(900, 1600, { size: 'full' });
    const r = layout(sop([p]), measure);
    const img = r.pages[0].boxes.find((b) => b.t === 'image');
    expect(img.h).toBeLessThanOrEqual((297 - 25 - 22) * 0.6 + 0.01);
    expect(img.w / img.h).toBeCloseTo(900 / 1600);
  });

  it('numbers captioned photos as figures and keeps the caption with the photo', () => {
    const a = photo(1600, 1200, { caption: 'Panel front' });
    const b = photo(1600, 1200);
    const c = photo(1600, 1200, { caption: 'Isolator' });
    const n = computeNumbers([a, b, c]);
    expect([n[a.id], n[b.id], n[c.id]]).toEqual(['Figure 1', undefined, 'Figure 2']);
    for (let fill = 20; fill < 70; fill += 3) {
      const r = layout(sop([{ ...newBlock('text'), body: lorem(fill * 12) }, a]), measure);
      const imgPage = r.pages.findIndex((p) => p.boxes.some((x) => x.t === 'image'));
      expect(texts(r.pages[imgPage], a.id)).toContain('Panel front');
    }
  });

  it('moves a photo that does not fit to the next page whole', () => {
    const p = photo(1600, 1200, { size: 'full' });
    const r = layout(sop([{ ...newBlock('text'), body: lorem(500) }, p]), measure);
    const pages = r.pages.filter((pg) => pg.boxes.some((x) => x.bid === p.id));
    expect(pages.length).toBe(1);
    const img = pages[0].boxes.find((x) => x.t === 'image');
    expect(img.y + img.h).toBeLessThanOrEqual(297 - 22 + 0.01);
  });

  it('indents a photo under the step it follows, and holds space before a photo is added', () => {
    const s = step('Open the panel');
    const p = photo(1600, 1200, { size: 'full' });
    const empty = { ...newBlock('image') };
    const r = layout(sop([s, p, empty]), measure);
    const img = r.pages[0].boxes.find((b) => b.t === 'image');
    expect(img.x).toBeCloseTo(20 + 12);
    expect(r.pages[0].boxes.some((b) => b.bid === empty.id && b.t === 'rect')).toBe(true);
  });

  it('embeds stored photos from export assets', () => {
    const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
    const doc = sop([photo(1, 1), photo(1, 1)]);
    const r = layout(doc, measure);
    const raw = writePdf(r, doc, { images: { img1: JPEG } }).output();
    expect((raw.match(/\/Subtype \/Image/g) || []).length).toBe(1);
  });
});
