"use client";
import { useState } from "react";
import { changePasscode, exportData, renameMember, saveMembers, saveSettings, signOut, swapTurns } from "@/app/actions";
import { fmtNum, parseIsoDay, parseNames } from "@/lib/format";
import { orderChanges } from "@/lib/model";
import type { View } from "@/lib/view";
import { Dialog, DialogButtons } from "./Dialog";
import { useAction, useToast } from "./Toaster";

type Settings = { startDate: string; baseMonthly: number; adminFeePct: number; names: string };
type Act = { id: string; when: string; who: string; text: string; detail: string };
const SECTIONS = ["Group", "Members", "Activity", "Data", "Account"] as const;

export function SettingsPanel({ view, who, settings, activity }: { view: View; who: string; settings: Settings; activity: Act[] }) {
  const [sec, setSec] = useState<(typeof SECTIONS)[number]>("Group");
  return (
    <>
      <div className="seg" role="group" aria-label="Settings sections">
        {SECTIONS.map((s) => <button key={s} type="button" aria-pressed={sec === s} onClick={() => setSec(s)}>{s}</button>)}
      </div>
      <section className="card stack">
        {sec === "Group" && <GroupSettings key={view.rev} view={view} s={settings} />}
        {sec === "Members" && <MemberSettings key={view.rev} view={view} />}
        {sec === "Activity" && <ActivityLog rows={activity} />}
        {sec === "Data" && <DataSection />}
        {sec === "Account" && <Account view={view} who={who} />}
      </section>
    </>
  );
}

// ── Group: start date, contribution, fee, members in payout order ────────────
function GroupSettings({ view, s }: { view: View; s: Settings }) {
  const [start, setStart] = useState(s.startDate);
  const [base, setBase] = useState(String(s.baseMonthly));
  const [fee, setFee] = useState(String(s.adminFeePct));
  const [names, setNames] = useState(s.names);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const { run, pending } = useAction();
  const toast = useToast();

  const input = { startDate: start, baseMonthly: Number(base), adminFeePct: Number(fee), names };
  const save = () => run(() => saveSettings(view.rev, input), () => setConfirm(null));

  const onSave = () => {
    if (!parseIsoDay(start)) return toast("Enter a valid start date.", "error");
    const oldList = parseNames(s.names), newList = parseNames(names);
    const changes: string[] = [];
    let structural = false;
    if (start !== s.startDate) { changes.push(`start date ${s.startDate} → ${start}`); structural = true; }
    if (Number(base) !== s.baseMonthly) changes.push(`monthly contribution ${fmtNum(s.baseMonthly)} → ${fmtNum(base)}`);
    if (Number(fee) !== s.adminFeePct) changes.push(`admin fee ${s.adminFeePct}% → ${fee}%`);
    if (newList.join("\u0000") !== oldList.join("\u0000")) { changes.push(...orderChanges(oldList, newList)); structural = true; }
    if (!changes.length) return toast("Nothing changed", "warning");
    if (structural) setConfirm(changes);
    else save();
  };

  return (
    <>
      <div className="grid3">
        <label className="f">Start date<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="f">Monthly contribution (GHS)<input type="number" min={0} step={50} value={base} onChange={(e) => setBase(e.target.value)} /></label>
        <label className="f">Admin fee (%)<input type="number" min={0} max={100} step={0.5} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
      </div>
      <label className="f">Members, in payout order
        <textarea value={names} onChange={(e) => setNames(e.target.value)} />
        <span className="caption">Comma-separated. Turns with a payout recorded are locked. To fix a spelling, use Rename under Members.</span>
      </label>
      <button className="btn primary wide" disabled={pending} onClick={onSave}>{pending ? "Saving…" : "Save"}</button>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title="Change the cycle?">
        <p className="caption">Payment history is kept, but payout dates or the rotation order will move:</p>
        <ul>{confirm?.map((c) => <li key={c}>{c}</li>)}</ul>
        <DialogButtons confirm="Confirm change" pending={pending} onConfirm={save} onCancel={() => setConfirm(null)} />
      </Dialog>
    </>
  );
}

