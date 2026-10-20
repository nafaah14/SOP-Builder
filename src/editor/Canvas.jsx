import { Fragment, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from './dndModifiers';
import { Plus, Heading, ListOrdered, AlignLeft, Scissors } from 'lucide-react';
import { BlockCard } from './BlockCard';
import { fmtDate } from '../layout/engine';

const KINDS = [
  { kind: 'step', label: 'Step', icon: ListOrdered },
  { kind: 'section', label: 'Section', icon: Heading },
  { kind: 'text', label: 'Text', icon: AlignLeft },
  { kind: 'pageBreak', label: 'Page break', icon: Scissors },
];

function InsertBar({ index, onInsert, always = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`insert-bar${open ? ' open' : ''}${always ? ' always' : ''}`}>
      {!open ? (
        <button className="insert-plus" title="Add here" onClick={() => setOpen(true)}><Plus size={14} />{always && <span>Add</span>}</button>
      ) : (
        <div className="insert-menu" onMouseLeave={() => setOpen(false)}>
          {KINDS.map(({ kind, label, icon: Icon }) => (
            <button key={kind} className="chip" onClick={() => { onInsert(index, kind); setOpen(false); }}>
              <Icon size={14} /> {label}
            </button>
          ))}
          <button className="chip ghost" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

const PageMarker = ({ page }) => (
  <div className="page-marker" aria-label={`Page ${page} starts here`}>
    <span>Page {page}</span>
  </div>
);

/**
 * Page markers come from the layout engine, not from guessing at screen
 * heights: a block that starts on a later page than the previous block ended
 * gets a marker above it.
 */
function markersFor(blocks, layoutBlocks) {
  const out = {};
  let lastEnd = 1;
  for (const b of blocks) {
    const m = layoutBlocks[b.id];
    if (!m || b.kind === 'pageBreak') continue;
    if (m.startPage > lastEnd) out[b.id] = m.startPage;
    lastEnd = m.endPage;
  }
  return out;
}

export function Canvas({ doc, result, act, onOpenSettings }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const markers = result ? markersFor(doc.blocks, result.blocks) : {};

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const from = doc.blocks.findIndex((b) => b.id === active.id);
    const to = doc.blocks.findIndex((b) => b.id === over.id);
    act.move(from, to);
  };

  const meta = [doc.docNo && `Doc No. ${doc.docNo}`, doc.revision !== '' && `Rev ${doc.revision}`, doc.effectiveDate && fmtDate(doc.effectiveDate)]
    .filter(Boolean).join(' · ');

  return (
    <div className="canvas" style={{ '--accent': doc.style.accent }}>
      <div className="title-card" onClick={onOpenSettings} role="button" tabIndex={0}>
        <div className="title-card-title">{doc.title || 'Untitled SOP'}</div>
        <div className="muted small">{meta || 'Tap to set document number, revision and dates'}</div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={doc.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <InsertBar index={0} onInsert={act.insert} />
          {doc.blocks.map((b, i) => (
            <Fragment key={b.id}>
              {markers[b.id] && <PageMarker page={markers[b.id]} />}
              <BlockCard
                block={b}
                number={result?.numbers[b.id]}
                meta={result?.blocks[b.id]}
                isFirst={i === 0}
                isLast={i === doc.blocks.length - 1}
                act={act}
                accent={doc.style.accent}
              />
              <InsertBar index={i + 1} onInsert={act.insert} always={i === doc.blocks.length - 1} />
            </Fragment>
          ))}
          {!doc.blocks.length && <InsertBar index={0} onInsert={act.insert} always />}
        </SortableContext>
      </DndContext>
      {result && <div className="canvas-end muted small">End of document · {result.pageCount} page{result.pageCount === 1 ? '' : 's'}</div>}
    </div>
  );
}
