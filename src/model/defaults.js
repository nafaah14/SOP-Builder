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
  table: 'Table',
  callout: 'Callout',
  image: 'Photo',
  pageBreak: 'Page break',
};

/** Photo widths as a share of the text column. */
export const IMAGE_SIZES = {
  small: { label: 'Small', frac: 0.35 },
  medium: { label: 'Medium', frac: 0.5 },
  large: { label: 'Large', frac: 0.75 },
  full: { label: 'Full width', frac: 1 },
};

/** Hazard levels follow the usual signal-word order, most severe first. */
export const CALLOUTS = {
  danger: { label: 'Danger', color: '#B3261E', icon: 'hazard' },
  warning: { label: 'Warning', color: '#C2410C', icon: 'hazard' },
  caution: { label: 'Caution', color: '#A16207', icon: 'hazard' },
  note: { label: 'Note', color: '#1D4ED8', icon: 'info' },
  tip: { label: 'Tip', color: '#15803D', icon: 'info' },
};

export const HEADER_FOOTER_TOKENS = ['{title}', '{docNo}', '{rev}', '{page}', '{pages}', '{date}', '{department}', '{company}'];

export const newId = () => ulid();

export function newTable(cols = 3, rows = 2) {
  return {
    caption: '',
    headerRow: true,
    striped: false,
    columns: Array.from({ length: cols }, (_, i) => ({ id: newId(), label: `Column ${i + 1}`, w: 1, align: 'left' })),
    rows: Array.from({ length: rows }, () => ({ id: newId(), cells: Array(cols).fill('') })),
  };
}

export function newBlock(kind) {
  const base = { id: newId(), kind };
  switch (kind) {
    case 'section': return { ...base, title: '' };
    case 'step': return { ...base, title: '', body: '' };
    case 'text': return { ...base, body: '' };
    case 'table': return { ...base, ...newTable() };
    case 'callout': return { ...base, variant: 'warning', title: '', body: '' };
    case 'image': return { ...base, imageId: null, w: 0, h: 0, caption: '', size: 'large', frame: true };
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
  const b = { ...structuredClone(block), id: newId() };
  if (b.kind === 'table') {
    b.columns = b.columns.map((c) => ({ ...c, id: newId() }));
    b.rows = b.rows.map((r) => ({ ...r, id: newId() }));
  }
  return b;
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
