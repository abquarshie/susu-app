import { loadGroup } from "@/lib/data";
import { EPS, fmtNum } from "@/lib/format";
import type { Group, MemberRec } from "@/lib/model";
import { namedPayments } from "@/lib/view";
import { MemberDetails } from "@/components/MemberDetails";

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

  return (
    <>
      <section className="card">
        <div className="key">
          <span><i style={{ background: "var(--paid)" }} />Paid</span>
          <span><i style={{ background: "var(--part)" }} />Part paid</span>
          <span><i style={{ background: "var(--owed-fill)", boxShadow: "inset 0 0 0 1px var(--owed-line)" }} />Owed</span>
          <span><i style={{ background: "var(--empty)" }} />Not due</span>
          <span><i style={{ outline: "1.5px solid var(--brass)", outlineOffset: 1 }} />This week</span>
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
              <div>
                <div className="mname">{m.name}</div>
                <div className="mmeta">GHS {fmtNum(r.weekly)} a week{r.exited && r.exitWeek ? ` · left wk ${r.exitWeek}` : ""}</div>
              </div>
              <div className="strip" style={{ gridTemplateColumns: `repeat(${g.weeks},1fr)` }}>
                {Array.from({ length: g.weeks }, (_, w) => cell(g, m, w + 1))}
              </div>
              {r.owing > 0 ? <div className="mstat owe">GHS {fmtNum(r.owing)}</div>
                : r.exited ? <div className="mstat dim">Left</div>
                : <div className="mstat ok">Up to date</div>}
            </div>
          );
        })}
        <p className="caption" style={{ marginTop: 10 }}>Pick a member below for their payments. Hover hints on the squares do not show on phones.</p>
      </section>

      <MemberDetails
        members={g.rows.map((r, i) => ({
          id: r.id, name: r.member, paidTotal: r.paidTotal, owing: r.owing,
          collects: g.schedule[i].dateS, turn: g.schedule[i].turn, pool: g.schedule[i].net,
        }))}
        payments={payments}
      />
    </>
  );
}
