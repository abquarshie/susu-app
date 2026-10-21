"use server";
// Every change to the group goes through one of these Server Actions, and every money-moving one
// goes through commit(): a rev-guarded Postgres transaction that re-reads the records, re-checks
// the change against them, and logs it to Activity.

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { commit, Refused, type ActionResult } from "@/lib/commit";
import { prisma } from "@/lib/db";
import { currentAdmin, ensureGroup, loadRecords } from "@/lib/data";
import { EPS, fmtNum, formatDate, formatPlain, isoDay, METHODS, money, newId, parseIsoDay, parseNames, plural } from "@/lib/format";
import { memberListProblems, orderChanges, type Group } from "@/lib/model";
import { checkPw, hashPw, isScryptHash } from "@/lib/password";
import { COOKIE, cookieOptions, signSession } from "@/lib/session";

const MAX_FAILS = 5;
const MAX_MEMBERS = 100;
const LOCK_MS = 60_000;
const pad = (w: number) => String(w).padStart(2, "0");

// ── input checks: never trust what the browser sends ─────────────────────────
function num(v: unknown, name: string, min = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new Refused(`${name} is not a valid number.`);
  return n;
}
function int(v: unknown, name: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Refused(`${name} must be between ${min} and ${max}.`);
  return n;
}
function text(v: unknown, max = 200): string {
  return String(v ?? "").trim().slice(0, max);
}
function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
/** A list of ids from the browser, de-duplicated so a repeated id can't record a payment twice. */
function ids(v: unknown): string[] {
  if (!Array.isArray(v)) throw new Refused("The request was not valid. Reload the page and try again.");
  return [...new Set(v.filter((x): x is string => typeof x === "string"))];
}
function method(v: unknown): string {
  const m = String(v);
  return (METHODS as readonly string[]).includes(m) ? m : "Other";
}
function day(v: unknown): Date {
  const d = parseIsoDay(String(v));
  if (!d) throw new Refused("Enter a valid date.");
  return d;
}
function memberOf(g: Group, id: string) {
  const m = g.member(id);
  if (!m) throw new Refused("That member is no longer in the group. Nothing was saved.");
  return m;
}

// Every action checks the sign-in itself (not just proxy.ts), and always answers with a message:
// Refused thrown before commit() starts (bad input) reaches the user as-is, anything unexpected
// becomes a plain "nothing was changed" instead of a crashed request.
async function guard(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    await currentAdmin();
    return await fn();
  } catch (e) {
    unstable_rethrow(e); // let redirect() (e.g. session timed out) through
    if (e instanceof Refused) return { ok: false, kind: "error", message: e.message };
    console.error(e);
    return { ok: false, kind: "error", message: "Something went wrong. Nothing was changed. Please try again." };
  }
}

// ══ Sign-in ═══════════════════════════════════════════════════════════════════
export type SignInState = { error: string; name: string } | null;
export async function signIn(prev: SignInState, form: FormData): Promise<SignInState> {
  try {
    return await trySignIn(form);
  } catch (e) {
    unstable_rethrow(e); // the redirect to Overview on success
    console.error(e);
    return { error: "Sign-in is unavailable right now. Please try again in a moment.", name: text(form.get("name"), 40) };
  }
}

async function trySignIn(form: FormData): Promise<SignInState> {
  const name = text(form.get("name"), 40);
  const pw = str(form.get("passcode"), 200);
  const fail = (error: string) => ({ error, name });
  const group = await ensureGroup();
  const stored = group.passcodeHash || process.env.ADMIN_PASSCODE || "";

  if (group.lockedUntil && group.lockedUntil > new Date()) {
    const secs = Math.ceil((group.lockedUntil.getTime() - Date.now()) / 1000);
    return fail(`Too many attempts. Try again in ${secs} seconds.`);
  }
  if (!stored) return fail("No admin passcode is configured. Set ADMIN_PASSCODE in the environment first.");
  if (!name) return fail("Enter your name.");
  if (!checkPw(pw, stored)) {
    // atomic increment, so parallel wrong guesses can't slip past the lockout
    const { failedAttempts } = await prisma.group.update({ where: { id: 1 }, data: { failedAttempts: { increment: 1 } } });
    if (failedAttempts >= MAX_FAILS)
      await prisma.group.update({ where: { id: 1 }, data: { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MS) } });
    return fail("That passcode is not correct.");
  }
  await prisma.group.update({
    where: { id: 1 },
    data: { failedAttempts: 0, lockedUntil: null, ...(isScryptHash(group.passcodeHash) ? {} : { passcodeHash: hashPw(pw) }) },
  });
  (await cookies()).set(COOKIE, await signSession(name), cookieOptions);
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

