"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";

type Kind = "success" | "warning" | "error";
type Toast = { id: number; message: string; kind: Kind };
type Result = { ok: boolean; message: string; kind?: Kind };

const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {});

export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((message: string, kind: Kind = "success") => {
    if (!message) return;
    const id = ++seq.current;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "success" ? 3500 : 7000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.message}</div>)}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Run a Server Action, show its message as a toast, and report whether it succeeded. */
export function useAction() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = useCallback(
    (fn: () => Promise<Result>, onOk?: () => void) =>
      start(async () => {
        try {
          const r = await fn();
          toast(r.message, r.kind ?? (r.ok ? "success" : "error"));
          if (r.ok) onOk?.();
        } catch {
          toast("Could not reach the server. Check your connection and try again.", "error");
        }
      }),
    [toast],
  );
  return { run, pending };
}

/** Show a one-off toast passed from the server (e.g. ?timeout=1). */
export function FlashOnMount({ message, kind = "warning" }: { message: string; kind?: Kind }) {
  const toast = useToast();
  useEffect(() => toast(message, kind), [message, kind, toast]);
  return null;
}
