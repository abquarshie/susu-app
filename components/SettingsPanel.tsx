"use client";
import { useState } from "react";
import { changePasscode, exportData, renameMember, saveMembers, saveSettings, signOut, swapTurns } from "@/app/actions";
import { fmtNum, parseIsoDay, parseNames } from "@/lib/format";
import { orderChanges } from "@/lib/model";
import type { View } from "@/lib/view";
import { Dialog, DialogButtons } from "./Dialog";
import { Icon } from "./icons";
import { useAction, useToast } from "./Toaster";
import { Avatar, PageHead } from "./ui";

type Settings = { startDate: string; baseMonthly: number; adminFeePct: number; names: string };
type Act = { id: string; when: string; who: string; text: string; detail: string };
const SECTIONS = ["Group", "Members", "Activity", "Data", "Account"] as const;

export function SettingsPanel({ view, who, settings, activity }: { view: View; who: string; settings: Settings; activity: Act[] }) {
  const [sec, setSec] = useState<(typeof SECTIONS)[number]>("Group");
  return (
    <div className="stack">
      <PageHead title="Settings" sub="Cycle rules, members, the activity log and your account." />
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
    </div>
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
    if (!(Number(base) > 0)) return toast("Enter a monthly contribution above zero.", "error");
    if (!(Number(fee) >= 0 && Number(fee) <= 100)) return toast("The admin fee must be between 0 and 100%.", "error");
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
      <SubHead title="Cycle" text="Changing the start date or the order moves payout dates; history is kept." />
      <div className="form-grid three">
        <label className="field"><span>Start date</span><input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="field"><span>Monthly contribution (GHS)</span><input className="input" type="number" min={0} step={50} value={base} onChange={(e) => setBase(e.target.value)} /></label>
        <label className="field"><span>Admin fee (%)</span><input className="input" type="number" min={0} max={100} step={0.5} value={fee} onChange={(e) => setFee(e.target.value)} /></label>
      </div>
      <label className="field"><span>Members, in payout order</span><textarea className="input" value={names} onChange={(e) => setNames(e.target.value)} />
        <span className="caption font-normal">Comma-separated. Turns with a payout recorded are locked. To fix a spelling, use Rename under Members.</span>
      </label>
      <div className="flex justify-end"><button className="btn primary w-full sm:w-auto sm:px-6" disabled={pending} onClick={onSave}>{pending ? "Saving…" : "Save changes"}</button></div>
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
  const toast = useToast();
  const set = (id: string, k: "tier" | "left", v: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [k]: v } : r)));

  return (
    <>
      <SubHead title="Members" text="Edit a member's monthly amount, or enter the week they left the group. Leaving keeps their history and turn; they stop owing after that week." />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Member</th><th>Monthly (GHS)</th><th>Left in week</th></tr></thead>
          <tbody>
            {view.members.map((m, i) => (
              <tr key={m.id}>
                <td>
                  <div className="flex min-w-36 items-center gap-2.5">
                    <Avatar name={m.name} tone={rows[i].left ? "muted" : undefined} />
                    <div className="min-w-0"><div className="truncate font-semibold">{m.name}</div><div className="text-xs text-muted">Turn {m.turn}</div></div>
                  </div>
                </td>
                <td><input className="input" type="number" min={0} step={50} value={rows[i].tier} onChange={(e) => set(m.id, "tier", e.target.value)} aria-label={`${m.name} monthly`} style={{ minWidth: 96 }} /></td>
                <td><input className="input" type="number" min={1} max={view.weeks} step={1} value={rows[i].left} placeholder="Active" onChange={(e) => set(m.id, "left", e.target.value)} aria-label={`${m.name} left in week`} style={{ minWidth: 84 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button className="btn" onClick={() => setDlg("swap")}><Icon name="swap" />Swap turns</button>
        <button className="btn" onClick={() => setDlg("rename")}><Icon name="edit" />Rename</button>
        <button className="btn primary col-span-2 sm:px-6" disabled={pending} onClick={() => {
          const bad = rows.find((r) => !(Number(r.tier) > 0));
          if (bad) return toast(`Enter a monthly amount above zero for ${view.members.find((m) => m.id === bad.id)?.name ?? "every member"}.`, "error");
          run(() => saveMembers(view.rev, rows.map((r) => ({ memberId: r.id, tier: Number(r.tier), exitWeek: r.left.trim() ? Number(r.left) : null }))));
        }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
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
          <label className="field"><span>Move</span><select className="input" value={a} onChange={(e) => { setA(e.target.value); if (e.target.value === b) setB(free.find((t) => t.memberId !== e.target.value)!.memberId); }}>
              {free.map((t) => <option key={t.memberId} value={t.memberId}>{lab(t)}</option>)}
            </select>
          </label>
          <label className="field"><span>Swap with</span><select className="input" value={b} onChange={(e) => setB(e.target.value)}>
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
      <label className="field"><span>Member</span><select className="input" value={id} onChange={(e) => setId(e.target.value)}>
          {view.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </label>
      <label className="field"><span>New name</span><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
      <DialogButtons confirm="Rename" pending={pending} onCancel={onClose}
        onConfirm={() => run(() => renameMember(view.rev, id, name), () => { setName(""); onClose(); })} />
    </Dialog>
  );
}

// ── Activity, Data, Account ───────────────────────────────────────────────────
function ActivityLog({ rows }: { rows: Act[] }) {
  if (!rows.length) return <p className="caption">Nothing has been recorded yet.</p>;
  return (
    <>
      <SubHead title="Activity" text="Every change, newest first, with who made it." />
      <ol className="m-0 list-none p-0">
        {rows.map((r) => (
          <li key={r.id} className="list-row items-start">
            <Avatar name={r.who} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-semibold">{r.text}</span>
                <span className="text-xs whitespace-nowrap text-muted">{r.when}</span>
              </div>
              <div className="text-xs text-muted">by {r.who}</div>
              {r.detail && <div className="mt-1 text-[13px] break-words text-muted">{r.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
    </>
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
      <SubHead title="Backups" />
      <p className="caption">
        Every save is a single database transaction, and Neon keeps a restore history of the whole database (how far back
        depends on your Neon plan). For a copy you hold yourself, download everything as JSON. The passcode is left out.
      </p>
      <div><button className="btn" disabled={busy} onClick={download}><Icon name="download" />{busy ? "Preparing…" : "Download backup (.json)"}</button></div>
    </>
  );
}

function Account({ view, who }: { view: View; who: string }) {
  const [cur, setCur] = useState(""), [p1, setP1] = useState(""), [p2, setP2] = useState("");
  const { run, pending } = useAction();
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-subtle p-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={who} />
          <div className="min-w-0"><div className="truncate font-semibold">Signed in as {who}</div><div className="caption">Revision {view.rev}</div></div>
        </div>
        <form action={signOut}><button className="btn"><Icon name="logout" />Sign out</button></form>
      </div>
      <SubHead title="Change passcode" text="Shared by every admin. At least 8 characters." />
      <div className="form-grid three">
        <label className="field"><span>Current passcode</span><input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></label>
        <label className="field"><span>New passcode</span><input className="input" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="At least 8 characters" /></label>
        <label className="field"><span>Repeat new passcode</span><input className="input" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></label>
      </div>
      <div className="flex justify-end"><button className="btn primary w-full sm:w-auto sm:px-6" disabled={pending}
        onClick={() => run(() => changePasscode(view.rev, { current: cur, next: p1, repeat: p2 }), () => { setCur(""); setP1(""); setP2(""); })}>
        {pending ? "Saving…" : "Change passcode"}
      </button></div>
    </>
  );
}

function SubHead({ title, text }: { title: string; text?: string }) {
  return (
    <div>
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      {text && <p className="caption mt-1">{text}</p>}
    </div>
  );
}
