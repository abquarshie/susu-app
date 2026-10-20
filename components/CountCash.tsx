"use client";
import { useState } from "react";
import { countCash } from "@/app/actions";
import { EPS, fmtNum, money } from "@/lib/format";
import { Dialog, DialogButtons } from "./Dialog";
import { useAction } from "./Toaster";

export function CountCashButton({ rev, cashHeld }: { rev: number; cashHeld: number }) {
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState(String(cashHeld));
  const [note, setNote] = useState("");
  const { run, pending } = useAction();
  const diff = money(Number(actual || 0) - cashHeld);

  return (
    <>
      <button className="btn" onClick={() => { setActual(String(cashHeld)); setNote(""); setOpen(true); }}>Count cash</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Count cash">
        <p className="caption">
          The record says the group holds <b>GHS {fmtNum(cashHeld)}</b>. Enter what you actually counted, including MoMo and bank balances.
        </p>
        <label className="f">Counted (GHS)
          <input type="number" min={0} step={10} inputMode="decimal" value={actual} onChange={(e) => setActual(e.target.value)} />
        </label>
        <div className={`note ${Math.abs(diff) < EPS ? "ok" : "warn"}`}>
          {Math.abs(diff) < EPS ? "Matches the record." : `GHS ${fmtNum(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the record.`}
        </div>
        <label className="f">Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" maxLength={200} />
        </label>
        <DialogButtons confirm="Save count" pending={pending} onCancel={() => setOpen(false)}
          onConfirm={() => run(() => countCash(rev, { actual: Number(actual || 0), note }), () => setOpen(false))} />
      </Dialog>
    </>
  );
}
