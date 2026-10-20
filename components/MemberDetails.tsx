"use client";
import { useState } from "react";
import { fmtNum } from "@/lib/format";
import type { PaymentView } from "@/lib/view";

type Row = { id: string; name: string; paidTotal: number; owing: number; collects: string; turn: string; pool: number };

export function MemberDetails({ members, payments }: { members: Row[]; payments: PaymentView[] }) {
  const [id, setId] = useState(members[0]?.id);
  const m = members.find((x) => x.id === id) ?? members[0];
  const mine = payments.filter((p) => p.memberId === m.id);
  return (
    <section className="card stack">
      <label className="f">Member details
        <select value={m.id} onChange={(e) => setId(e.target.value)}>
          {members.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <div className="metrics">
        <div className="metric"><div className="kl">Paid to date</div><div className="kv">GHS {fmtNum(m.paidTotal)}</div></div>
        <div className="metric"><div className="kl">Outstanding</div><div className={`kv${m.owing > 0 ? " owe" : ""}`}>GHS {fmtNum(m.owing)}</div></div>
        <div className="metric" title={`${m.turn} · pool GHS ${fmtNum(m.pool)}`}>
          <div className="kl">Collects</div><div className="kv">{m.collects}</div>
          <div className="ks">{m.turn} · pool GHS {fmtNum(m.pool)}</div>
        </div>
      </div>
      {mine.length ? (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Week</th><th className="num">Amount</th><th>Method</th><th>Date</th><th>Reference</th><th>Status</th></tr></thead>
            <tbody>
              {mine.map((p) => (
                <tr key={p.id}>
                  <td>{p.week}</td><td className="num strong">GHS {fmtNum(p.amount)}</td><td>{p.method}</td>
                  <td>{p.paidOn}</td><td>{p.reference}</td>
                  <td>{p.status === "REVERSED" && <span className="pill rev">Reversed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="caption">No payments recorded yet.</p>}
    </section>
  );
}
