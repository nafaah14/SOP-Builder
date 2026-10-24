import { useEffect, useRef } from 'react';

/**
 * Props for a backdrop that closes on a real click on it — one where the
 * press *started* on the backdrop. Selecting text in a sheet and letting go
 * outside it ends with a click on the backdrop too, and must not close it.
 * Escape closes as well.
 */
export function useBackdrop(onClose) {
  const downOnSelf = useRef(false);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return {
    onPointerDown: (e) => { downOnSelf.current = e.target === e.currentTarget; },
    onClick: (e) => {
      if (downOnSelf.current && e.target === e.currentTarget) close.current?.();
      downOnSelf.current = false;
    },
  };
}

/** Close a popover on a press outside `ref`, or on Escape — not when the pointer merely wanders off. */
export function useDismiss(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose]);
}