// ══ Record: this week's checklist ═════════════════════════════════════════════
export async function saveWeek(rev: number, input: { week: number; method: string; date: string; paid: string[]; unpaid: string[] }) {
  return guard(async () => {
    const d = formatPlain(day(input.date));
    const meth = method(input.method);
    const paid = ids(input.paid), unpaid = ids(input.unpaid).filter((id) => !paid.includes(id));
    return commit(rev, `Week ${pad(input.week)} saved`, async ({ tx, g, who }) => {
      const wk = int(input.week, "Week", 1, g.weeks);
      const detail: string[] = [];
      let added = 0, reversed = 0;
      for (const id of paid) {
        const m = memberOf(g, id);
        const due = money(g.weekly(m) - g.paidAmount(m, wk));
        if (due <= EPS) continue;
        await tx.payment.create({
          data: { id: newId("PAY"), memberId: m.id, week: wk, amount: due, paidOn: d, method: meth, reference: "Weekly checklist", recordedBy: who },
        });
        added++;
        detail.push(`${m.name} Wk ${pad(wk)}: recorded GHS ${fmtNum(due)}`);
      }
      for (const id of unpaid) {
        const m = memberOf(g, id);
        if (!g.paid(m, wk)) continue;
        const res = await tx.payment.updateMany({
          where: { memberId: m.id, week: wk, status: "COMPLETED" },
          data: { status: "REVERSED", reversedAt: new Date(), reversedBy: who, reversalReason: "Unticked in weekly checklist" },
        });
        reversed++;
        detail.push(`${m.name} Wk ${pad(wk)}: reversed GHS ${fmtNum(g.paidAmount(m, wk))} (${plural(res.count, "payment")})`);
      }
      if (!added && !reversed) throw new Refused("No changes to save.");
      return { type: "payment", text: `Week ${pad(wk)}: ${added} recorded, ${reversed} reversed`, detail };
    });
  });
}

// ══ Record: single payment ════════════════════════════════════════════════════
export async function savePayment(rev: number, input: { memberId: string; week: number; amount: number; method: string; reference: string; date: string }) {
  return guard(async () => {
    const amount = money(num(input.amount, "Amount"));
    if (amount <= 0) throw new Refused("Enter an amount greater than zero.");
    const d = formatPlain(day(input.date));
    const ref = text(input.reference, 120), meth = method(input.method);
    let name = "";
    const res = await commit(rev, "", async ({ tx, g, who }) => {
      const m = memberOf(g, input.memberId);
      const wk = int(input.week, "Week", 1, g.weeks);
      name = m.name;
      const id = newId("PAY");
      await tx.payment.create({ data: { id, memberId: m.id, week: wk, amount, paidOn: d, method: meth, reference: ref, recordedBy: who } });
      const banked = money(g.paidAmount(m, wk) + amount);
      return {
        type: "payment", text: `Payment received: ${m.name} · Week ${pad(wk)} · GHS ${fmtNum(amount)}`,
        detail: [`method: ${meth}`, `reference: ${ref || "—"}`, `banked for the week: GHS ${fmtNum(banked)} of ${fmtNum(g.weekly(m))}`, `receipt: ${id}`],
      };
    });
    return res.ok ? { ...res, message: `Payment saved for ${name}. Its receipt is under Share.` } : res;
  });
}

