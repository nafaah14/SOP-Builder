import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getTemplate, saveTemplate, setDefaultTemplate } from '../storage/templates';
import { BrandFields, Field } from '../editor/BrandFields';
import { layout } from '../layout/engine';
import { sharedMeasurer } from '../layout/measure';
import { PagePreview } from '../render/PagePreview';
import { sampleDoc } from './sample';

const measure = sharedMeasurer();

export function TemplateEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState(null);
  const [saved, setSaved] = useState(true);
  const first = useRef(true);

  useEffect(() => { getTemplate(id).then((x) => setT(x || false)); }, [id]);
  useEffect(() => {
    if (!t) return undefined;
    if (first.current) { first.current = false; return undefined; }
    setSaved(false);
    const h = setTimeout(() => saveTemplate(t).then(() => setSaved(true)), 300);
    return () => clearTimeout(h);
  }, [t]);

  const r = useMemo(() => (t ? layout(sampleDoc(t), measure) : null), [t]);

  if (t === null) return <div className="loading">Loading…</div>;
  if (t === false) return <div className="empty"><h2>Template not found</h2><button className="btn" onClick={() => nav('/templates')}>Back</button></div>;

  const onChange = (p) => setT((x) => ({ ...x, ...p }));
  const body = r.pages.find((p) => p.kind === 'body');

  return (
    <div className="tpl-editor">
      <header className="topbar">
        <button className="icon-btn" title="Templates" onClick={() => nav('/templates')}><ArrowLeft size={18} /></button>
        <input className="doc-title-input" value={t.name} onChange={(e) => onChange({ name: e.target.value })} />
        <span className="save-state small">{saved ? 'Saved' : 'Saving…'}</span>
        {!t.isDefault && (
          <button className="btn sm" onClick={async () => { await setDefaultTemplate(t.id); setT((x) => ({ ...x, isDefault: true })); }}>Use for new SOPs</button>
        )}
      </header>
      <div className="tpl-editor-body">
        <div className="tpl-form">
          <Field label="Template name">
            <input className="input" value={t.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
          <BrandFields value={t} onChange={onChange} showHeaderFooter />
        </div>
        <div className="tpl-previews">
          <div className="tpl-preview-page"><PagePreview page={r.pages[0]} w={r.w} h={r.h} number={1} /><div className="muted small">Cover</div></div>
          {body && <div className="tpl-preview-page"><PagePreview page={body} w={r.w} h={r.h} number={2} /><div className="muted small">Procedure page</div></div>}
        </div>
      </div>
    </div>
  );
}
