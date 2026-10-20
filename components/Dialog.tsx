"use client";
import { useEffect, useRef } from "react";

/** Native <dialog>: focus trapping, Esc to close and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dlg" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="stack">
          <h2>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function DialogButtons({ confirm, onConfirm, onCancel, pending, disabled }: {
  confirm: string; onConfirm: () => void; onCancel: () => void; pending?: boolean; disabled?: boolean;
}) {
  return (
    <div className="grid2">
      <button className="btn primary" onClick={onConfirm} disabled={pending || disabled}>{pending ? "Saving…" : confirm}</button>
      <button className="btn" onClick={onCancel} disabled={pending}>Cancel</button>
    </div>
  );
}
