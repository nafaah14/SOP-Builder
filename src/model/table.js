import { newId } from './defaults';

/** Pure table edits. A table is { columns: [{ id, label, w, align }], rows: [{ id, cells: [] }] }. */

const blankRow = (n) => ({ id: newId(), cells: Array(n).fill('') });

export function setCell(t, r, c, value) {
  return { ...t, rows: t.rows.map((row, i) => (i === r ? { ...row, cells: row.cells.map((v, j) => (j === c ? value : v)) } : row)) };
}

export function setColumn(t, c, patch) {
  return { ...t, columns: t.columns.map((col, j) => (j === c ? { ...col, ...patch } : col)) };
}

export function addRow(t, at = t.rows.length) {
  const rows = [...t.rows];
  rows.splice(at, 0, blankRow(t.columns.length));
  return { ...t, rows };
}

export function removeRow(t, r) {
  return { ...t, rows: t.rows.filter((_, i) => i !== r) };
}

export function moveRow(t, r, delta) {
  const to = r + delta;
  if (to < 0 || to >= t.rows.length) return t;
  const rows = [...t.rows];
  const [row] = rows.splice(r, 1);
  rows.splice(to, 0, row);
  return { ...t, rows };
}

export function addColumn(t, at = t.columns.length) {
  const columns = [...t.columns];
  columns.splice(at, 0, { id: newId(), label: '', w: 1, align: 'left' });
  return {
    ...t,
    columns,
    rows: t.rows.map((row) => {
      const cells = [...row.cells];
      cells.splice(at, 0, '');
      return { ...row, cells };
    }),
  };
}

export function removeColumn(t, c) {
  if (t.columns.length <= 1) return t;
  return {
    ...t,
    columns: t.columns.filter((_, j) => j !== c),
    rows: t.rows.map((row) => ({ ...row, cells: row.cells.filter((_, j) => j !== c) })),
  };
}

export function moveColumn(t, c, delta) {
  const to = c + delta;
  if (to < 0 || to >= t.columns.length) return t;
  const mv = (arr) => {
    const a = [...arr];
    const [x] = a.splice(c, 1);
    a.splice(to, 0, x);
    return a;
  };
  return { ...t, columns: mv(t.columns), rows: t.rows.map((row) => ({ ...row, cells: mv(row.cells) })) };
}

/** Relative widths, clamped so no column can be squeezed to nothing. */
export function resizeColumn(t, c, factor) {
  return setColumn(t, c, { w: Math.min(6, Math.max(0.3, Math.round(t.columns[c].w * factor * 100) / 100)) });
}

/** Tab-separated text (copied from Excel / Sheets / Word) -> rows of cells. */
export function parseGrid(text) {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  return lines.map((l) => l.split('\t'));
}

export const looksLikeGrid = (text) => /\t/.test(text);

/**
 * Paste a grid with its top-left at (r, c), growing the table as needed.
 * r = -1 targets the header row.
 */
export function pasteGrid(t, r, c, grid) {
  let out = t;
  const width = Math.max(...grid.map((g) => g.length));
  while (out.columns.length < c + width) out = addColumn(out);
  const bodyRows = grid.length - (r < 0 ? 1 : 0);
  const startBody = Math.max(r, 0);
  while (out.rows.length < startBody + bodyRows) out = addRow(out);
  grid.forEach((cells, i) => {
    const rr = r + i;
    cells.forEach((v, j) => {
      if (rr < 0) out = setColumn(out, c + j, { label: v.trim() });
      else out = setCell(out, rr, c + j, v.trim());
    });
  });
  return out;
}
