import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Undo2, Redo2, Settings2, Eye, Download, ListTree } from 'lucide-react';
import { getDoc, saveDoc } from '../storage/local';
import { useHistory } from './useHistory';
import { Canvas } from './Canvas';
import { Outline } from './Outline';
import { PreviewPane } from './PreviewPane';
import { SettingsSheet } from './SettingsSheet';
import { Toast } from './Toast';
import { layout } from '../layout/engine';
import { sharedMeasurer } from '../layout/measure';
import { writePdf, pdfFileName } from '../render/pdfWriter';
import * as ops from '../model/ops';
import { BLOCK_KINDS, newBlock } from '../model/defaults';

const measure = sharedMeasurer();
const WIDE = '(min-width: 1100px)';

function useMedia(q) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

export function Editor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [initial, setInitial] = useState(undefined);

  useEffect(() => {
    getDoc(id).then((d) => setInitial(d || null));
  }, [id]);

  if (initial === undefined) return <div className="loading">Loading…</div>;
  if (initial === null) {
    return (
      <div className="empty">
        <h2>SOP not found</h2>
        <button className="btn" onClick={() => nav('/')}>Back to all SOPs</button>
      </div>
    );
  }
  return <EditorInner key={initial.id} initial={initial} />;
}

function EditorInner({ initial }) {
  const nav = useNavigate();
  const { doc, set, undo, redo, canUndo, canRedo } = useHistory(initial);
  const wide = useMedia(WIDE);
  const [showPreview, setShowPreview] = useState(() => window.matchMedia(WIDE).matches);
  const [showOutline, setShowOutline] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState(null);
  const [saved, setSaved] = useState(true);
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; }, [doc]);

  // Layout runs on a deferred copy so typing never waits on pagination.
  const deferred = useDeferredValue(doc);
  const result = useMemo(() => layout(deferred, measure), [deferred]);

  // autosave
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return undefined; }
    setSaved(false);
    const t = setTimeout(() => saveDoc(doc).then(() => setSaved(true)), 400);
    return () => clearTimeout(t);
  }, [doc]);

  const jump = useCallback((blockId) => {
    const el = document.getElementById(`block-${blockId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 900);
    if (!wide) { setShowOutline(false); setShowPreview(false); }
  }, [wide]);

  const act = useMemo(() => ({
    insert: (index, kind) => {
      const block = newBlock(kind);
      set((d) => ops.insertBlock(d, index, block)[0]);
      requestAnimationFrame(() => {
        document.querySelector(`#block-${block.id} input, #block-${block.id} textarea`)?.focus();
      });
    },
    update: (bid, patch, key) => set((d) => ops.updateBlock(d, bid, patch), key),
    nudge: (bid, delta) => set((d) => ops.nudgeBlock(d, bid, delta)),
    move: (from, to) => set((d) => ops.moveBlock(d, from, to)),
    duplicate: (bid) => set((d) => ops.duplicateBlock(d, bid)[0]),
    remove: (bid) => {
      const index = docRef.current.blocks.findIndex((b) => b.id === bid);
      const removed = docRef.current.blocks[index];
      if (!removed) return;
      set((d) => ops.removeBlock(d, bid));
      setToast({
        text: `${BLOCK_KINDS[removed.kind]} deleted`,
        action: () => set((d) => ops.restoreBlock(d, removed, index)),
      });
    },
    moveSectionBy: (sid, delta) => set((d) => {
      const secs = d.blocks.filter((b) => b.kind === 'section');
      const i = secs.findIndex((s) => s.id === sid);
      if (delta < 0) return i > 0 ? ops.moveSection(d, sid, secs[i - 1].id) : d;
      if (i < 0 || i >= secs.length - 1) return d;
      return ops.moveSection(d, sid, secs[i + 2]?.id ?? null);
    }),
  }), [set]);

  const exportPdf = useCallback(() => {
    writePdf(layout(doc, measure), doc).save(pdfFileName(doc));
  }, [doc]);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
      else if (k === 'p') { e.preventDefault(); setShowPreview((v) => !v); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className={`editor${wide && showPreview ? ' with-preview' : ''}`}>
      <header className="topbar">
        <button className="icon-btn" title="All SOPs" onClick={() => nav('/')}><ArrowLeft size={18} /></button>
        {!wide && <button className="icon-btn" title="Outline" onClick={() => setShowOutline(true)}><ListTree size={18} /></button>}
        <input
          className="doc-title-input"
          value={doc.title}
          placeholder="SOP title"
          onChange={(e) => set((d) => ({ ...d, title: e.target.value }), 'title')}
        />
        <span className={`save-state small${saved ? '' : ' pending'}`}>{saved ? 'Saved' : 'Saving…'}</span>
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={18} /></button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}><Redo2 size={18} /></button>
        <button className="icon-btn" title="Document settings" onClick={() => setShowSettings('details')}><Settings2 size={18} /></button>
        <button className={`btn sm${showPreview ? ' on' : ''}`} title="Preview (Ctrl+P)" onClick={() => setShowPreview((v) => !v)}>
          <Eye size={15} /> <span className="hide-sm">Preview</span>
        </button>
        <button className="btn sm primary" onClick={exportPdf}><Download size={15} /> <span className="hide-sm">PDF</span></button>
      </header>

      <div className="workspace">
        {wide && <Outline doc={doc} result={result} act={act} onJump={jump} />}
        <main className="canvas-scroll">
          <Canvas doc={doc} result={result} act={act} onOpenSettings={(tab) => setShowSettings(tab || 'details')} />
        </main>
        {showPreview && (
          <PreviewPane
            result={result}
            overlay={!wide}
            onClose={() => setShowPreview(false)}
            onExport={exportPdf}
            onJump={jump}
          />
        )}
      </div>

      {!wide && showOutline && (
        <div className="sheet-scrim" onClick={() => setShowOutline(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <Outline doc={doc} result={result} act={act} onJump={jump} />
          </div>
        </div>
      )}
      {showSettings && <SettingsSheet doc={doc} set={set} initialTab={showSettings} onClose={() => setShowSettings(false)} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
