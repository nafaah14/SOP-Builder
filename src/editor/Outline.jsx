import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Sections and steps as a tree. Clicking jumps the canvas; a section's
 * arrows move it together with all of its steps.
 */
export function Outline({ doc, result, act, onJump }) {
  const sections = doc.blocks.filter((b) => b.kind === 'section');
  return (
    <nav className="outline">
      <div className="outline-head">Outline</div>
      {!doc.blocks.some((b) => b.kind === 'section' || b.kind === 'step') && (
        <div className="muted small pad">Add a section or step to see it here.</div>
      )}
      {doc.blocks.map((b) => {
        if (b.kind !== 'section' && b.kind !== 'step') return null;
        const n = result?.numbers[b.id];
        const page = result?.blocks[b.id]?.startPage;
        if (b.kind === 'section') {
          const si = sections.indexOf(b);
          return (
            <div key={b.id} className="ol-item ol-section">
              <button className="ol-link" onClick={() => onJump(b.id)}>
                <span className="ol-num">{n}</span>
                <span className="ol-text">{b.title || 'Untitled section'}</span>
                {page && <span className="ol-page">p{page}</span>}
              </button>
              <span className="ol-move">
                <button className="icon-btn xs" title="Move section up" disabled={si === 0} onClick={() => act.moveSectionBy(b.id, -1)}><ChevronUp size={14} /></button>
                <button className="icon-btn xs" title="Move section down" disabled={si === sections.length - 1} onClick={() => act.moveSectionBy(b.id, 1)}><ChevronDown size={14} /></button>
              </span>
            </div>
          );
        }
        return (
          <button key={b.id} className="ol-item ol-step ol-link" onClick={() => onJump(b.id)}>
            <span className="ol-num">{n}</span>
            <span className="ol-text">{b.title || firstLine(b.body) || 'Untitled step'}</span>
            {page && <span className="ol-page">p{page}</span>}
          </button>
        );
      })}
    </nav>
  );
}

const firstLine = (s = '') => s.split('\n').find((l) => l.trim())?.replace(/[*_]/g, '').slice(0, 60);
