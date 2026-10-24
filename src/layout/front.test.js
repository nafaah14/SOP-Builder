import { describe, it, expect } from 'vitest';
import { layout } from './engine';
import { createMeasurer } from './measure';
import { newSop, newBlock, applyTemplate, SCHEMA_VERSION } from '../model/defaults';
import { migrate } from '../model/migrate';
import { PRESETS } from '../templates/presets';
import { writePdf } from '../render/pdfWriter';

const measure = createMeasurer();
const section = (title) => ({ ...newBlock('section'), title });
const step = (title, body = '') => ({ ...newBlock('step'), title, body });
const lorem = (n) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');
const texts = (page) => page.boxes.filter((b) => b.t === 'text').map((b) => b.text);
// 1x1 transparent PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function bigSop(sections = 6, steps = 12, words = 40) {
  const blocks = [];
  for (let s = 0; s < sections; s++) {
    blocks.push(section(`Section ${s + 1}`));
    for (let i = 0; i < steps; i++) blocks.push(step(`Step ${s + 1}-${i + 1} ${'long title words '.repeat(i % 3)}`, lorem(words)));
  }
  return { ...newSop('Big SOP'), docNo: 'SOP-X-001', blocks };
}

describe('front matter', () => {
  it('orders cover, revision history, contents, body', () => {
    const r = layout(bigSop(2, 3), measure);
    expect(r.pages[0].kind).toBe('cover');
    expect(texts(r.pages[1])).toContain('REVISION HISTORY');
    expect(texts(r.pages[2])).toContain('CONTENTS');
    expect(r.bodyStartPage).toBe(4);
  });

  it('prints no header or footer on the cover and counts it in Page X of Y', () => {
    const r = layout(bigSop(2, 3), measure);
    expect(texts(r.pages[0]).some((t) => t.startsWith('Page '))).toBe(false);
    expect(texts(r.pages[1])).toContain(`Page 2 of ${r.pageCount}`);
    expect(texts(r.pages[r.pageCount - 1])).toContain(`Page ${r.pageCount} of ${r.pageCount}`);
  });

  it('cover shows details and the approval table', () => {
    const doc = bigSop(1, 1);
    doc.control.approved = { name: 'A. Manager', position: 'Head of Ops', date: '2026-10-01' };
    const t = texts(layout(doc, measure).pages[0]);
    for (const s of ['Big SOP', 'SOP-X-001', 'Prepared by', 'Reviewed by', 'Approved by', 'A. Manager', 'Head of Ops', '1 Oct 2026', 'Uncontrolled when printed']) {
      expect(t).toContain(s);
    }
  });

  it('every front-matter switch removes its pages', () => {
    const doc = bigSop(2, 3);
    const all = layout(doc, measure).pageCount;
    expect(layout({ ...doc, front: { ...doc.front, cover: false } }, measure).pageCount).toBe(all - 1);
    expect(layout({ ...doc, front: { ...doc.front, revisionHistory: false } }, measure).pageCount).toBe(all - 1);
    expect(layout({ ...doc, front: { ...doc.front, toc: false } }, measure).pageCount).toBe(all - 1);
  });

  it('without a cover the body opens with the title block', () => {
    const doc = bigSop(1, 1);
    const r = layout({ ...doc, front: { ...doc.front, cover: false, revisionHistory: false, toc: false } }, measure);
    expect(texts(r.pages[0])).toContain('Big SOP');
  });
});

describe('contents', () => {
  const tocPages = (r) => r.pages.filter((p) => texts(p).includes('CONTENTS') || p.boxes.some((b) => b.bid === '__toc'));

  it('lists every section and step with the page it actually starts on', () => {
    const doc = bigSop(6, 12);
    const r = layout(doc, measure);
    const links = tocPages(r).flatMap((p) => p.boxes.filter((b) => b.t === 'link'));
    const heads = doc.blocks.filter((b) => b.kind === 'section' || b.kind === 'step');
    expect(links.length).toBe(heads.length);
    heads.forEach((b, i) => expect(links[i].page).toBe(r.blocks[b.id].startPage));
  });

  it('stays correct when the contents itself takes two pages', () => {
    const doc = bigSop(8, 14, 25);
    const r = layout(doc, measure);
    expect(tocPages(r).length).toBeGreaterThanOrEqual(2);
    const links = tocPages(r).flatMap((p) => p.boxes.filter((b) => b.t === 'link'));
    const heads = doc.blocks.filter((b) => b.kind === 'section' || b.kind === 'step');
    heads.forEach((b, i) => {
      expect(links[i].page).toBe(r.blocks[b.id].startPage);
      // and the body page really does carry that block's text
      expect(r.pages[links[i].page - 1].boxes.some((x) => x.bid === b.id)).toBe(true);
    });
  });

  it('depth 1 lists sections only', () => {
    const doc = bigSop(3, 4);
    const r = layout({ ...doc, front: { ...doc.front, tocDepth: 1 } }, measure);
    const links = tocPages(r).flatMap((p) => p.boxes.filter((b) => b.t === 'link'));
    expect(links.length).toBe(3);
  });
});

