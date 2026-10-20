import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ArrowUp, ArrowDown, Copy, Trash2, Scissors } from 'lucide-react';
import { AutoTextarea } from './AutoTextarea';
import { BLOCK_KINDS } from '../model/defaults';

const BODY_HINT = 'One line per paragraph. "- " for bullets, "1. " for numbered, **bold**, *italic*.';

function Actions({ block, isFirst, isLast, act }) {
  return (
    <div className="block-actions">
      <button className="icon-btn" title="Move up" disabled={isFirst} onClick={() => act.nudge(block.id, -1)}><ArrowUp size={15} /></button>
      <button className="icon-btn" title="Move down" disabled={isLast} onClick={() => act.nudge(block.id, 1)}><ArrowDown size={15} /></button>
      <button className="icon-btn" title="Duplicate" onClick={() => act.duplicate(block.id)}><Copy size={15} /></button>
      <button className="icon-btn danger" title="Delete" onClick={() => act.remove(block.id)}><Trash2 size={15} /></button>
    </div>
  );
}

export function BlockCard({ block, number, meta, isFirst, isLast, act, accent }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Translate.toString(transform), transition, '--accent': accent };
  const upd = (patch, field) => act.update(block.id, patch, `${block.id}:${field}`);
  const split = meta && meta.endPage > meta.startPage;

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`block-${block.id}`}
      className={`block block-${block.kind}${isDragging ? ' dragging' : ''}`}
    >
      <button className="drag-handle" ref={setActivatorNodeRef} {...attributes} {...listeners} title="Drag to reorder">
        <GripVertical size={16} />
      </button>

      <div className="block-body">
        {block.kind === 'section' && (
          <div className="section-row">
            <span className="num">{number}</span>
            <input
              className="section-input"
              value={block.title}
              placeholder="Section title"
              onChange={(e) => upd({ title: e.target.value }, 'title')}
            />
          </div>
        )}

        {block.kind === 'step' && (
          <div className="step-grid">
            <span className="num">{number}</span>
            <div>
              <input
                className="step-title"
                value={block.title}
                placeholder="Step title (optional)"
                onChange={(e) => upd({ title: e.target.value }, 'title')}
              />
              <AutoTextarea
                className="body-ta"
                value={block.body}
                placeholder="Instructions…"
                title={BODY_HINT}
                onChange={(v) => upd({ body: v }, 'body')}
              />
            </div>
          </div>
        )}

        {block.kind === 'text' && (
          <AutoTextarea
            className="body-ta"
            value={block.body}
            placeholder="Text…"
            title={BODY_HINT}
            onChange={(v) => upd({ body: v }, 'body')}
          />
        )}

        {block.kind === 'pageBreak' && (
          <div className="pagebreak-row"><Scissors size={14} /> {BLOCK_KINDS.pageBreak} — next block starts a new page</div>
        )}

        {split && <div className="split-note">Continues onto page {meta.endPage}</div>}
      </div>

      <Actions block={block} isFirst={isFirst} isLast={isLast} act={act} />
    </div>
  );
}
