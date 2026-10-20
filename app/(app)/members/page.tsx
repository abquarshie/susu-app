import { loadGroup } from "@/lib/data";
import { EPS, fmtNum, plural } from "@/lib/format";
import type { Group, MemberRec } from "@/lib/model";
import { namedPayments } from "@/lib/view";
import { MemberDetails } from "@/components/MemberDetails";
import { Avatar, Kpi, PageHead } from "@/components/ui";

function cell(g: Group, m: MemberRec, w: number) {
  const amt = g.paidAmount(m, w), tgt = g.weekly(m);
  const extra = (w % 4 === 0 && w !== g.weeks ? " end" : "") + (w === g.week ? " now" : "");
  let cls = "", tip = "not due yet";
  if (!g.liable(m, w) && amt <= 0) [cls, tip] = ["exempt", "not owed"];
  else if (amt >= tgt - EPS) [cls, tip] = ["paid", `paid GHS ${fmtNum(amt)}`];
  else if (amt > 0) [cls, tip] = ["part", `GHS ${fmtNum(amt)} of ${fmtNum(tgt)}`];
  else if (w <= g.week) [cls, tip] = ["owed", "not paid"];
  return <i key={w} className={`wk ${cls}${extra}`} title={`Week ${w}: ${tip}`} />;
}

export default async function MembersPage() {
  const { g } = await loadGroup();
  const cur = g.week ? Math.floor((g.week - 1) / 4) : -1;
  const payments = namedPayments(g);
  const behind = g.rows.filter((r) => r.owing > 0).length;
  const active = g.rows.filter((r) => !r.exited).length;
  const collected = g.rows.reduce((s, r) => s + r.paidTotal, 0);

  return (
    <div className="stack">
      <PageHead title="Members" sub={`${plural(active, "active member")} · contributions week by week`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Collected so far" value={`GHS ${fmtNum(collected)}`} foot={`Across ${plural(g.week, "week")}`} />
        <Kpi label="Outstanding" value={`GHS ${fmtNum(g.gap)}`} tone={g.gap > EPS ? "out" : undefined}
          foot={behind ? `${plural(behind, "member")} behind` : "Everyone is up to date"} />
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="Up to date" value={`${g.rows.length - behind} of ${g.rows.length}`} tone={behind ? undefined : "in"} foot="Members with nothing owing" />
        </div>
      </div>

      <section className="card">
        <div className="section">
          <h2 className="section-title">Contribution grid</h2>
          <span className="section-aside">Week {g.week} of {g.weeks}</span>
        </div>
        <div className="legend">
          <span><i className="bg-in" />Paid</span>
          <span><i className="wk part !h-2.5" />Part paid</span>
          <span><i className="wk owed !h-2.5" />Owed</span>
          <span><i className="bg-subtle" />Not due</span>
          <span><i className="outline-2 outline-offset-1 outline-brand" />This week</span>
        </div>
        <div className="mrow head">
          <div />
          <div className="scale" style={{ gridTemplateColumns: `repeat(${g.n},1fr)` }}>
            {g.members.map((_, i) => <span key={i} className={i === cur ? "on" : ""}>T{i + 1}</span>)}
          </div>
          <div />
        </div>
        {g.rows.map((r, i) => {
          const m = g.members[i];
          return (
            <div className="mrow" key={m.id}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={m.name} tone={r.owing > 0 ? "out" : r.exited ? "muted" : undefined} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="truncate text-xs text-muted">GHS {fmtNum(r.weekly)} a week{r.exited && r.exitWeek ? ` · left wk ${r.exitWeek}` : ""}</div>
                </div>
              </div>
              <div className="strip" style={{ gridTemplateColumns: `repeat(${g.weeks},1fr)` }}>
                {Array.from({ length: g.weeks }, (_, w) => cell(g, m, w + 1))}
              </div>
              {r.owing > 0 ? <div className="mstat"><span className="pill out">GHS {fmtNum(r.owing)}</span></div>
                : r.exited ? <div className="mstat"><span className="pill neutral">Left</span></div>
                : <div className="mstat"><span className="pill in">Up to date</span></div>}
            </div>
          );
        })}
        <p className="caption mt-3">Pick a member below to see their payments. Hover hints on the squares do not show on phones.</p>
      </section>

      <MemberDetails
        members={g.rows.map((r, i) => ({
          id: r.id, name: r.member, paidTotal: r.paidTotal, owing: r.owing,
          collects: g.schedule[i].dateS, turn: g.schedule[i].turn, pool: g.schedule[i].net,
        }))}
        payments={payments}
      />
    </div>
  );
}
