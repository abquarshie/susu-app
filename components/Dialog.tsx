"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./icons";

/** Native <dialog>: focus trapping, Esc to close and the backdrop come from the browser. A bottom sheet on phones. */
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
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <div className="sheet-body">
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="btn ghost min-h-9 text-muted" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
          </div>
          <div className="stack">{children}</div>
        </div>
      )}
    </dialog>
  );
}

export function DialogButtons({ confirm, onConfirm, onCancel, pending, disabled }: {
  confirm: string; onConfirm: () => void; onCancel: () => void; pending?: boolean; disabled?: boolean;
}) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-2">
      <button className="btn" onClick={onCancel} disabled={pending}>Cancel</button>
      <button className="btn primary" onClick={onConfirm} disabled={pending || disabled}>{pending ? "Saving…" : confirm}</button>
    </div>
  );
}
