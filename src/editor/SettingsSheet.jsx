import { useEffect, useState } from 'react';
import { X, Plus, Trash2, RefreshCw, Save } from 'lucide-react';
import { HEADER_FOOTER_TOKENS, PAGE_SIZES, applyTemplate, newId } from '../model/defaults';
import { setRevisions, nextRev } from '../model/ops';
import { listTemplates, getTemplate, saveTemplate } from '../storage/templates';
import { BrandFields, Field, SlotRow } from './BrandFields';
import { useBackdrop } from './backdrop';

export const TABS = [
  ['details', 'Details'],
  ['approvals', 'Approvals'],
  ['revisions', 'Revisions'],
  ['layout', 'Layout'],
  ['branding', 'Branding'],
];

const today = () => new Date().toISOString().slice(0, 10);

function Details({ doc, patch }) {
  return (
    <>
      <Field label="Title">
        <input className="input" value={doc.title} onChange={(e) => patch({ title: e.target.value }, 'title')} />
      </Field>
      <div className="grid-2">
        <Field label="Document number">
          <input className="input" value={doc.docNo} placeholder="SOP-OPS-001" onChange={(e) => patch({ docNo: e.target.value }, 'docNo')} />
        </Field>
        <Field label="Revision" hint={doc.revisions?.length ? 'Set by the latest row in Revisions' : undefined}>
          <input className="input" value={doc.revision} disabled={!!doc.revisions?.length} onChange={(e) => patch({ revision: e.target.value }, 'rev')} />
        </Field>
        <Field label="Effective date">
          <input className="input" type="date" value={doc.effectiveDate} disabled={!!doc.revisions?.length} onChange={(e) => patch({ effectiveDate: e.target.value })} />
        </Field>
        <Field label="Next review date">
          <input className="input" type="date" value={doc.reviewDate || ''} onChange={(e) => patch({ reviewDate: e.target.value })} />
        </Field>
      </div>
      <Field label="Department">
        <input className="input" value={doc.department} onChange={(e) => patch({ department: e.target.value }, 'dept')} />
      </Field>
    </>
  );
}

function Approvals({ doc, set }) {
  const roles = [['prepared', 'Prepared by'], ['reviewed', 'Reviewed by'], ['approved', 'Approved by']];
  const upd = (role, p, key) => set((d) => ({ ...d, control: { ...d.control, [role]: { ...d.control[role], ...p } } }), key);
  return (
    <>
      <p className="muted small">Shown in the document approval table on the cover. Signatures are left blank for signing on paper.</p>
      {roles.map(([role, label]) => (
        <div key={role} className="group">
          <div className="group-title">{label}</div>
          <div className="grid-3">
            <Field label="Name">
              <input className="input" value={doc.control[role].name} onChange={(e) => upd(role, { name: e.target.value }, `${role}.name`)} />
            </Field>
            <Field label="Position">
              <input className="input" value={doc.control[role].position} onChange={(e) => upd(role, { position: e.target.value }, `${role}.pos`)} />
            </Field>
            <Field label="Date">
              <input className="input" type="date" value={doc.control[role].date} onChange={(e) => upd(role, { date: e.target.value })} />
            </Field>
          </div>
        </div>
      ))}
    </>
  );
}

function Revisions({ doc, set }) {
  const revs = doc.revisions || [];
  const write = (next, key) => set((d) => setRevisions(d, next), key);
  const add = () => {
    const last = revs[revs.length - 1];
    const row = last
      ? { id: newId(), rev: nextRev(last.rev), date: today(), description: '', author: doc.control.prepared.name || '' }
      : { id: newId(), rev: doc.revision || '0', date: doc.effectiveDate || today(), description: 'Initial issue', author: doc.control.prepared.name || '' };
    write([...revs, row]);
  };
  const upd = (id, p, key) => write(revs.map((r) => (r.id === id ? { ...r, ...p } : r)), key);
  return (
    <>
      <p className="muted small">The latest row sets the document's revision and effective date everywhere — cover, header and footer.</p>
      {!revs.length && <p className="muted small">No rows yet; the PDF shows a single "Initial issue" row.</p>}
      {revs.map((r) => (
        <div key={r.id} className="rev-row">
          <input className="input rev-no" value={r.rev} placeholder="Rev" onChange={(e) => upd(r.id, { rev: e.target.value }, `${r.id}.rev`)} />
          <input className="input rev-date" type="date" value={r.date} onChange={(e) => upd(r.id, { date: e.target.value })} />
          <input className="input rev-desc" value={r.description} placeholder="Description of change" onChange={(e) => upd(r.id, { description: e.target.value }, `${r.id}.desc`)} />
          <input className="input rev-author" value={r.author} placeholder="Author" onChange={(e) => upd(r.id, { author: e.target.value }, `${r.id}.author`)} />
          <button className="icon-btn danger" title="Delete row" onClick={() => write(revs.filter((x) => x.id !== r.id))}><Trash2 size={15} /></button>
        </div>
      ))}
      <button className="btn sm" onClick={add}><Plus size={14} /> {revs.length ? 'New revision' : 'Add initial issue'}</button>
    </>
  );
}

