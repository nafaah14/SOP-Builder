import { ulid } from 'ulid';

export const SCHEMA_VERSION = 1;

export const PAGE_SIZES = {
  A4: { w: 210, h: 297, label: 'A4' },
  Letter: { w: 215.9, h: 279.4, label: 'Letter' },
};

export const BLOCK_KINDS = {
  section: 'Section',
  step: 'Step',
  text: 'Text',
  pageBreak: 'Page break',
};

export const HEADER_FOOTER_TOKENS = ['{title}', '{docNo}', '{rev}', '{page}', '{pages}', '{date}', '{department}'];

export const newId = () => ulid();

export function newBlock(kind) {
  const base = { id: newId(), kind };
  switch (kind) {
    case 'section': return { ...base, title: '' };
    case 'step': return { ...base, title: '', body: '' };
    case 'text': return { ...base, body: '' };
    case 'pageBreak': return base;
    default: throw new Error(`Unknown block kind: ${kind}`);
  }
}

export function newSop(title = 'Untitled SOP') {
  const now = new Date().toISOString();
  return {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    title,
    docNo: '',
    revision: '0',
    effectiveDate: now.slice(0, 10),
    department: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    page: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 25, right: 20, bottom: 22, left: 20 },
    },
    style: {
      accent: '#1B2A41',
      sectionNewPage: false,
    },
    header: { left: '{title}', center: '', right: '{docNo} Rev {rev}' },
    footer: { left: '{department}', center: '', right: 'Page {page} of {pages}' },
    blocks: [
      { ...newBlock('section'), title: 'Purpose' },
      { ...newBlock('text'), body: 'Describe what this procedure achieves and when it applies.' },
      { ...newBlock('section'), title: 'Procedure' },
      { ...newBlock('step'), title: 'First step', body: 'What to do, in plain words.' },
    ],
  };
}

export function pageDims(page) {
  const s = PAGE_SIZES[page.size] || PAGE_SIZES.A4;
  return page.orientation === 'landscape' ? { w: s.h, h: s.w } : { w: s.w, h: s.h };
}

/** Deep-ish copy of a block with fresh ids — used by duplicate. */
export function cloneBlock(block) {
  return { ...structuredClone(block), id: newId() };
}

/** A copy of a whole SOP to start a new one from — fresh ids, same content. */
export function copySop(doc) {
  return {
    ...structuredClone(doc),
    id: newId(),
    title: `${doc.title} (copy)`,
    createdAt: new Date().toISOString(),
    blocks: doc.blocks.map(cloneBlock),
  };
}
