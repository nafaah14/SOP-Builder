import { useRef } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { HEADER_FOOTER_TOKENS } from '../model/defaults';
import { COVER_STYLES } from '../layout/cover';
import { fileToImage } from './imageUpload';

export const ACCENTS = ['#1B2A41', '#0E4C92', '#1F6F50', '#8A1C1C', '#B8541F', '#5B3A86', '#333333'];

export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function SlotRow({ label, value, onChange }) {
  return (
    <div className="slot-row">
      <div className="field-label">{label}</div>
      <div className="slot-grid">
        {['left', 'center', 'right'].map((pos) => (
          <input
            key={pos}
            className="input"
            placeholder={pos}
            value={value?.[pos] || ''}
            onChange={(e) => onChange({ ...value, [pos]: e.target.value })}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Branding fields shared by the template editor and an SOP's Branding tab.
 * `value` is flat: { company, logo, accent, coverStyle, footerNote, headerLogo, docType, header?, footer? }.
 */
export function BrandFields({ value, onChange, showHeaderFooter = false }) {
  const fileRef = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    onChange({ logo: await fileToImage(f, { maxSide: 600, type: 'image/png' }) });
  };

  return (
    <>
      <Field label="Company / organisation">
        <input className="input" value={value.company || ''} onChange={(e) => onChange({ company: e.target.value }, 'company')} />
      </Field>
      <Field label="Logo">
        <div className="logo-row">
          {value.logo?.dataUrl ? (
            <img className="logo-thumb" src={value.logo.dataUrl} alt="Logo" />
          ) : (
            <div className="logo-thumb empty muted small">No logo</div>
          )}
          <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> {value.logo ? 'Replace' : 'Upload'}</button>
          {value.logo && <button type="button" className="icon-btn danger" title="Remove logo" onClick={() => onChange({ logo: null })}><Trash2 size={15} /></button>}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>
      </Field>
      <label className="check">
        <input type="checkbox" checked={!!value.headerLogo} onChange={(e) => onChange({ headerLogo: e.target.checked })} />
        Small logo in the page header
      </label>
      <Field label="Cover style">
        <div className="seg">
          {Object.entries(COVER_STYLES).map(([k, label]) => (
            <button type="button" key={k} className={`seg-btn${(value.coverStyle || 'classic') === k ? ' on' : ''}`} onClick={() => onChange({ coverStyle: k })}>{label}</button>
          ))}
        </div>
      </Field>
      <Field label="Accent colour">
        <div className="swatches">
          {ACCENTS.map((c) => (
            <button
              type="button"
              key={c}
              className={`swatch${value.accent === c ? ' on' : ''}`}
              style={{ background: c }}
              title={c}
              onClick={() => onChange({ accent: c })}
            />
          ))}
          <input className="swatch-custom" type="color" value={value.accent || '#1B2A41'} onChange={(e) => onChange({ accent: e.target.value.toUpperCase() }, 'accent')} title="Custom colour" />
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Document type (cover label)">
          <input className="input" value={value.docType || ''} placeholder="Standard Operating Procedure" onChange={(e) => onChange({ docType: e.target.value }, 'docType')} />
        </Field>
        <Field label="Cover footer note">
          <input className="input" value={value.footerNote || ''} placeholder="Uncontrolled when printed" onChange={(e) => onChange({ footerNote: e.target.value }, 'footerNote')} />
        </Field>
      </div>
      {showHeaderFooter && (
        <>
          <SlotRow label="Header" value={value.header} onChange={(v) => onChange({ header: v }, 'header')} />
          <SlotRow label="Footer" value={value.footer} onChange={(v) => onChange({ footer: v }, 'footer')} />
          <div className="field-hint">Fields: {HEADER_FOOTER_TOKENS.join(' ')}</div>
        </>
      )}
    </>
  );
}
