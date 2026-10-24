import { describe, it, expect } from 'vitest';
import { newSop, newBlock } from './defaults';
import { placePhotos } from './ops';

describe('placePhotos', () => {
  const base = () => ({ ...newSop('x'), blocks: [{ ...newBlock('step'), title: 'a' }, { ...newBlock('image') }, { ...newBlock('step'), title: 'b' }] });
  const ph = (n) => Array.from({ length: n }, (_, i) => ({ imageId: `i${i}`, w: 4, h: 3 }));

  it('fills an empty photo block and adds the rest after it', () => {
    const d = base();
    const out = placePhotos(d, ph(3), { into: d.blocks[1].id });
    expect(out.blocks.map((b) => b.imageId || b.title)).toEqual(['a', 'i0', 'i1', 'i2', 'b']);
  });

  it('inserts after a given block, or at the end', () => {
    const d = base();
    expect(placePhotos(d, ph(1), { after: d.blocks[0].id }).blocks[1].imageId).toBe('i0');
    expect(placePhotos(d, ph(1)).blocks.at(-1).imageId).toBe('i0');
  });
});