// ── Members: monthly tier, week left, swap, rename ────────────────────────────
function MemberSettings({ view }: { view: View }) {
  const [rows, setRows] = useState(() => view.members.map((m) => ({ id: m.id, tier: String(m.tier), left: m.exitWeek ? String(m.exitWeek) : "" })));
  const [dlg, setDlg] = useState<"swap" | "rename" | null>(null);
  const { run, pending } = useAction();
  const set = (id: string, k: "tier" | "left", v: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  return (
    <>
      <p className="caption">Edit a member&apos;s monthly amount, or enter the week they left the group. Leaving keeps their history and turn; they stop owing after that week.</p>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Turn</th><th>Member</th><th>Monthly (GHS)</th><th>Left in week</th></tr></thead>
          <tbody>
            {view.members.map((m, i) => (
              <tr key={m.id}>
                <td>{m.turn}</td>
                <td className="strong">{m.name}</td>
                <td><input type="number" min={0} step={50} value={rows[i].tier} onChange={(e) => set(m.id, "tier", e.target.value)} aria-label={`${m.name} monthly`} /></td>
                <td><input type="number" min={1} max={view.weeks} step={1} value={rows[i].left} placeholder="Active" onChange={(e) => set(m.id, "left", e.target.value)} aria-label={`${m.name} left in week`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid3">
        <button className="btn primary" disabled={pending} onClick={() => run(() => saveMembers(view.rev,
          rows.map((r) => ({ memberId: r.id, tier: Number(r.tier || 0), exitWeek: r.left.trim() ? Number(r.left) : null }))))}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button className="btn" onClick={() => setDlg("swap")}>Swap turns…</button>
        <button className="btn" onClick={() => setDlg("rename")}>Rename…</button>
      </div>
      <SwapDialog open={dlg === "swap"} onClose={() => setDlg(null)} view={view} />
      <RenameDialog open={dlg === "rename"} onClose={() => setDlg(null)} view={view} />
    </>
  );
}

function SwapDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: View }) {
  const free = view.turns.filter((t) => !t.locked);
  const [a, setA] = useState(free[0]?.memberId ?? "");
  const [b, setB] = useState(free[1]?.memberId ?? "");
  const { run, pending } = useAction();
  const ta = free.find((t) => t.memberId === a), tb = free.find((t) => t.memberId === b);
  const lab = (t: View["turns"][number]) => `${t.recipient} · Turn ${t.turn} · ${t.dateS}`;
  const tier = (id: string) => view.members.find((m) => m.id === id)?.tier;

  return (
    <Dialog open={open} onClose={onClose} title="Swap turns">
      {free.length < 2 ? <p className="caption">Fewer than two turns are still unpaid, so there is nothing to swap.</p> : (
        <>
          <label className="f">Move
            <select value={a} onChange={(e) => { setA(e.target.value); if (e.target.value === b) setB(free.find((t) => t.memberId !== e.target.value)!.memberId); }}>
              {free.map((t) => <option key={t.memberId} value={t.memberId}>{lab(t)}</option>)}
            </select>
          </label>
          <label className="f">Swap with
            <select value={b} onChange={(e) => setB(e.target.value)}>
              {free.filter((t) => t.memberId !== a).map((t) => <option key={t.memberId} value={t.memberId}>{lab(t)}</option>)}
            </select>
          </label>
          {ta && tb && (
            <p className="caption">
              {ta.recipient} would collect on {tb.dateS} and {tb.recipient} on {ta.dateS}.
              {tier(a) !== tier(b) && " They are on different tiers, so each pool moves with its recipient."} Only turns with no payout recorded are listed.
            </p>
          )}
          <DialogButtons confirm="Swap turns" pending={pending} disabled={!ta || !tb} onCancel={onClose}
            onConfirm={() => run(() => swapTurns(view.rev, a, b), onClose)} />
        </>
      )}
    </Dialog>
  );
}

function RenameDialog({ open, onClose, view }: { open: boolean; onClose: () => void; view: View }) {
  const [id, setId] = useState(view.members[0]?.id ?? "");
  const [name, setName] = useState("");
  const { run, pending } = useAction();
  return (
    <Dialog open={open} onClose={onClose} title="Rename member">
      <p className="caption">Fixes a spelling. Payments, receipts, tier and payouts all stay with the member.</p>
      <label className="f">Member
        <select value={id} onChange={(e) => setId(e.target.value)}>
          {view.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="f">New name<input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
      <DialogButtons confirm="Rename" pending={pending} onCancel={onClose}
        onConfirm={() => run(() => renameMember(view.rev, id, name), () => { setName(""); onClose(); })} />
    </Dialog>
  );
}

// ── Activity, Data, Account ───────────────────────────────────────────────────
function ActivityLog({ rows }: { rows: Act[] }) {
  if (!rows.length) return <p className="caption">Nothing has been recorded yet.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: "nowrap" }}>{r.when}</td><td>{r.who}</td><td className="strong">{r.text}</td>
              <td style={{ minWidth: 260 }}>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataSection() {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const download = async () => {
    setBusy(true);
    try {
      const json = await exportData();
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `susu-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("The backup could not be prepared. Try again.", "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="h">Backups</div>
      <p className="caption">
        Every save is a single database transaction, and Neon keeps a restore history of the whole database (how far back
        depends on your Neon plan). For a copy you hold yourself, download everything as JSON. The passcode is left out.
      </p>
      <button className="btn" disabled={busy} onClick={download}>{busy ? "Preparing…" : "Download backup (.json)"}</button>
    </>
  );
}

function Account({ view, who }: { view: View; who: string }) {
  const [cur, setCur] = useState(""), [p1, setP1] = useState(""), [p2, setP2] = useState("");
  const { run, pending } = useAction();
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>Signed in as <b>{who}</b><div className="caption">Revision {view.rev}</div></div>
        <form action={signOut}><button className="btn">Sign out</button></form>
      </div>
      <hr style={{ border: 0, borderTop: "1px solid var(--line-soft)", width: "100%", margin: 0 }} />
      <div className="h">Change passcode</div>
      <div className="grid3">
        <label className="f">Current passcode<input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
        <label className="f">New passcode<input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="At least 8 characters" /></label>
        <label className="f">Repeat new passcode<input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></label>
      </div>
      <button className="btn primary wide" disabled={pending}
        onClick={() => run(() => changePasscode(view.rev, { current: cur, next: p1, repeat: p2 }), () => { setCur(""); setP1(""); setP2(""); })}>
        {pending ? "Saving…" : "Change passcode"}
      </button>
    </>
  );
}