// ══ Record: payout ════════════════════════════════════════════════════════════
export async function savePayout(rev: number, input: { turn: number; memberId: string; amount: number; date: string; method: string; reference: string }) {
  return guard(async () => {
    const amount = money(num(input.amount, "Amount"));
    if (amount <= 0) throw new Refused("Enter the amount paid out, greater than zero.");
    const dstr = formatDate(day(input.date));
    const ref = text(input.reference, 120), meth = method(input.method);
    let rec = "";
    const res = await commit(rev, "", async ({ tx, g, who }) => {
      const i = int(input.turn, "Turn", 1, g.n) - 1;
      const r = g.schedule[i];
      if (r.memberId !== input.memberId)
        throw new Refused(`The rotation changed since you loaded this page, so ${r.turn} no longer belongs to that member. Nothing was saved.`);
      rec = r.recipient;
      if (amount > r.remaining + EPS)
        throw new Refused(`Only GHS ${fmtNum(r.remaining)} is left to pay ${r.recipient} for ${r.turn}.`);
      if (money(g.cashHeld - amount) < -EPS)
        throw new Refused(`The group only holds GHS ${fmtNum(g.cashHeld)}, so this would leave it GHS ${fmtNum(amount - g.cashHeld)} short. Record outstanding payments first, or enter a smaller amount.`);
      await tx.turnLock.upsert({
        where: { turn: i + 1 },
        create: { turn: i + 1, memberId: r.memberId, net: r.net, fee: r.fee, disbursedDate: dstr },
        update: { disbursedDate: dstr },
      });
      const id = newId("PAYOUT");
      await tx.payout.create({ data: { id, turn: i + 1, memberId: r.memberId, amount, paidOn: dstr, method: meth, reference: ref, recordedBy: who } });
      const total = money(r.collected + amount);
      const full = total >= r.net - EPS;
      return {
        type: "payout",
        text: full ? `${r.turn} fully collected by ${r.recipient}: GHS ${fmtNum(total)}` : `${r.turn} part collected by ${r.recipient}: GHS ${fmtNum(total)} of GHS ${fmtNum(r.net)}`,
        detail: [`${r.turn} collected: GHS ${fmtNum(r.collected)} → GHS ${fmtNum(total)}`, `balance owed to ${r.recipient}: GHS ${fmtNum(r.net - total)}`,
          `method: ${meth}`, `date: ${dstr}`, `receipt: ${id}`],
      };
    });
    return res.ok ? { ...res, message: `Payout for ${rec} saved` } : res;
  });
}

// ══ Record: corrections ═══════════════════════════════════════════════════════
export async function correctPayment(rev: number, input: { id: string; action: "reverse" | "change"; newAmount: number; reason: string }) {
  return guard(async () => {
    const reason = text(input.reason, 200);
    if (!reason) throw new Refused("Enter a reason.");
    if (input.action !== "reverse" && input.action !== "change") throw new Refused("Choose Reverse or Change amount.");
    const newAmt = input.action === "change" ? money(num(input.newAmount, "New amount")) : 0;
    const id = str(input.id, 64);
    return commit(rev, "Correction saved", async ({ tx, g, who }) => {
      const row = await tx.payment.findUnique({ where: { id } });
      if (!row || row.status !== "COMPLETED") throw new Refused("That payment has already been reversed or no longer exists.");
      const m = memberOf(g, row.memberId);
      const old = money(row.amount);
      let textOut: string;
      if (input.action === "reverse") {
        await tx.payment.update({ where: { id: row.id }, data: { status: "REVERSED", reversedAt: new Date(), reversedBy: who, reversalReason: reason } });
        textOut = `Payment reversed: ${m.name} · Week ${pad(row.week)} · GHS ${fmtNum(old)}`;
      } else {
        if (newAmt <= 0) throw new Refused("Enter the new amount, or choose Reverse.");
        await tx.payment.update({ where: { id: row.id }, data: { amount: newAmt, correctedAt: new Date(), correctedBy: who, correctionReason: reason } });
        textOut = `Payment corrected: ${m.name} · Week ${pad(row.week)} · GHS ${fmtNum(old)} → GHS ${fmtNum(newAmt)}`;
      }
      const banked = money(g.paidAmount(m, row.week) - old + (input.action === "reverse" ? 0 : newAmt));
      return { type: "payment", text: textOut, detail: [`receipt: ${row.id}`, `reason: ${reason}`, `still banked for the week: GHS ${fmtNum(banked)}`] };
    }, "warning");
  });
}

export async function reversePayout(rev: number, input: { id: string; reason: string }) {
  return guard(async () => {
    const reason = text(input.reason, 200);
    if (!reason) throw new Refused("Enter a reason.");
    const id = str(input.id, 64);
    return commit(rev, "Payout reversed", async ({ tx, g, who }) => {
      const p = await tx.payout.findUnique({ where: { id } });
      if (!p || p.status !== "ACTIVE") throw new Refused("That payout has already been reversed or no longer exists.");
      await tx.payout.update({ where: { id: p.id }, data: { status: "REVERSED", reversedAt: new Date(), reversedBy: who, reversalReason: reason } });
      const cur = g.turnCollected(p.turn);
      const left = money(Math.max(0, cur - money(p.amount)));
      if (left <= EPS) await tx.turnLock.deleteMany({ where: { turn: p.turn } }); // pool unfreezes once nothing is paid
      const recipient = g.member(p.memberId)?.name ?? "former member";
      return {
        type: "payout", text: `Payout reversed: ${recipient} · Turn ${p.turn} · GHS ${fmtNum(p.amount)}`,
        detail: [`receipt: ${p.id}`, `reason: ${reason}`, `Turn ${p.turn} collected: GHS ${fmtNum(cur)} → GHS ${fmtNum(left)}`],
      };
    }, "warning");
  });
}

