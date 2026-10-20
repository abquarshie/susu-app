"use client";
import { useMemo, useState } from "react";
import { correctPayment, reversePayout, savePayment, savePayout, saveWeek } from "@/app/actions";
import { EPS, METHODS, fmtNum, formatDate, isoDay, money, parseDisplayDate, parseIsoDay } from "@/lib/format";
import type { MemberView, PaymentView, PayoutView, View } from "@/lib/view";
import { Dialog, DialogButtons } from "./Dialog";
import { Icon } from "./icons";
import { useAction, useToast } from "./Toaster";
import { Avatar, Bar, PageHead } from "./ui";

const MODES = ["This week", "Single payment", "Payout", "Correction"] as const;
type Mode = (typeof MODES)[number];
const SHORT: Partial<Record<Mode, string>> = { "Single payment": "Payment" };

const paidAmt = (m: MemberView, w: number) => m.amounts[w - 1] ?? 0;
const isPaid = (m: MemberView, w: number) => paidAmt(m, w) >= m.weekly - EPS;
const liable = (m: MemberView, w: number) => m.exitWeek == null || w <= m.exitWeek;
const pad = (w: number) => String(w).padStart(2, "0");

export function RecordPanel({ view, payments, payouts }: { view: View; payments: PaymentView[]; payouts: PayoutView[] }) {
  const [mode, setMode] = useState<Mode>("This week");
  return (
    <div className="stack">
      <PageHead title="Record" sub="Contributions, payouts and corrections. Every save is logged with your name." />
      <div className="seg" role="group" aria-label="What to record">
        {MODES.map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
            <span className="max-sm:hidden">{m}</span><span className="sm:hidden">{SHORT[m] ?? m}</span>
          </button>
        ))}
      </div>
      <section className="card">
        {mode === "This week" && <WeekForm view={view} />}
        {mode === "Single payment" && <PaymentForm view={view} />}
        {mode === "Payout" && <PayoutForm view={view} />}
        {mode === "Correction" && <CorrectionForm view={view} payments={payments} payouts={payouts} />}
      </section>
    </div>
  );
}

function MethodSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field"><span>Method</span><select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {METHODS.map((m) => <option key={m}>{m}</option>)}
      </select>
    </label>
  );
}

// ── This week: tick everyone who paid ────────────────────────────────────────
function WeekForm({ view }: { view: View }) {
  const [week, setWeek] = useState(Math.max(1, view.week));
  const [method, setMethod] = useState<string>("Cash");
  const [date, setDate] = useState(view.today);
  return (
    <div className="stack">
      <div className="form-grid three">
        <label className="field"><span>Week</span><input className="input" type="number" min={1} max={view.weeks} value={week}
            onChange={(e) => setWeek(Math.min(view.weeks, Math.max(1, Math.trunc(Number(e.target.value) || 1))))} />
        </label>
        <MethodSelect value={method} onChange={setMethod} />
        <label className="field"><span>Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      {/* keyed on week + rev so the ticks reset to what is recorded whenever either changes */}
      <WeekTicks key={`${week}-${view.rev}`} view={view} week={week} method={method} date={date} />
    </div>
  );
}

function WeekTicks({ view, week, method, date }: { view: View; week: number; method: string; date: string }) {
  const members = view.members.filter((m) => liable(m, week) || paidAmt(m, week) > 0);
  const [ticks, setTicks] = useState(() => Object.fromEntries(members.map((m) => [m.id, isPaid(m, week)])));
  const [confirm, setConfirm] = useState(false);
  const { run, pending } = useAction();
  const toast = useToast();

  const paid = members.filter((m) => ticks[m.id] && !isPaid(m, week));
  const unpaid = members.filter((m) => !ticks[m.id] && isPaid(m, week));
  const save = () => run(() => saveWeek(view.rev, { week, method, date, paid: paid.map((m) => m.id), unpaid: unpaid.map((m) => m.id) }),
    () => setConfirm(false));

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Who paid in week {week}?</span>
        <span className="pill accent">{members.filter((m) => ticks[m.id]).length} of {members.length} ticked</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => {
          const have = paidAmt(m, week);
          return (
            <label key={m.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:bg-subtle has-checked:border-in has-checked:bg-in-soft">
              <Avatar name={m.name} tone={ticks[m.id] ? "in" : "muted"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.name}</span>
                <span className="num block text-xs text-muted">
                  GHS {fmtNum(m.weekly)}{have > 0 && have < m.weekly - EPS && <> · GHS {fmtNum(have)} so far</>}
                </span>
              </span>
              <input type="checkbox" className="size-5 flex-none cursor-pointer accent-in" checked={!!ticks[m.id]}
                onChange={(e) => setTicks((t) => ({ ...t, [m.id]: e.target.checked }))} />
            </label>
          );
        })}
      </div>
      <button className="btn primary big wide" disabled={pending}
        onClick={() => (unpaid.length ? setConfirm(true) : paid.length ? save() : toast("No changes to save", "warning"))}>
        {pending ? "Saving…" : `Save week ${week}`}
      </button>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Reverse payments?">
        <p className="caption">These members will be marked unpaid for week {pad(week)}, and their payments reversed:</p>
        <ul>{unpaid.map((m) => <li key={m.id}>{m.name}</li>)}</ul>
        <DialogButtons confirm="Reverse and save" pending={pending} onConfirm={save} onCancel={() => setConfirm(false)} />
      </Dialog>
    </>
  );
}

