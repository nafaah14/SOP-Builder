import { useCallback, useRef, useState } from 'react';

const LIMIT = 100;
const COALESCE_MS = 1000;

/**
 * Snapshot undo. Documents are immutable, so a snapshot is just a reference.
 * Typing into the same field within a second coalesces into one undo step —
 * otherwise Ctrl+Z would walk back one keystroke at a time.
 */
export function useHistory(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });
  const last = useRef({ key: null, t: 0 });

  const set = useCallback((updater, key = null) => {
    const now = Date.now();
    const coalesce = key !== null && last.current.key === key && now - last.current.t < COALESCE_MS;
    last.current = { key, t: now };
    setState((s) => {
      const next = typeof updater === 'function' ? updater(s.present) : updater;
      if (next === s.present) return s;
      return {
        past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    last.current = { key: null, t: 0 };
    setState((s) => (s.past.length
      ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] }
      : s));
  }, []);

  const redo = useCallback(() => {
    last.current = { key: null, t: 0 };
    setState((s) => (s.future.length
      ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) }
      : s));
  }, []);

  return { doc: state.present, set, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
