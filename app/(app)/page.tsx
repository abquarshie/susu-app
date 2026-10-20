import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadGroup } from "@/lib/data";
import { EPS, dayDiff, fmtNum, formatShort, money, plural } from "@/lib/format";
import { CountCashButton } from "@/components/CountCash";
import { Icon } from "@/components/icons";
import { Avatar, Bar, Kpi, PageHead, Pill } from "@/components/ui";

export default async function OverviewPage() {
  const { g } = await loadGroup();
  const [prev, lastCount] = await Promise.all([
    g.week > 1 ? prisma.snapshot.findUnique({ where: { week: g.week - 1 } }) : null,
    prisma.reconciliation.findFirst({ orderBy: { countedAt: "desc" } }),
  ]);

  const change = prev ? money(g.cashHeld - Number(prev.cashHeld)) : 0;
  let countText = "Cash has not been counted yet";
  let countOk: boolean | null = null;
  if (lastCount) {
    const days = dayDiff(g.today, lastCount.countedAt);
    const diff = money(lastCount.difference);
    countOk = Math.abs(diff) < EPS;
    countText = `Counted ${days === 0 ? "today" : `${plural(days, "day")} ago`}, ` +
      (countOk ? "matched" : `GHS ${fmtNum(Math.abs(diff))} ${diff > 0 ? "over" : "short"}`);
  }

  const owing = g.rows.filter((r) => r.owing > 0).sort((a, b) => b.owing - a.owing);
  const nt = g.nextTurn;
  const paidCount = g.schedule.filter((r) => r.done).length;
  const payoutShort = !!nt && nt.funded < nt.net - EPS && nt.days != null && nt.days <= 14;
  const [whole, cents] = fmtNum(g.cashHeld).split(".");

  return (
    <div className="stack">
      <PageHead title="Overview" sub={`Week ${g.week} of ${g.weeks} · ${plural(g.n, "member")} in the rotation`} />

      <section className="hero">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium text-white/75">Cash in hand</span>
          <span className="hero-chip">
            <Icon name={countOk === null ? "wallet" : countOk ? "check" : "warning"} className="size-3.5" />{countText}
          </span>
        </div>
        <div className="num mt-2 flex items-baseline gap-1.5 font-bold tracking-tight">
          <span className="text-lg text-white/70 md:text-xl">GHS</span>
          <span className="text-4xl md:text-5xl">{whole}</span>
          {cents && <span className="text-2xl text-white/70 md:text-3xl">.{cents}</span>}
        </div>
        <div className="mt-2 min-h-5 text-sm">
          {Math.abs(change) >= EPS ? (
            <span className={`inline-flex items-center gap-1 font-semibold ${change > 0 ? "text-emerald-300" : "text-rose-300"}`}>
              <Icon name={change > 0 ? "up" : "down"} className="size-4" />
              {change > 0 ? "+" : "−"}GHS {fmtNum(Math.abs(change))} this week
            </span>
          ) : <span className="text-white/60">No change since last week</span>}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          <Link href="/record" className="btn border-white bg-white text-[#0a1a4a] hover:bg-white/90">
            <Icon name="add" /><span className="max-sm:hidden">Record week {Math.max(1, g.week)}</span><span className="sm:hidden">Record</span>
          </Link>
          <CountCashButton rev={g.rec.settings.rev} cashHeld={g.cashHeld}
            className="btn border-white/20 bg-white/10 text-white hover:bg-white/20" />
          <Link href="/share" className="btn border-white/20 bg-white/10 text-white hover:bg-white/20">
            <Icon name="share" /><span className="max-sm:hidden">Share update</span><span className="sm:hidden">Share</span>
          </Link>
        </div>

        <div className="mt-6 border-t border-white/15 pt-4">
          <div className="flex justify-between text-xs font-medium text-white/70">
            <span>Cycle progress</span><span>Week {g.week} of {g.weeks}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, (g.week / g.weeks) * 100)}%` }} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Outstanding" value={`GHS ${fmtNum(g.gap)}`} tone={g.gap > EPS ? "out" : undefined} icon={<Icon name="warning" />}
          foot={owing.length ? `${plural(owing.length, "member")} behind` : `Everyone paid to week ${g.week}`} />
        <Kpi label="Next payout" value={nt ? `GHS ${fmtNum(nt.net)}` : "Done"} icon={<Icon name="calendar" />}
          foot={nt ? <>{nt.recipient} · {nt.days == null ? <span className="text-out">overdue since {formatShort(nt.date)}</span> : formatShort(nt.date)}</> : "Every turn collected"} />
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="Payouts made" value={`${paidCount} of ${g.n}`} icon={<Icon name="cash" />}
            foot={nt ? `${nt.recipient}'s pool is ${nt.pctFunded}% funded` : "Cycle complete"} />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="card">
          <div className="section">
            <h2 className="section-title">Needs attention</h2>
            {(owing.length > 0 || payoutShort) && <Pill tone="out">{owing.length + (payoutShort ? 1 : 0)}</Pill>}
          </div>
          {owing.map((r) => (
            <div className="list-row" key={r.id}>
              <Avatar name={r.member} tone="out" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.member}</div>
                <div className="text-xs text-muted">{r.streak >= 2 ? `${r.streak} weeks behind` : "Behind this week"}</div>
              </div>
              <span className="num text-sm font-semibold text-out">GHS {fmtNum(r.owing)}</span>
            </div>
          ))}
          {payoutShort && (
            <div className="list-row">
              <span className="avatar muted [&_svg]:size-[18px]" aria-hidden><Icon name="calendar" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{nt!.recipient}&apos;s payout</div>
                <div className="text-xs text-muted">In {plural(nt!.days!, "day")}</div>
              </div>
              <span className="num text-sm font-semibold text-warn">GHS {fmtNum(nt!.net - nt!.funded)} short</span>
            </div>
          )}
          {!owing.length && !payoutShort && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-in-soft text-in [&_svg]:size-6"><Icon name="check" /></span>
              <div className="text-sm font-semibold">All clear</div>
              <div className="caption">Nothing needs attention right now.</div>
            </div>
          )}
        </section>

        <details className="card" open>
          <summary>
            <span className="flex-1">Rotation</span>
            <span className="section-aside">{paidCount} of {g.n} paid</span>
          </summary>
          <ol className="m-0 grid list-none gap-0 p-0">
            {g.schedule.map((r) => {
              const isNext = r === nt;
              return (
                <li key={r.turn} className={`list-row ${isNext ? "-mx-2 rounded-xl border-b-0 bg-brand-soft/60 px-2" : ""}`}>
                  <span className={`grid size-9 flex-none place-items-center rounded-full text-[13px] font-bold ${r.done ? "bg-in-soft text-in" : isNext ? "bg-brand text-on-brand" : "bg-subtle text-muted"}`}>
                    {r.done ? <Icon name="check" className="size-[18px]" /> : r.index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{r.recipient}{r.exited && " (left)"}</span>
                      {r.done ? <Pill tone="in">Paid</Pill>
                        : r.collected > 0 ? <Pill tone="warn">Part paid</Pill>
                        : isNext ? <Pill tone="accent">Next</Pill>
                        : null}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <div className="flex-1"><Bar pct={r.pctCollected} tone={r.done ? "in" : undefined} label={`${r.recipient} collected`} /></div>
                      <span className="num w-9 text-right text-xs text-muted">{r.pctCollected}%</span>
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className="num text-sm font-semibold">GHS {fmtNum(r.net)}</div>
                    <div className="text-xs text-muted">{formatShort(r.date)}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </details>
      </div>
    </div>
  );
}
