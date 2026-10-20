import { useState } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { PagePreview } from '../render/PagePreview';

/**
 * The exact pages the PDF will contain. Tapping text on a page jumps the
 * canvas to the block it came from.
 */
export function PreviewPane({ result, onClose, onExport, onJump, overlay }) {
  const [zoom, setZoom] = useState(1);
  if (!result) return null;

  const onClick = (e) => {
    const t = e.target.closest('[data-bid]');
    if (t && onJump) onJump(t.getAttribute('data-bid'));
  };

  return (
    <aside className={`preview${overlay ? ' overlay' : ''}`}>
      <div className="preview-bar">
        <strong>Preview</strong>
        <span className="muted small">{result.pageCount} page{result.pageCount === 1 ? '' : 's'}</span>
        <span className="spacer" />
        <button className="icon-btn" title="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut size={16} /></button>
        <button className="icon-btn" title="Zoom in" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}><ZoomIn size={16} /></button>
        <button className="btn sm primary" onClick={onExport}><Download size={14} /> PDF</button>
        <button className="icon-btn" title="Close preview" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="preview-pages" onClick={onClick}>
        {result.pages.map((p, i) => (
          <div key={i} className="preview-page" style={{ width: `${zoom * 100}%` }}>
            <PagePreview page={p} w={result.w} h={result.h} number={i + 1} />
            <div className="preview-page-no muted small">{i + 1}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}
