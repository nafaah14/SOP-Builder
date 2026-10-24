import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { layout } from './engine';
import { createMeasurer } from './measure';
import { segments, needsFallback } from './winansi';
import { newSop, newBlock } from '../model/defaults';
import { writePdf } from '../render/pdfWriter';

const measure = createMeasurer();
const fonts = {
  'dejavu:regular': readFileSync(new URL('../../public/fonts/DejaVuSans.ttf', import.meta.url)).toString('base64'),
  'dejavu:bold': readFileSync(new URL('../../public/fonts/DejaVuSans-Bold.ttf', import.meta.url)).toString('base64'),
};
const sop = (body) => ({
  ...newSop('T'),
  front: { cover: false, revisionHistory: false, toc: false, tocDepth: 2 },
  blocks: [{ ...newBlock('text'), body }],
});

describe('symbols outside Helvetica', () => {
  it('splits text into Helvetica and fallback runs', () => {
    expect(segments('R ≥ 100 MΩ ✓')).toEqual([
      { text: 'R ', fallback: false }, { text: '≥', fallback: true }, { text: ' 100 M', fallback: false },
      { text: 'Ω', fallback: true }, { text: ' ', fallback: false }, { text: '✓', fallback: true },
    ]);
    expect(needsFallback('café – “quoted” € 25°C ±2 ²')).toBe(false);
  });

  it('measures fallback glyphs from the DejaVu table, not as missing', () => {
    expect(measure.width('Ω', { size: 10 })).toBeGreaterThan(measure.width('i', { size: 10 }));
    expect(measure.width('MΩ', { size: 10 })).toBeCloseTo(measure.width('M', { size: 10 }) + measure.width('Ω', { size: 10 }), 5);
  });

  it('marks fallback runs in the layout and places them after the Helvetica text', () => {
    const r = layout(sop('Insulation ≥ 100 MΩ'), measure);
    expect(r.usesFallback).toBe(true);
    const boxes = r.pages[0].boxes.filter((b) => b.t === 'text' && b.size === 10);
    const omega = boxes.find((b) => b.text === 'Ω');
    const ge = boxes.find((b) => b.text === '≥');
    expect(omega.font).toBe('fallback');
    expect(ge.font).toBe('fallback');
    expect(omega.x).toBeGreaterThan(ge.x);
    expect(layout(sop('Plain text 25°C'), measure).usesFallback).toBe(false);
  });

  it('embeds DejaVu only when needed', () => {
    const doc = sop('Resistance ≥ 100 MΩ, Δt → 0 ✓');
    const r = layout(doc, measure);
    expect(r.fontFiles).toEqual(['dejavu:regular']);
    const raw = writePdf(r, doc, { fonts }).output();
    expect(raw).toContain('/FontFile2');
    expect(raw).toMatch(/dejavu/i);
    const plain = sop('Plain');
    expect(layout(plain, measure).fontFiles).toEqual([]);
    expect(writePdf(layout(plain, measure), plain, { fonts }).output()).not.toContain('/FontFile2');
  });
});
