import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadGroup } from "@/lib/data";
import { EPS, dayDiff, fmtNum, formatShort, money, plural } from "@/lib/format";
import { CountCashButton } from "@/components/CountCash";

export default async function OverviewPage() {
  const { g } = await loadGroup();
  const [prev, lastCount] = await Promise.all([
    g.week > 1 ? prisma.snapshot.findUnique({ where: { week: g.week - 1 } }) : null,
    prisma.reconciliation.findFirst({ orderBy: { countedAt: "desc" } }),
  ]);

  const change = prev ? money(g.cashHeld - Number(prev.cashHeld)) : 0;
  let countText = "Cash has not been counted yet";
  if (lastCount) {
    const days = dayDiff(g.today, lastCount.countedAt);
    const diff = money(lastCount.difference);
    countText = `Counted ${days === 0 ? "today" : `${plural(days, "day")} ago`}, ` +
      (Math.abs(diff) < EPS ? "matched" : `GHS ${fmtNum(Math.abs(diff))} ${diff > 0 ? "over" : "short"}`);
  }

  const owing = g.rows.filter((r) => r.owing > 0).sort((a, b) => b.owing - a.owing);
  const nt = g.nextTurn;
  const paidCount = g.schedule.filter((r) => r.done).length;

  return (
    <>
      <section className="card">
        <div className="kpis">
          <div className="kpi">
            <div className="kl">Cash in hand</div>
            <div className="kv">GHS {fmtNum(g.cashHeld)}</div>
            <div className="ks">
              {Math.abs(change) >= EPS && (
                <><span className={change > 0 ? "up" : "dn"}>{change > 0 ? "+" : "−"}GHS {fmtNum(Math.abs(change))} this week</span> · </>
              )}
              {countText}
            </div>
          </div>
          <div className="kpi">
            <div className="kl">Outstanding</div>
            <div className={`kv${g.gap > EPS ? " owe" : ""}`}>GHS {fmtNum(g.gap)}</div>
            <div className="ks">{owing.length ? `${plural(owing.length, "member")} behind` : `Everyone has paid up to week ${g.week}`}</div>
          </div>
          <div className="kpi">
            <div className="kl">Next payout</div>
            <div className="kv">{nt ? `GHS ${fmtNum(nt.net)}` : "Done"}</div>
            <div className="ks">
              {nt ? (
                <>{nt.recipient} · {nt.days == null ? <span className="dn">overdue since {formatShort(nt.date)}</span> : nt.dateS} · {nt.pctFunded}% funded</>
              ) : "Every turn in this cycle has been collected"}
            </div>
          </div>
        </div>
      </section>

      <div className="btn-row">
        <Link href="/record" className="btn primary">Record week {Math.max(1, g.week)}</Link>
        <CountCashButton rev={g.rec.settings.rev} cashHeld={g.cashHeld} />
        <Link href="/share" className="btn">Share update</Link>
        <span />
      </div>

      <div className="split">
        <section className="card">
          <div className="h">Needs attention</div>
          {owing.map((r) => (
            <div className="att" key={r.id}>
              <span><b>{r.member}</b>{r.streak >= 2 && ` · ${r.streak} weeks behind`}</span>
              <span className="v">GHS {fmtNum(r.owing)}</span>
            </div>
          ))}
          {nt && nt.funded < nt.net - EPS && nt.days != null && nt.days <= 14 && (
            <div className="att">
              <span><b>{nt.recipient}</b>&apos;s payout in {plural(nt.days, "day")}</span>
              <span className="v w">GHS {fmtNum(nt.net - nt.funded)} short</span>
            </div>
          )}
          {!owing.length && !(nt && nt.funded < nt.net - EPS && nt.days != null && nt.days <= 14) && (
            <div className="att"><span>Nothing needs attention</span><span className="v ok">All clear</span></div>
          )}
        </section>

        <section className="card">
          <div className="h">Rotation <span className="muted">· {paidCount} of {g.n} paid</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Turn</th><th>Recipient</th><th>Status</th><th>Collected</th><th>Pays on</th><th className="num">Pool</th></tr></thead>
              <tbody>
                {g.schedule.map((r) => (
                  <tr key={r.turn}>
                    <td>{r.index + 1}</td>
                    <td className="strong">{r.recipient}{r.exited && " (left)"}</td>
                    <td>
                      {r.done ? <span className="pill paid">Paid</span>
                        : r.collected > 0 ? <span className="pill part">Part paid</span>
                        : r === nt ? <span className="pill next">▶ Next</span>
                        : <span className="pill">Upcoming</span>}
                    </td>
                    <td><span className="bar"><i><b style={{ width: `${r.pctCollected}%` }} /></i>{r.pctCollected}%</span></td>
                    <td>{formatShort(r.date)}</td>
                    <td className="num">GHS {fmtNum(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