function Layout({ doc, set, patch }) {
  const patchPage = (p) => set((d) => ({ ...d, page: { ...d.page, ...p } }));
  const patchMargins = (p) => set((d) => ({ ...d, page: { ...d.page, margins: { ...d.page.margins, ...p } } }), 'margins');
  const patchFront = (p) => set((d) => ({ ...d, front: { ...d.front, ...p } }));
  const patchStyle = (p) => set((d) => ({ ...d, style: { ...d.style, ...p } }));
  return (
    <>
      <div className="sheet-section">Front matter</div>
      <label className="check"><input type="checkbox" checked={doc.front.cover} onChange={(e) => patchFront({ cover: e.target.checked })} /> Cover page</label>
      <label className="check"><input type="checkbox" checked={doc.front.revisionHistory} onChange={(e) => patchFront({ revisionHistory: e.target.checked })} /> Revision history page</label>
      <label className="check"><input type="checkbox" checked={doc.front.toc} onChange={(e) => patchFront({ toc: e.target.checked })} /> Contents page</label>
      {doc.front.toc && (
        <Field label="Contents lists">
          <div className="seg">
            <button type="button" className={`seg-btn${doc.front.tocDepth === 1 ? ' on' : ''}`} onClick={() => patchFront({ tocDepth: 1 })}>Sections</button>
            <button type="button" className={`seg-btn${doc.front.tocDepth !== 1 ? ' on' : ''}`} onClick={() => patchFront({ tocDepth: 2 })}>Sections and steps</button>
          </div>
        </Field>
      )}

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
      <label className="check">
        <input type="checkbox" checked={doc.style.sectionNewPage} onChange={(e) => patchStyle({ sectionNewPage: e.target.checked })} />
        Start each section on a new page
      </label>

      <div className="sheet-section">Header &amp; footer</div>
      <SlotRow label="Header" value={doc.header} onChange={(v) => patch({ header: v }, 'header')} />
      <SlotRow label="Footer" value={doc.footer} onChange={(v) => patch({ footer: v }, 'footer')} />
      <div className="field-hint">Fields: {HEADER_FOOTER_TOKENS.join(' ')}</div>
    </>
  );
}

function Branding({ doc, set }) {
  const [templates, setTemplates] = useState([]);
  const [pick, setPick] = useState(doc.templateId || '');
  const [note, setNote] = useState('');
  useEffect(() => { listTemplates().then(setTemplates); }, []);

  const flat = { ...doc.brand, accent: doc.style.accent };
  const onChange = (p, key) => set((d) => {
    const { accent, ...brand } = p;
    return {
      ...d,
      style: accent ? { ...d.style, accent } : d.style,
      brand: { ...d.brand, ...brand },
    };
  }, key);

  const apply = async () => {
    const t = await getTemplate(pick);
    if (t) {
      set((d) => applyTemplate(d, t));
      setNote(`Applied “${t.name}”.`);
    }
  };
  const saveAs = async () => {
    const name = window.prompt('Name for the new template', doc.brand.company || 'My template');
    if (!name) return;
    const t = {
      id: newId(), name, isDefault: false, accent: doc.style.accent, header: doc.header, footer: doc.footer,
      company: doc.brand.company, logo: doc.brand.logo, coverStyle: doc.brand.coverStyle,
      footerNote: doc.brand.footerNote, headerLogo: doc.brand.headerLogo, docType: doc.brand.docType,
    };
    await saveTemplate(t);
    setTemplates(await listTemplates());
    set((d) => ({ ...d, templateId: t.id }));
    setPick(t.id);
    setNote(`Saved as template “${name}”.`);
  };

  return (
    <>
      <Field label="Template" hint="Applying copies the template into this SOP — later template edits don't change it until you apply again.">
        <div className="row-gap">
          <select className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="" disabled>Choose a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (default)' : ''}</option>)}
          </select>
          <button className="btn sm" disabled={!pick} onClick={apply}>
            <RefreshCw size={14} /> {pick && pick === doc.templateId ? 'Re-apply' : 'Apply'}
          </button>
        </div>
      </Field>
      {note && <div className="note small">{note}</div>}
      <div className="sheet-section">This SOP</div>
      <BrandFields value={flat} onChange={onChange} />
      <button className="btn sm" onClick={saveAs}><Save size={14} /> Save as new template</button>
    </>
  );
}

export function SettingsSheet({ doc, set, onClose, initialTab = 'details' }) {
  const [tab, setTab] = useState(initialTab);
  const patch = (p, key) => set((d) => ({ ...d, ...p }), key);
  const backdrop = useBackdrop(onClose);

  return (
    <div className="sheet-scrim" {...backdrop}>
      <div className="sheet" role="dialog" aria-label="Document settings">
        <div className="sheet-head">
          <h2>Document</h2>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>
        <div className="tab-body">
          {tab === 'details' && <Details doc={doc} patch={patch} />}
          {tab === 'approvals' && <Approvals doc={doc} set={set} />}
          {tab === 'revisions' && <Revisions doc={doc} set={set} />}
          {tab === 'layout' && <Layout doc={doc} set={set} patch={patch} />}
          {tab === 'branding' && <Branding doc={doc} set={set} />}
        </div>
      </div>
    </div>
  );
}
