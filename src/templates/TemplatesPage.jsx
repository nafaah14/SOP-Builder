import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Copy, Trash2, Star } from 'lucide-react';
import { listTemplates, saveTemplate, deleteTemplate, setDefaultTemplate, copyTemplate } from '../storage/templates';
import { PRESETS } from './presets';
import { newId } from '../model/defaults';
import { layout } from '../layout/engine';
import { sharedMeasurer } from '../layout/measure';
import { PagePreview } from '../render/PagePreview';
import { sampleDoc } from './sample';

const measure = sharedMeasurer();

function CoverThumb({ template }) {
  const r = useMemo(() => layout(sampleDoc(template), measure), [template]);
  return (
    <div className="tpl-thumb">
      <PagePreview page={r.pages[0]} w={r.w} h={r.h} number={1} />
    </div>
  );
}

export function TemplatesPage() {
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const refresh = () => listTemplates().then(setList);
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    const t = { ...structuredClone(PRESETS[0]), id: newId(), name: 'New template', isDefault: false };
    await saveTemplate(t);
    nav(`/templates/${t.id}`);
  };
  const duplicate = async (t) => { await saveTemplate(copyTemplate(t)); refresh(); };
  const remove = async (t) => {
    if (!window.confirm(`Delete template “${t.name}”? SOPs already using it keep their branding.`)) return;
    await deleteTemplate(t.id);
    refresh();
  };
  const makeDefault = async (t) => { await setDefaultTemplate(t.id); refresh(); };

  return (
    <div className="list-page">
      <header className="list-head">
        <div className="row-gap">
          <button className="icon-btn" title="All SOPs" onClick={() => nav('/')}><ArrowLeft size={18} /></button>
          <div>
            <h1>Templates</h1>
            <p className="muted">Branding set up once: logo, company, colours, cover, header and footer.</p>
          </div>
        </div>
        <button className="btn primary" onClick={create}><Plus size={16} /> New template</button>
      </header>
      <div className="tpl-grid">
        {list?.map((t) => (
          <div key={t.id} className="tpl-card" onClick={() => nav(`/templates/${t.id}`)}>
            <CoverThumb template={t} />
            <div className="tpl-meta">
              <div className="tpl-name">{t.name}{t.isDefault && <span className="badge">Default</span>}</div>
              <div className="doc-card-actions" onClick={(e) => e.stopPropagation()}>
                {!t.isDefault && <button className="icon-btn" title="Use for new SOPs" onClick={() => makeDefault(t)}><Star size={15} /></button>}
                <button className="icon-btn" title="Duplicate" onClick={() => duplicate(t)}><Copy size={15} /></button>
                {list.length > 1 && <button className="icon-btn danger" title="Delete" onClick={() => remove(t)}><Trash2 size={15} /></button>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