// ══ Overview: count cash ══════════════════════════════════════════════════════
export async function countCash(rev: number, input: { actual: number; note: string }) {
  return guard(async () => {
    const actual = money(num(input.actual, "Counted amount"));
    const note = text(input.note, 200);
    return commit(rev, "Cash count saved", async ({ tx, g, who }) => {
      const diff = money(actual - g.cashHeld);
      await tx.reconciliation.create({ data: { actual, system: g.cashHeld, difference: diff, note, who } });
      return {
        type: "setting", text: `Cash counted: GHS ${fmtNum(actual)} against GHS ${fmtNum(g.cashHeld)} on record`,
        detail: [`difference: GHS ${fmtNum(diff)}`, `note: ${note || "—"}`],
      };
    });
  });
}

// ══ Settings: group ═══════════════════════════════════════════════════════════
export async function saveSettings(rev: number, input: { startDate: string; baseMonthly: number; adminFeePct: number; names: string }) {
  return guard(async () => {
    const start = day(input.startDate);
    const base = money(num(input.baseMonthly, "Monthly contribution"));
    if (base <= 0) throw new Refused("The monthly contribution must be more than zero.");
    const fee = money(num(input.adminFeePct, "Admin fee"));
    if (fee > 100) throw new Refused("The admin fee can't be more than 100%.");
    const names = parseNames(str(input.names, 6000)).map((n) => n.slice(0, 40).trim()).filter(Boolean);
    if (names.length > MAX_MEMBERS) throw new Refused(`A group can have at most ${MAX_MEMBERS} members.`);
    return commit(rev, "Settings saved", async ({ tx, g }) => {
      const s = g.rec.settings;
      const oldNames = g.members.map((m) => m.name);
      const startChanged = isoDay(start) !== s.startDate;
      const withRecords = new Set(g.rec.payments.map((p) => p.memberId).concat(g.rec.payouts.map((p) => p.memberId)));
      const hasRecords = (name: string) => {
        const m = g.members.find((x) => x.name === name);
        return !!m && (withRecords.has(m.id) || m.tier != null || m.exitWeek != null);
      };
      const errs = memberListProblems(g, names, hasRecords, startChanged);
      if (errs.length) throw new Refused("Settings not saved. " + errs.join(" "));

      const changes: string[] = [];
      if (startChanged) changes.push(`start date ${s.startDate} → ${isoDay(start)}`);
      if (base !== s.baseMonthly) changes.push(`monthly contribution ${fmtNum(s.baseMonthly)} → ${fmtNum(base)}`);
      if (fee !== s.adminFeePct) changes.push(`admin fee ${s.adminFeePct}% → ${fee}%`);
      const listChanged = names.join("\u0000") !== oldNames.join("\u0000");
      if (listChanged) changes.push(...orderChanges(oldNames, names));
      if (!changes.length) throw new Refused("Nothing changed.");

      await tx.group.update({ where: { id: 1 }, data: { startDate: start, baseMonthly: base, adminFeePct: fee } });
      if (listChanged) {
        // park everyone on negative slots first so the unique(position) index never clashes mid-update
        for (const m of g.members) await tx.member.update({ where: { id: m.id }, data: { position: -1 - m.position } });
        for (const m of g.members) if (!names.includes(m.name)) await tx.member.delete({ where: { id: m.id } });
        for (const [position, name] of names.entries()) {
          await tx.member.upsert({ where: { name }, update: { position }, create: { name, position } });
        }
      }
      return { type: "setting", text: "Group settings updated", detail: changes };
    });
  });
}

