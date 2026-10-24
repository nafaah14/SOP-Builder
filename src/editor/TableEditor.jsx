import { useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { AutoTextarea } from './AutoTextarea';
import * as T from '../model/table';
import { useBackdrop } from './backdrop';

// fixed-position so the table's horizontal scroller can't clip it
function Menu({ items, onClose, rect }) {
  const backdrop = useBackdrop(onClose);
  const left = Math.max(8, Math.min(rect.right - 190, window.innerWidth - 198));
  const below = rect.bottom + 4;
  const style = below + 360 > window.innerHeight
    ? { left, bottom: Math.max(8, window.innerHeight - rect.top + 4) }
    : { left, top: below };
  return (
    <>
      <div className="menu-scrim" {...backdrop} />
      <div className="menu" role="menu" style={style}>
        {items.map((it, i) => (it === '-' ? <div key={i} className="menu-sep" /> : (
          <button
            key={i}
            role="menuitem"
            className={`menu-item${it.danger ? ' danger' : ''}${it.on ? ' on' : ''}`}
            disabled={it.disabled}
            onClick={() => { it.run(); onClose(); }}
          >
            {it.label}
          </button>
        )))}
      </div>
    </>
  );
}

/**
 * Spreadsheet-like table editing on the canvas. Pasting cells copied from
 * Excel, Sheets or Word fills the grid from the cell you paste into, adding
 * rows and columns as needed. Tab from the last cell adds a row.
 */
export function TableEditor({ block, number, onChange }) {
  const [menu, setMenu] = useState(null);
  const t = block;
  const set = (next, key) => onChange({ columns: next.columns, rows: next.rows }, key);
  const total = t.columns.reduce((a, c) => a + c.w, 0) || 1;

  // focus a cell that may not exist yet: done right after the render that adds it
  const pendingFocus = useRef(null);
  const focusCell = (r, c) => { pendingFocus.current = `${r}:${c}`; };
  useLayoutEffect(() => {
    if (!pendingFocus.current) return;
    const el = document.querySelector(`#block-${t.id} [data-cell="${pendingFocus.current}"]`);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const onPaste = (r, c) => (e) => {
    const text = e.clipboardData.getData('text/plain');
    if (!T.looksLikeGrid(text)) return;
    e.preventDefault();
    set(T.pasteGrid(t, r, c, T.parseGrid(text)));
  };

  const onKeyDown = (r, c) => (e) => {
    if (e.key === 'Tab' && !e.shiftKey && r === t.rows.length - 1 && c === t.columns.length - 1) {
      e.preventDefault();
      set(T.addRow(t));
      focusCell(r + 1, 0);
    }
  };

  const colMenu = (c) => [
    { label: 'Align left', on: (t.columns[c].align || 'left') === 'left', run: () => set(T.setColumn(t, c, { align: 'left' })) },
    { label: 'Align centre', on: t.columns[c].align === 'center', run: () => set(T.setColumn(t, c, { align: 'center' })) },
    { label: 'Align right', on: t.columns[c].align === 'right', run: () => set(T.setColumn(t, c, { align: 'right' })) },
    '-',
    { label: 'Wider', run: () => set(T.resizeColumn(t, c, 1.25)) },
    { label: 'Narrower', run: () => set(T.resizeColumn(t, c, 0.8)) },
    '-',
    { label: 'Move left', disabled: c === 0, run: () => set(T.moveColumn(t, c, -1)) },
    { label: 'Move right', disabled: c === t.columns.length - 1, run: () => set(T.moveColumn(t, c, 1)) },
    { label: 'Insert column left', run: () => set(T.addColumn(t, c)) },
    { label: 'Insert column right', run: () => set(T.addColumn(t, c + 1)) },
    '-',
    { label: 'Delete column', danger: true, disabled: t.columns.length <= 1, run: () => set(T.removeColumn(t, c)) },
  ];
  const rowMenu = (r) => [
    { label: 'Move up', disabled: r === 0, run: () => set(T.moveRow(t, r, -1)) },
    { label: 'Move down', disabled: r === t.rows.length - 1, run: () => set(T.moveRow(t, r, 1)) },
    { label: 'Insert row above', run: () => set(T.addRow(t, r)) },
    { label: 'Insert row below', run: () => set(T.addRow(t, r + 1)) },
    '-',
    { label: 'Delete row', danger: true, run: () => set(T.removeRow(t, r)) },
  ];

  return (
    <div className="tbl">
      <div className="tbl-head">
        {number && <span className="tbl-num">{number}</span>}
        <input
          className="tbl-caption"
          value={t.caption || ''}
          placeholder="Caption (optional — numbered when filled)"
          onChange={(e) => onChange({ caption: e.target.value }, `${t.id}:caption`)}
        />
      </div>
      <div className="tbl-opts">
        <label className="check sm"><input type="checkbox" checked={t.headerRow !== false} onChange={(e) => onChange({ headerRow: e.target.checked })} /> Header row</label>
        <label className="check sm"><input type="checkbox" checked={!!t.striped} onChange={(e) => onChange({ striped: e.target.checked })} /> Striped</label>
        <span className="spacer" />
        <button className="chip sm" onClick={() => { set(T.addRow(t)); focusCell(t.rows.length, 0); }}><Plus size={13} /> Row</button>
        <button className="chip sm" onClick={() => set(T.addColumn(t))}><Plus size={13} /> Column</button>
      </div>
      <div className="tbl-scroll">
        <table className="tbl-edit" style={{ minWidth: `${t.columns.length * 110 + 36}px` }}>
          <colgroup>
            {t.columns.map((c) => <col key={c.id} style={{ width: `${(c.w / total) * 100}%` }} />)}
            <col style={{ width: 36 }} />
          </colgroup>
          {t.headerRow !== false && (
            <thead>
              <tr>
                {t.columns.map((c, j) => (
                  <th key={c.id} className={`al-${c.align || 'left'}`}>
                    <div className="th-wrap">
                      <AutoTextarea
                        className="cell-ta th-ta"
                        value={c.label}
                        placeholder={`Column ${j + 1}`}
                        data-cell={`-1:${j}`}
                        onPaste={onPaste(-1, j)}
                        onChange={(v) => set(T.setColumn(t, j, { label: v }), `${t.id}:h:${c.id}`)}
                      />
                      <button className="icon-btn xs" tabIndex={-1} title="Column options" onClick={(e) => setMenu({ type: 'col', i: j, rect: e.currentTarget.getBoundingClientRect() })}>
                        <MoreHorizontal size={14} />
                      </button>
                    </div>
                    {menu?.type === 'col' && menu.i === j && <Menu items={colMenu(j)} rect={menu.rect} onClose={() => setMenu(null)} />}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
          )}
          <tbody>
            {t.rows.map((row, r) => (
              <tr key={row.id}>
                {t.columns.map((c, j) => (
                  <td key={c.id} className={`al-${c.align || 'left'}`}>
                    <AutoTextarea
                      className="cell-ta"
                      value={row.cells[j] ?? ''}
                      data-cell={`${r}:${j}`}
                      onPaste={onPaste(r, j)}
                      onKeyDown={onKeyDown(r, j)}
                      onChange={(v) => set(T.setCell(t, r, j, v), `${t.id}:c:${row.id}:${c.id}`)}
                    />
                  </td>
                ))}
                <td className="row-tools">
                  <button className="icon-btn xs" tabIndex={-1} title="Row options" onClick={(e) => setMenu({ type: 'row', i: r, rect: e.currentTarget.getBoundingClientRect() })}>
                    <MoreHorizontal size={14} />
                  </button>
                  {menu?.type === 'row' && menu.i === r && <Menu items={rowMenu(r)} rect={menu.rect} onClose={() => setMenu(null)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!t.rows.length && <div className="muted small pad">No rows — add one, or paste cells from a spreadsheet into a header cell.</div>}
      <div className="field-hint tbl-hint">Tip: paste cells copied from Excel or Sheets straight into any cell. Tab from the last cell adds a row.</div>
    </div>
  );
}
