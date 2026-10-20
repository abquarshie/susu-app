"use client";
import { useState } from "react";
import { countCash } from "@/app/actions";
import { EPS, fmtNum, money } from "@/lib/format";
import { Dialog, DialogButtons } from "./Dialog";
import { Icon } from "./icons";
import { useAction } from "./Toaster";

export function CountCashButton({ rev, cashHeld, className = "btn" }: { rev: number; cashHeld: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState(String(cashHeld));
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const diff = money(Number(actual || 0) - cashHeld);

  return (
    <>
      <button className={className} onClick={() => { setActual(String(cashHeld)); setNote(""); setOpen(true); }}>
        <Icon name="wallet" /><span className="max-sm:hidden">Count cash</span><span className="sm:hidden">Count</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Count cash">
        <p className="caption">
          The record says the group holds <b className="text-ink">GHS {fmtNum(cashHeld)}</b>. Enter what you actually counted, including MoMo and bank balances.
        </p>
        <label className="field"><span>Counted (GHS)</span>
          <input className="input big" type="number" min={0} step={10} inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
        <div className={`note ${Math.abs(diff) < EPS ? "ok" : "warn"}`}>
          <Icon name={Math.abs(diff) < EPS ? "check" : "warning"} />
          {Math.abs(diff) < EPS ? "Matches the record." : `GHS ${fmtNum(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the record.`}
        </div>
        <label className="field"><span>Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
        </label>
        <DialogButtons confirm="Save count" pending={pending} onCancel={() => setOpen(false)}
          onConfirm={() => run(() => countCash(rev, { actual: Number(actual || 0), note }), () => setOpen(false))} />
      </Dialog>
    </>
  );
}
