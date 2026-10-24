import { TriangleAlert, Info } from 'lucide-react';
import { CALLOUTS } from '../model/defaults';
import { AutoTextarea } from './AutoTextarea';

export function CalloutEditor({ block, onChange }) {
  const def = CALLOUTS[block.variant] || CALLOUTS.note;
  const Icon = def.icon === 'hazard' ? TriangleAlert : Info;
  return (
    <div className="callout-ed" style={{ '--c': def.color }}>
      <div className="callout-variants">
        {Object.entries(CALLOUTS).map(([k, v]) => (
          <button
            key={k}
            className={`callout-chip${block.variant === k ? ' on' : ''}`}
            style={{ '--c': v.color }}
            onClick={() => onChange({ variant: k })}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="callout-box">
        <div className="callout-label">
          <Icon size={16} />
          <span>{def.label.toUpperCase()}</span>
          <input
            className="callout-title"
            value={block.title || ''}
            placeholder="Title (optional)"
            onChange={(e) => onChange({ title: e.target.value }, `${block.id}:title`)}
          />
        </div>
        <AutoTextarea
          className="body-ta"
          value={block.body}
          placeholder="What the reader must know…"
          onChange={(v) => onChange({ body: v }, `${block.id}:body`)}
        />
      </div>
    </div>
  );
}
