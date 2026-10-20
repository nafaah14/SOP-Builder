import { X } from 'lucide-react';
import { HEADER_FOOTER_TOKENS, PAGE_SIZES } from '../model/defaults';

const ACCENTS = ['#1B2A41', '#0E4C92', '#1F6F50', '#8A1C1C', '#5B3A86', '#333333'];

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

function SlotRow({ label, value, onChange }) {
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

export function SettingsSheet({ doc, set, onClose }) {
  const patch = (p, key) => set((d) => ({ ...d, ...p }), key);
  const patchPage = (p) => set((d) => ({ ...d, page: { ...d.page, ...p } }));
  const patchMargins = (p) => set((d) => ({ ...d, page: { ...d.page, margins: { ...d.page.margins, ...p } } }), 'margins');
  const patchStyle = (p) => set((d) => ({ ...d, style: { ...d.style, ...p } }));

  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Document settings">
        <div className="sheet-head">
          <h2>Document</h2>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>

        <div className="sheet-section">Details</div>
        <Field label="Title">
          <input className="input" value={doc.title} onChange={(e) => patch({ title: e.target.value }, 'title')} />
        </Field>
        <div className="grid-2">
          <Field label="Document number">
            <input className="input" value={doc.docNo} placeholder="SOP-OPS-001" onChange={(e) => patch({ docNo: e.target.value }, 'docNo')} />
          </Field>
          <Field label="Revision">
            <input className="input" value={doc.revision} onChange={(e) => patch({ revision: e.target.value }, 'rev')} />
          </Field>
          <Field label="Effective date">
            <input className="input" type="date" value={doc.effectiveDate} onChange={(e) => patch({ effectiveDate: e.target.value })} />
          </Field>
          <Field label="Department">
            <input className="input" value={doc.department} onChange={(e) => patch({ department: e.target.value }, 'dept')} />
          </Field>
        </div>

        <div className="sheet-section">Page</div>
        <div className="grid-2">
          <Field label="Size">
            <select className="input" value={doc.page.size} onChange={(e) => patchPage({ size: e.target.value })}>
              {Object.entries(PAGE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Orientation">
            <select className="input" value={doc.page.orientation} onChange={(e) => patchPage({ orientation: e.target.value })}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </Field>
        </div>
        <div className="grid-4">
          {['top', 'right', 'bottom', 'left'].map((k) => (
            <Field key={k} label={`${k[0].toUpperCase()}${k.slice(1)} (mm)`}>
              <input
                className="input"
                type="number"
                min={10}
                max={50}
                value={doc.page.margins[k]}
                onChange={(e) => patchMargins({ [k]: Math.min(50, Math.max(10, Number(e.target.value) || 10)) })}
              />
            </Field>
          ))}
        </div>

        <div className="sheet-section">Style</div>
        <Field label="Accent colour">
          <div className="swatches">
            {ACCENTS.map((c) => (
              <button
                key={c}
                className={`swatch${doc.style.accent === c ? ' on' : ''}`}
                style={{ background: c }}
                title={c}
                onClick={() => patchStyle({ accent: c })}
              />
            ))}
          </div>
        </Field>
        <label className="check">
          <input type="checkbox" checked={doc.style.sectionNewPage} onChange={(e) => patchStyle({ sectionNewPage: e.target.checked })} />
          Start each section on a new page
        </label>

        <div className="sheet-section">Header &amp; footer</div>
        <SlotRow label="Header" value={doc.header} onChange={(v) => patch({ header: v }, 'header')} />
        <SlotRow label="Footer" value={doc.footer} onChange={(v) => patch({ footer: v }, 'footer')} />
        <div className="field-hint">Fields: {HEADER_FOOTER_TOKENS.join(' ')}</div>
      </div>
    </div>
  );
}
