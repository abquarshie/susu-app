"use client";
import { useState } from "react";
import { fmtNum } from "@/lib/format";
import type { PaymentView } from "@/lib/view";
import { Avatar, Pill } from "./ui";

type Row = { id: string; name: string; paidTotal: number; owing: number; collects: string; turn: string; pool: number };

export function MemberDetails({ members, payments }: { members: Row[]; payments: PaymentView[] }) {
  const [id, setId] = useState(members[0]?.id);
  const m = members.find((x) => x.id === id) ?? members[0];
  const mine = payments.filter((p) => p.memberId === m.id);
  return (
    <section className="card stack">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={m.name} tone={m.owing > 0 ? "out" : undefined} />
          <div className="min-w-0">
            <h2 className="m-0 truncate text-base font-semibold">{m.name}</h2>
            <div className="text-xs text-muted">{m.turn} · pool GHS {fmtNum(m.pool)}</div>
          </div>
        </div>
        <label className="field w-full sm:w-64"><span className="sr-only">Member</span>
          <select className="input" value={m.id} onChange={(e) => setId(e.target.value)} aria-label="Member">
            {members.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-subtle p-3 md:gap-4 md:p-4">
        <div className="min-w-0"><div className="text-xs text-muted">Paid to date</div><div className="num truncate text-base font-bold md:text-xl">GHS {fmtNum(m.paidTotal)}</div></div>
        <div className="min-w-0"><div className="text-xs text-muted">Outstanding</div><div className={`num truncate text-base font-bold md:text-xl${m.owing > 0 ? " text-out" : ""}`}>GHS {fmtNum(m.owing)}</div></div>
        <div className="min-w-0" title={`${m.turn} · pool GHS ${fmtNum(m.pool)}`}><div className="text-xs text-muted">Collects</div><div className="truncate text-base font-bold md:text-xl">{m.collects}</div></div>
      </div>
      {mine.length ? (
        <div>
          <div className="section mb-1"><h3 className="m-0 text-sm font-semibold">Payments</h3><span className="section-aside">{mine.length}</span></div>
          <ul className="m-0 list-none p-0">
            {mine.map((p) => (
              <li key={p.id} className="list-row">
                <span className="grid size-9 flex-none place-items-center rounded-xl bg-subtle text-xs font-bold text-muted">W{p.week}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className={p.status === "REVERSED" ? "text-muted line-through" : ""}>Week {p.week} contribution</span>
                    {p.status === "REVERSED" && <Pill tone="out">Reversed</Pill>}
                  </div>
                  <div className="truncate text-xs text-muted">{[p.method, p.paidOn, p.reference].filter(Boolean).join(" · ")}</div>
                </div>
                <span className={`num text-sm font-semibold ${p.status === "REVERSED" ? "text-muted line-through" : "text-in"}`}>+GHS {fmtNum(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="caption">No payments recorded yet.</p>}
    </section>
  );
}