// ── Single payment: any amount, any week, with a reference ──────────────────
function PaymentForm({ view }: { view: View }) {
  const [memberId, setMemberId] = useState(view.members[0]?.id ?? "");
  const [week, setWeek] = useState(Math.max(1, view.week));
  const m = view.members.find((x) => x.id === memberId) ?? view.members[0];
  const already = paidAmt(m, week);
  const suggested = already < m.weekly ? money(m.weekly - already) : m.weekly;
  return (
    <div className="stack">
      <div className="form-grid">
        <label className="field"><span>Member</span><select className="input" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {view.members.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Week</span><input className="input" type="number" min={1} max={view.weeks} value={week}
            onChange={(e) => setWeek(Math.min(view.weeks, Math.max(1, Math.trunc(Number(e.target.value) || 1))))} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-subtle p-3 text-sm">
        <div><div className="text-xs text-muted">Week {week} target</div><div className="num font-bold">GHS {fmtNum(m.weekly)}</div></div>
        <div><div className="text-xs text-muted">Already recorded</div><div className="num font-bold">GHS {fmtNum(already)}</div></div>
      </div>
      <PaymentFields key={`${m.id}-${week}-${view.rev}`} view={view} member={m} week={week} suggested={suggested} />
    </div>
  );
}

function PaymentFields({ view, member, week, suggested }: { view: View; member: MemberView; week: number; suggested: number }) {
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] = useState<string>("Cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(view.today);
  const { run, pending } = useAction();
  const toast = useToast();
  return (
    <>
      <div className="form-grid">
        <label className="field sm:col-span-2"><span>Amount received (GHS)</span><input className="input big" type="number" min={0} step={10} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <MethodSelect value={method} onChange={setMethod} />
        <label className="field"><span>Reference</span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" maxLength={120} /></label>
        <label className="field"><span>Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <button className="btn primary big wide" disabled={pending} onClick={() => {
        if (!(Number(amount) > 0)) return toast("Enter an amount greater than zero.", "error");
        run(() => savePayment(view.rev, { memberId: member.id, week, amount: Number(amount), method, reference, date }));
      }}>{pending ? "Saving…" : "Save payment"}</button>
    </>
  );
}

// ── Payout: money handed to this turn's recipient ────────────────────────────
function PayoutForm({ view }: { view: View }) {
  const [turn, setTurn] = useState(view.nextTurn ?? 1);
  const r = view.turns[turn - 1];
  return (
    <div className="stack">
      <label className="field"><span>Turn</span><select className="input" value={turn} onChange={(e) => setTurn(Number(e.target.value))}>
          {view.turns.map((t) => <option key={t.turn} value={t.turn}>{t.label} · {t.recipient}{t.done ? " · paid" : ""}</option>)}
        </select>
      </label>
      <div className="rounded-2xl bg-subtle p-3.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-semibold">{r.recipient} · {r.label}</span>
          <span className="num text-muted">GHS {fmtNum(r.collected)} of {fmtNum(r.net)}</span>
        </div>
        <div className="mt-2"><Bar pct={r.net ? (r.collected / r.net) * 100 : 0} tone={r.done ? "in" : undefined} label="Collected" /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
          <div>Pool<div className="num text-sm font-bold text-ink">GHS {fmtNum(r.net)}</div></div>
          <div>Contributed<div className="num text-sm font-bold text-ink">GHS {fmtNum(r.funded)}</div></div>
          <div>Group holds<div className="num text-sm font-bold text-ink">GHS {fmtNum(view.cashHeld)}</div></div>
        </div>
      </div>
      {r.done
        ? <div className="note ok"><Icon name="check" />{r.recipient} has collected the full pool for {r.label}. To undo a payout, use Correction.</div>
        : <PayoutFields key={`${turn}-${view.rev}`} view={view} turn={r} />}
    </div>
  );
}

function PayoutFields({ view, turn: r }: { view: View; turn: View["turns"][number] }) {
  const [amount, setAmount] = useState(String(Math.min(r.remaining, Math.max(0, view.cashHeld))));
  const [date, setDate] = useState(() => { const d = parseDisplayDate(r.disbDate); return d ? isoDay(d) : view.today; });
  const [method, setMethod] = useState<string>("Cash");
  const [reference, setReference] = useState("");
  const [confirm, setConfirm] = useState(false);
  const { run, pending } = useAction();
  const toast = useToast();
  const amt = money(Number(amount || 0));
  const total = money(r.collected + amt);

  const check = () => {
    if (amt <= 0) return toast("Enter the amount paid out, greater than zero.", "error");
    if (amt > r.remaining + EPS) return toast(`Only GHS ${fmtNum(r.remaining)} is left to pay ${r.recipient} for ${r.label}.`, "error");
    const after = money(view.cashHeld - amt);
    if (after < -EPS) return toast(`The group only holds GHS ${fmtNum(view.cashHeld)}, so this would leave it GHS ${fmtNum(-after)} short. Record outstanding payments first, or enter a smaller amount.`, "error");
    setConfirm(true);
  };
  const dateLabel = parseIsoDay(date) ? formatDate(parseIsoDay(date)!) : date;

  return (
    <>
      <div className="form-grid">
        <label className="field sm:col-span-2"><span>Paid out to {r.recipient} now (GHS)</span>
          <input className="input big" type="number" min={0} max={r.remaining} step={50} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field"><span>Date</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <MethodSelect value={method} onChange={setMethod} />
        <label className="field"><span>Reference</span><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" maxLength={120} /></label>
      </div>
      <p className="caption">GHS {fmtNum(r.remaining)} still owed to {r.recipient}. Enter just what is handed over today; part payments add up.</p>
      <button className="btn primary big wide" disabled={pending} onClick={check}>Save payout</button>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Confirm payout">
        <div className="rounded-2xl bg-subtle p-4 text-center">
          <div className="text-xs text-muted">{r.recipient} receives</div>
          <div className="num mt-1 text-3xl font-bold tracking-tight">GHS {fmtNum(amt)}</div>
          <div className="mt-1 text-xs text-muted">on {dateLabel}</div>
        </div>
        <p className="caption">This brings {r.label} to GHS {fmtNum(total)} of GHS {fmtNum(r.net)}.</p>
        <DialogButtons confirm="Save payout" pending={pending} onCancel={() => setConfirm(false)}
          onConfirm={() => run(() => savePayout(view.rev, { turn: r.turn, memberId: r.memberId, amount: amt, date, method, reference }), () => setConfirm(false))} />
      </Dialog>
    </>
  );
}

// ── Correction: the original stays in the record, marked corrected or reversed ──
function CorrectionForm({ view, payments, payouts }: { view: View; payments: PaymentView[]; payouts: PayoutView[] }) {
  const [kind, setKind] = useState<"Payment" | "Payout">("Payment");
  const [payId, setPayId] = useState(payments[0]?.id ?? "");
  const [poId, setPoId] = useState(payouts[0]?.id ?? "");
  const [action, setAction] = useState<"reverse" | "change">("reverse");
  const [newAmount, setNewAmount] = useState("");
  const [reason, setReason] = useState("");
  const { run, pending } = useAction();
  const toast = useToast();
  const pay = useMemo(() => payments.find((p) => p.id === payId) ?? payments[0], [payments, payId]);
  const po = useMemo(() => payouts.find((p) => p.id === poId) ?? payouts[0], [payouts, poId]);
  const done = () => { setReason(""); setNewAmount(""); };

  return (
    <div className="stack">
      <div className="note info"><Icon name="history" />The original stays in the record, marked as corrected or reversed. A reason is required.</div>
      <div className="seg" role="group" aria-label="Correction type">
        {(["Payment", "Payout"] as const).map((k) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
      </div>
      {kind === "Payment" ? (
        !pay ? <p className="caption">No payments to correct.</p> : (
          <>
            <label className="field"><span>Payment</span><select className="input" value={pay.id} onChange={(e) => setPayId(e.target.value)}>
                {payments.map((p) => <option key={p.id} value={p.id}>{p.member} · Wk {pad(p.week)} · GHS {fmtNum(p.amount)} · {p.paidOn}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label className="field"><span>Action</span><select className="input" value={action} onChange={(e) => setAction(e.target.value as "reverse" | "change")}>
                  <option value="reverse">Reverse</option><option value="change">Change amount</option>
                </select>
              </label>
              <label className="field"><span>New amount (GHS)</span><input className="input" type="number" min={0} step={10} value={newAmount} disabled={action !== "change"} onChange={(e) => setNewAmount(e.target.value)} />
              </label>
            </div>
            <label className="field"><span>Reason</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
            <button className="btn primary big wide" disabled={pending} onClick={() => {
              if (!reason.trim()) return toast("Enter a reason.", "error");
              run(() => correctPayment(view.rev, { id: pay.id, action, newAmount: Number(newAmount || 0), reason }), done);
            }}>{pending ? "Saving…" : "Save correction"}</button>
          </>
        )
      ) : !po ? <p className="caption">No payouts to reverse.</p> : (
        <>
          <label className="field"><span>Payout</span><select className="input" value={po.id} onChange={(e) => setPoId(e.target.value)}>
              {payouts.map((p) => <option key={p.id} value={p.id}>{p.recipient} · Turn {p.turn} · GHS {fmtNum(p.amount)} · {p.paidOn}</option>)}
            </select>
          </label>
          <label className="field"><span>Reason</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></label>
          <button className="btn primary big wide" disabled={pending} onClick={() => {
            if (!reason.trim()) return toast("Enter a reason.", "error");
            run(() => reversePayout(view.rev, { id: po.id, reason }), done);
          }}>{pending ? "Saving…" : "Reverse payout"}</button>
        </>
      )}
    </div>
  );
}
