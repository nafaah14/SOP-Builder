import { SCHEMA_VERSION, DEFAULT_FRONT, DEFAULT_BRAND, DEFAULT_STYLE, emptyControl } from './defaults';

/** Bring a stored document up to the current schema. Pure; safe to run on every read. */
export function migrate(doc) {
  if (!doc || (doc.schemaVersion || 1) >= SCHEMA_VERSION) return doc;
  let d = { ...doc };
  if ((d.schemaVersion || 1) < 2) {
    d = {
      ...d,
      reviewDate: d.reviewDate || '',
      templateId: d.templateId ?? null,
      front: { ...DEFAULT_FRONT, ...d.front },
      control: { ...emptyControl(), ...d.control },
      revisions: d.revisions || [],
      brand: { ...DEFAULT_BRAND, ...d.brand },
      schemaVersion: 2,
    };
  }
  if (d.schemaVersion < 3) {
    // fonts, text size and justified paragraphs arrive; existing SOPs pick up the defaults
    d = { ...d, style: { ...DEFAULT_STYLE, ...d.style }, schemaVersion: 3 };
  }
  return d;
}
