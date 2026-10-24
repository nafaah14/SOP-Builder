const header = { left: '{title}', center: '', right: '{docNo} Rev {rev}' };
const footer = { left: '{company}', center: '', right: 'Page {page} of {pages}' };

/** Seeded on first run so a new SOP looks finished before any setup. */
export const PRESETS = [
  {
    id: 'preset-classic', name: 'Classic', accent: '#1B2A41', coverStyle: 'classic', font: 'helvetica', headingFont: 'helvetica',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: false,
    docType: 'Standard Operating Procedure', header, footer, isDefault: true,
  },
  {
    id: 'preset-band', name: 'Corporate band', accent: '#0E4C92', coverStyle: 'band', font: 'open-sans', headingFont: 'inter',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: true,
    docType: 'Standard Operating Procedure', header, footer, isDefault: false,
  },
  {
    id: 'preset-minimal', name: 'Minimal', accent: '#333333', coverStyle: 'minimal', font: 'lato', headingFont: 'lato',
    company: '', logo: null, footerNote: '', headerLogo: false,
    docType: 'Standard Operating Procedure', header: { left: '{title}', center: '', right: '' }, footer: { left: '', center: 'Page {page} of {pages}', right: '' }, isDefault: false,
  },
  {
    id: 'preset-bordered', name: 'Bordered', accent: '#1F3A5F', coverStyle: 'boxed', font: 'source-serif-4', headingFont: 'source-serif-4',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: true,
    docType: 'Standard Operating Procedure', header, footer, isDefault: false,
  },
  {
    id: 'preset-sidebar', name: 'Sidebar', accent: '#1F6F50', coverStyle: 'sidebar', font: 'roboto', headingFont: 'roboto',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: false,
    docType: 'Standard Operating Procedure', header, footer, isDefault: false,
  },
  {
    id: 'preset-centred', name: 'Centred', accent: '#5B3A86', coverStyle: 'centered', font: 'source-serif-4', headingFont: 'merriweather',
    company: '', logo: null, footerNote: 'Uncontrolled when printed', headerLogo: false,
    docType: 'Standard Operating Procedure', header, footer, isDefault: false,
  },
];
