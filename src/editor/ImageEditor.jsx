import { useRef, useState } from 'react';
import { Camera, Upload, RefreshCw } from 'lucide-react';
import { IMAGE_SIZES } from '../model/defaults';
import { useImageUrl } from '../storage/images';
import { imageFiles } from './imageUpload';

export function ImageEditor({ block, number, onChange, onFiles }) {
  const camRef = useRef(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const url = useImageUrl(block.imageId);

  const take = async (e) => {
    const files = imageFiles(e.target.files);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try { await onFiles(files); } finally { setBusy(false); }
  };

  const pickers = (
    <>
      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={take} />
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={take} />
    </>
  );

  if (!block.imageId) {
    return (
      <div className="img-empty">
        {pickers}
        <div className="img-empty-actions">
          <button className="btn" onClick={() => camRef.current?.click()} disabled={busy}><Camera size={16} /> Take photo</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={16} /> Upload</button>
        </div>
        <div className="muted small">{busy ? 'Processing…' : 'or paste a screenshot, or drop image files here'}</div>
      </div>
    );
  }

  const frac = IMAGE_SIZES[block.size]?.frac ?? 0.75;
  return (
    <div className="img-ed">
      {pickers}
      <div className="img-frame-wrap">
        <div className="img-frame" style={{ width: `${frac * 100}%` }}>
          {url ? <img src={url} alt={block.caption || 'Photo'} className={block.frame !== false ? 'framed' : ''} /> : <div className="img-loading" style={{ aspectRatio: `${block.w} / ${block.h}` }} />}
        </div>
      </div>
      <div className="img-caption-row">
        {number && <span className="tbl-num">{number}</span>}
        <input
          className="tbl-caption"
          value={block.caption || ''}
          placeholder="Caption (optional — numbered when filled)"
          onChange={(e) => onChange({ caption: e.target.value }, `${block.id}:caption`)}
        />
      </div>
      <div className="img-opts">
        <div className="seg">
          {Object.entries(IMAGE_SIZES).map(([k, v]) => (
            <button key={k} type="button" className={`seg-btn${block.size === k ? ' on' : ''}`} onClick={() => onChange({ size: k })}>{v.label}</button>
          ))}
        </div>
        <label className="check sm"><input type="checkbox" checked={block.frame !== false} onChange={(e) => onChange({ frame: e.target.checked })} /> Border</label>
        <span className="spacer" />
        <button className="chip sm" onClick={() => camRef.current?.click()} disabled={busy}><Camera size={13} /> Retake</button>
        <button className="chip sm" onClick={() => fileRef.current?.click()} disabled={busy}><RefreshCw size={13} /> Replace</button>
      </div>
    </div>
  );
}
