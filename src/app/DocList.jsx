import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Copy, Trash2, Palette } from 'lucide-react';
import { listDocs, saveDoc, softDeleteDoc, restoreDoc } from '../storage/local';
import { defaultTemplate } from '../storage/templates';
import { newSop, copySop } from '../model/defaults';
import { fmtDate } from '../layout/engine';
import { Toast } from '../editor/Toast';

export function DocList() {
  const nav = useNavigate();
  const [docs, setDocs] = useState(null);
  const [toast, setToast] = useState(null);

  const refresh = () => listDocs().then(setDocs);
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    const doc = await saveDoc(newSop('Untitled SOP', await defaultTemplate()));
    nav(`/doc/${doc.id}`);
  };

  const duplicate = async (d) => {
    await saveDoc(copySop(d));
    refresh();
  };

  const remove = async (d) => {
    await softDeleteDoc(d.id);
    refresh();
    setToast({ text: `Deleted “${d.title}”`, action: async () => { await restoreDoc(d.id); refresh(); } });
  };

  return (
    <div className="list-page">
      <header className="list-head">
        <div>
          <h1>SOP Builder</h1>
          <p className="muted">Standard operating procedures, laid out for you.</p>
        </div>
        <div className="row-gap">
          <button className="btn" onClick={() => nav('/templates')}><Palette size={16} /> Templates</button>
          <button className="btn primary" onClick={create}><Plus size={16} /> New SOP</button>
        </div>
      </header>

      {docs && !docs.length && (
        <div className="empty">
          <FileText size={32} />
          <h2>No SOPs yet</h2>
          <p className="muted">Start one and add steps — spacing, numbering and page breaks are handled for you.</p>
          <button className="btn primary" onClick={create}><Plus size={16} /> New SOP</button>
        </div>
      )}

      <div className="doc-grid">
        {docs?.map((d) => (
          <div key={d.id} className="doc-card" onClick={() => nav(`/doc/${d.id}`)}>
            <div className="doc-card-main">
              <div className="doc-no">{[d.docNo, d.revision !== '' && `Rev ${d.revision}`].filter(Boolean).join(' · ') || 'No document number'}</div>
              <div className="doc-title">{d.title || 'Untitled SOP'}</div>
              <div className="muted small">
                {d.blocks.filter((b) => b.kind === 'step').length} steps · edited {fmtDate(d.updatedAt)}
              </div>
            </div>
            <div className="doc-card-actions" onClick={(e) => e.stopPropagation()}>
              <button className="icon-btn" title="Duplicate" onClick={() => duplicate(d)}><Copy size={16} /></button>
              <button className="icon-btn" title="Delete" onClick={() => remove(d)}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <footer className="about muted small">v{__APP_VERSION__} · build {__BUILD_ID__}</footer>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
