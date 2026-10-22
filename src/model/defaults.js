import { ulid } from 'ulid';

export const SCHEMA_VERSION = 2;

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

export const HEADER_FOOTER_TOKENS = ['{title}', '{docNo}', '{rev}', '{page}', '{pages}', '{date}', '{department}', '{company}'];

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

export const DEFAULT_FRONT = { cover: true, revisionHistory: true, toc: true, tocDepth: 2 };
export const DEFAULT_BRAND = {
  company: '',
  logo: null,
  coverStyle: 'classic',
  footerNote: 'Uncontrolled when printed',
  headerLogo: false,
  docType: 'Standard Operating Procedure',
};
const person = () => ({ name: '', position: '', date: '' });
export const emptyControl = () => ({ prepared: person(), reviewed: person(), approved: person() });

export function newSop(title = 'Untitled SOP', template = null) {
  const now = new Date().toISOString();
  const doc = {
    id: newId(),
    schemaVersion: SCHEMA_VERSION,
    title,
    docNo: '',
    revision: '0',
    effectiveDate: now.slice(0, 10),
    department: '',
    reviewDate: '',
    templateId: null,
    front: { ...DEFAULT_FRONT },
    control: emptyControl(),
    revisions: [],
    brand: { ...DEFAULT_BRAND },
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
  return template ? applyTemplate(doc, template) : doc;
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

/**
 * A template is copied into the SOP, not linked: an issued controlled
 * document must not change because someone edited the template later.
 * "Re-apply template" calls this again on purpose.
 */
export function applyTemplate(doc, t) {
  return {
    ...doc,
    templateId: t.id,
    style: { ...doc.style, accent: t.accent || doc.style.accent },
    header: { ...t.header },
    footer: { ...t.footer },
    brand: {
      ...doc.brand,
      company: t.company || '',
      logo: t.logo || null,
      coverStyle: t.coverStyle || 'classic',
      footerNote: t.footerNote ?? '',
      headerLogo: !!t.headerLogo,
      docType: t.docType || DEFAULT_BRAND.docType,
    },
  };
}
