const header = { left: '{title}', center: '', right: '{docNo} Rev {rev}' };
const footer = { left: '{company}', center: '', right: 'Page {page} of {pages}' };

/** Seeded on first run so a new SOP looks finished before any setup. */
export const PRESETS = [
  {
    id: 'preset-classic', name: 'Classic', accent: '#1B2A41', coverStyle: 'classic',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: false,
    docType: 'Standard Operating Procedure', header, footer, isDefault: true,
  },
  {
    id: 'preset-band', name: 'Corporate band', accent: '#0E4C92', coverStyle: 'band',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: true,
    docType: 'Standard Operating Procedure', header, footer, isDefault: false,
  },
  {
    id: 'preset-minimal', name: 'Minimal', accent: '#333333', coverStyle: 'minimal',
    company: '', logo: null, footerNote: '', headerLogo: false,
    docType: 'Standard Operating Procedure', header: { left: '{title}', center: '', right: '' }, footer: { left: '', center: 'Page {page} of {pages}', right: '' }, isDefault: false,
  },
];