// ══ Settings: members (tiers, exits, rename, swap) ════════════════════════════
export async function saveMembers(rev: number, rows: { memberId: string; tier: number; exitWeek: number | null }[]) {
  return guard(async () => commit(rev, "Member details saved", async ({ tx, g }) => {
    if (!Array.isArray(rows)) throw new Refused("The request was not valid. Reload the page and try again.");
    const detail: string[] = [];
    for (const row of rows) {
      const m = memberOf(g, row?.memberId);
      const tier = money(num(row.tier, `${m.name}'s monthly amount`));
      if (tier <= 0) throw new Refused(`${m.name}'s monthly amount must be more than zero.`);
      const exit = row.exitWeek == null ? null : int(row.exitWeek, `${m.name}'s leaving week`, 1, g.weeks);
      const data: { monthlyTier?: number | null; exitWeek?: number | null } = {};
      if (Math.abs(tier - g.tier(m)) > EPS) {
        data.monthlyTier = tier;
        detail.push(`${m.name}: monthly GHS ${fmtNum(g.tier(m))} → GHS ${fmtNum(tier)}`);
      }
      if (exit !== m.exitWeek) {
        data.exitWeek = exit;
        detail.push(exit ? `${m.name}: left in week ${exit}` : `${m.name}: back to active`);
      }
      if (Object.keys(data).length) await tx.member.update({ where: { id: m.id }, data });
    }
    if (!detail.length) throw new Refused("Nothing changed.");
    return { type: "setting", text: `Member details updated (${plural(detail.length, "change")})`, detail };
  }));
}

export async function renameMember(rev: number, memberId: string, newName: string) {
  return guard(async () => {
    const clean = text(str(newName, 200).replace(/,/g, " ").replace(/\s+/g, " "), 40);
    if (!clean) throw new Refused("Enter the new name.");
    let old = "";
    const res = await commit(rev, "", async ({ tx, g }) => {
      const m = memberOf(g, memberId);
      old = m.name;
      if (clean === m.name) throw new Refused("That is already the name.");
      if (g.members.some((x) => x.id !== m.id && x.name.toLowerCase() === clean.toLowerCase()))
        throw new Refused(`There is already a member called ${clean}.`);
      await tx.member.update({ where: { id: m.id }, data: { name: clean } });
      return { type: "setting", text: `Member renamed: ${m.name} → ${clean}`, detail: ["payments, receipts, tier and payouts follow the member automatically"] };
    });
    return res.ok ? { ...res, message: `${old} renamed to ${clean}` } : res;
  });
}

export async function swapTurns(rev: number, a: string, b: string) {
  return guard(async () => {
    let msg = "";
    const res = await commit(rev, "", async ({ tx, g }) => {
      const ma = memberOf(g, a), mb = memberOf(g, b);
      if (ma.id === mb.id) throw new Refused("Pick two different members.");
      const locked = g.lockedTurns();
      if (locked.has(ma.position) || locked.has(mb.position))
        throw new Refused("One of those turns now has a payout recorded, so it can't be swapped.");
      await tx.member.update({ where: { id: ma.id }, data: { position: -1 } });
      await tx.member.update({ where: { id: mb.id }, data: { position: ma.position } });
      await tx.member.update({ where: { id: ma.id }, data: { position: mb.position } });
      msg = `${ma.name} and ${mb.name} swapped turns`;
      return {
        type: "setting", text: `Turns swapped: ${ma.name} ⇄ ${mb.name}`,
        detail: [`${ma.name}: Turn ${ma.position + 1} → Turn ${mb.position + 1}`, `${mb.name}: Turn ${mb.position + 1} → Turn ${ma.position + 1}`],
      };
    });
    return res.ok ? { ...res, message: msg } : res;
  });
}

// ══ Settings: account and data ════════════════════════════════════════════════
export async function changePasscode(rev: number, input: { current: string; next: string; repeat: string }) {
  return guard(async () => {
    const current = str(input.current), next = str(input.next), repeat = str(input.repeat);
    const group = await prisma.group.findUniqueOrThrow({ where: { id: 1 } });
    if (!checkPw(current, group.passcodeHash || process.env.ADMIN_PASSCODE)) throw new Refused("The current passcode is not correct.");
    if (next.length < 8) throw new Refused("The new passcode must be at least 8 characters.");
    if (next !== repeat) throw new Refused("The two new passcodes do not match.");
    const hash = hashPw(next);
    return commit(rev, "Passcode changed", async ({ tx }) => {
      await tx.group.update({ where: { id: 1 }, data: { passcodeHash: hash } });
      return { type: "setting", text: "Passcode changed" };
    });
  });
}

/** Full JSON copy of the group, for the Download backup button. The passcode hash is left out. */
export async function exportData(): Promise<string> {
  await currentAdmin();
  const [rec, activity, reconciliations, snapshots] = await Promise.all([
    loadRecords(),
    prisma.activity.findMany({ orderBy: { at: "desc" } }),
    prisma.reconciliation.findMany({ orderBy: { countedAt: "desc" } }),
    prisma.snapshot.findMany({ orderBy: { week: "asc" } }),
  ]);
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...rec, activity, reconciliations, snapshots }, null, 2);
}