describe('revision history', () => {
  it('repeats the header row on every page and never splits a row', () => {
    const doc = bigSop(1, 1);
    doc.revisions = Array.from({ length: 70 }, (_, i) => ({ id: String(i), rev: String(i), date: '2026-01-01', description: `Change ${i} ${lorem(i % 4 * 6)}`, author: 'QA' }));
    const r = layout(doc, measure);
    const revPages = r.pages.filter((p) => p.boxes.some((b) => b.bid === '__rev'));
    expect(revPages.length).toBeGreaterThanOrEqual(2);
    for (const p of revPages) expect(texts(p)).toContain('Description of change');
    for (let i = 0; i < 70; i++) {
      const on = revPages.filter((p) => texts(p).includes(`Change ${i}`) || texts(p).some((t) => t.startsWith(`Change ${i} `)));
      expect(on.length).toBe(1);
    }
  });

  it('falls back to an initial-issue row', () => {
    const r = layout(bigSop(1, 1), measure);
    expect(texts(r.pages[1])).toContain('Initial issue');
  });
});

describe('templates and migration', () => {
  it('applies a template as a copy', () => {
    const t = { ...PRESETS[1], company: 'Acme Power', logo: { dataUrl: PNG, w: 1, h: 1 } };
    const doc = applyTemplate(newSop('X'), t);
    expect(doc.brand.company).toBe('Acme Power');
    expect(doc.style.accent).toBe(t.accent);
    t.company = 'Changed later';
    expect(doc.brand.company).toBe('Acme Power');
    const r = layout(doc, measure);
    expect(r.pages[0].boxes.some((b) => b.t === 'image')).toBe(true);
    // header logo on body pages
    expect(r.pages[r.pageCount - 1].boxes.some((b) => b.t === 'image')).toBe(true);
  });

  it('migrates a v1 document without losing content', () => {
    const v1 = { ...newSop('Old') };
    delete v1.front; delete v1.control; delete v1.revisions; delete v1.brand; delete v1.reviewDate;
    v1.schemaVersion = 1;
    const d = migrate(v1);
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(d.style.align).toBe('justify');
    expect(d.style.font).toBe('helvetica');
    expect(d.blocks).toEqual(v1.blocks);
    expect(d.front.cover).toBe(true);
    expect(d.control.prepared.name).toBe('');
    expect(() => layout(d, measure)).not.toThrow();
  });

  it('every cover style lays out on A4 portrait and Letter landscape', () => {
    for (const style of ['classic', 'band', 'minimal', 'boxed', 'sidebar', 'centered']) {
      for (const page of [{ size: 'A4', orientation: 'portrait' }, { size: 'Letter', orientation: 'landscape' }]) {
        const doc = bigSop(1, 1);
        doc.brand = { ...doc.brand, coverStyle: style, company: 'Acme', logo: { dataUrl: PNG, w: 4, h: 1 } };
        doc.page = { ...doc.page, ...page };
        const r = layout(doc, measure);
        for (const b of r.pages[0].boxes) {
          if (b.t === 'text') {
            expect(b.y).toBeLessThanOrEqual(r.h);
            expect(b.x).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });
});

describe('pdf writer', () => {
  it('embeds images and contents links', () => {
    const doc = applyTemplate(bigSop(3, 4), { ...PRESETS[1], logo: { dataUrl: PNG, w: 1, h: 1 } });
    const r = layout(doc, measure);
    const pdf = writePdf(r, doc);
    expect(pdf.internal.getNumberOfPages()).toBe(r.pageCount);
    const raw = pdf.output();
    expect(raw).toContain('/Subtype /Image');
    // embedded once (image + its alpha mask), not once per page
    expect((raw.match(/\/Subtype \/Image/g) || []).length).toBeLessThanOrEqual(2);
    expect(raw).toContain('/Subtype /Link');
  });
});
