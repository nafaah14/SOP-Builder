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
import { exportAssets } from '../render/exportAssets';
import { putImage, imageDataUrl } from '../storage/images';
import { fileToPhoto, imageFiles } from './imageUpload';
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
    addPhotos: async (files, where = {}) => {
      const photos = [];
      for (const f of files) {
        try {
          const p = await fileToPhoto(f);
          photos.push({ imageId: await putImage(p), w: p.w, h: p.h });
        } catch (err) {
          console.error(err);
          setToast({ text: `Couldn't read ${f.name || 'that image'}` });
        }
      }
      if (photos.length) set((d) => ops.placePhotos(d, photos, where));
    },
    moveSectionBy: (sid, delta) => set((d) => {
      const secs = d.blocks.filter((b) => b.kind === 'section');
      const i = secs.findIndex((s) => s.id === sid);
      if (delta < 0) return i > 0 ? ops.moveSection(d, sid, secs[i - 1].id) : d;
      if (i < 0 || i >= secs.length - 1) return d;
      return ops.moveSection(d, sid, secs[i + 2]?.id ?? null);
    }),
  }), [set]);

  const [exporting, setExporting] = useState(false);
  const exportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const r = layout(doc, measure);
      const assets = await exportAssets(r, { loadImage: imageDataUrl });
      writePdf(r, doc, assets).save(pdfFileName(doc));
    } catch (err) {
      console.error(err);
      setToast({ text: `Export failed: ${err.message}` });
    } finally {
      setExporting(false);
    }
  }, [doc]);

  // Paste a screenshot anywhere, or drop photos on the canvas: they land after
  // the block you're in (or fill it, if it's an empty photo block).
  const blockAt = (el) => {
    const id = el?.closest?.('.block')?.id?.replace('block-', '');
    return docRef.current.blocks.find((b) => b.id === id) || null;
  };
  const placeFiles = useCallback((files, target) => {
    const b = blockAt(target);
    act.addPhotos(files, b?.kind === 'image' && !b.imageId ? { into: b.id } : { after: b?.id ?? null });
  }, [act]);
  useEffect(() => {
    const onPaste = (e) => {
      const files = imageFiles(e.clipboardData?.files);
      if (!files.length) return;
      e.preventDefault();
      placeFiles(files, document.activeElement);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [placeFiles]);
  const [dragging, setDragging] = useState(false);
  const dropProps = {
    onDragOver: (e) => {
      if (![...e.dataTransfer.types].includes('Files')) return;
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: (e) => { if (e.currentTarget === e.target) setDragging(false); },
    onDrop: (e) => {
      const files = imageFiles(e.dataTransfer.files);
      setDragging(false);
      if (!files.length) return;
      e.preventDefault();
      placeFiles(files, e.target);
    },
  };

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
        <button className="btn sm primary" onClick={exportPdf} disabled={exporting}><Download size={15} /> <span className="hide-sm">{exporting ? 'Preparing…' : 'PDF'}</span></button>
      </header>

      <div className="workspace">
        {wide && <Outline doc={doc} result={result} act={act} onJump={jump} />}
        <main className={`canvas-scroll${dragging ? ' drop-target' : ''}`} {...dropProps}>
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
