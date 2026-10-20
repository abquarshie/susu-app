// Every derived figure, computed once per request from plain records.
// Pure functions only: the same code runs on the server and validates inside transactions.
import { EPS, addWeeks, dayDiff, fmtNum, formatDate, money } from "./format";

export type MemberRec = { id: string; name: string; position: number; tier: number | null; exitWeek: number | null };
export type PaymentRec = {
  id: string; memberId: string; week: number; amount: number; paidOn: string; method: string;
  reference: string; status: "COMPLETED" | "REVERSED"; recordedBy: string; recordedAt: string;
};
export type PayoutRec = {
  id: string; turn: number; memberId: string; amount: number; paidOn: string; method: string;
  reference: string; status: "ACTIVE" | "REVERSED"; recordedBy: string; recordedAt: string;
};
export type TurnLockRec = { turn: number; memberId: string; net: number; fee: number; disbursedDate: string };
export type SettingsRec = { rev: number; startDate: string; baseMonthly: number; adminFeePct: number };

export type Records = {
  settings: SettingsRec;
  members: MemberRec[];
  payments: PaymentRec[];
  payouts: PayoutRec[];
  locks: TurnLockRec[];
};

export type MemberRow = {
  id: string; member: string; weekly: number; owing: number; streak: number; exited: boolean;
  exitWeek: number | null; ahead: number; standing: string; paidTotal: number;
};

export type TurnRow = {
  index: number; turn: string; memberId: string; recipient: string; date: Date; dateS: string; fee: number;
  net: number; collected: number; remaining: number; funded: number; pctFunded: number; pctCollected: number;
  done: boolean; locked: boolean; disbDate: string; days: number | null; exited: boolean;
};

const k = (memberId: string, week: number) => `${memberId}\u0000${week}`;

export class Group {
  readonly members: MemberRec[];
  readonly n: number;
  readonly weeks: number;
  readonly base: number;
  readonly feePct: number;
  readonly fee: number;
  readonly start: Date;
  readonly end: Date;
  readonly week: number;
  readonly collected: number;
  readonly paidOut: number;
  readonly cashHeld: number;
  readonly rows: MemberRow[];
  readonly gap: number;
  readonly schedule: TurnRow[];
  readonly nextTurn: TurnRow | null;
  readonly nextByDate: TurnRow | null;
  private amt = new Map<string, number>();
  private turnCol = new Map<number, number>();
  private byId = new Map<string, MemberRec>();

  constructor(readonly rec: Records, readonly today: Date) {
    const s = rec.settings;
    this.members = [...rec.members].sort((a, b) => a.position - b.position);
    this.members.forEach((m) => this.byId.set(m.id, m));
    this.n = this.members.length;
    this.weeks = this.n * 4; // fixed rotation: exits never shift dates
    this.base = s.baseMonthly;
    this.feePct = s.adminFeePct;
    this.fee = this.feePct / 100;
    this.start = new Date(`${s.startDate}T00:00:00Z`);
    this.end = addWeeks(this.start, this.weeks);
    const since = dayDiff(today, this.start);
    this.week = since < 0 ? 0 : Math.min(Math.floor(since / 7) + 1, this.weeks);

    for (const p of rec.payments) {
      if (p.status !== "COMPLETED") continue;
      const key = k(p.memberId, p.week);
      this.amt.set(key, money((this.amt.get(key) ?? 0) + p.amount));
    }
    for (const p of rec.payouts) {
      if (p.status !== "ACTIVE") continue;
      this.turnCol.set(p.turn, money((this.turnCol.get(p.turn) ?? 0) + p.amount));
    }

    this.collected = money([...this.amt.entries()].reduce((t, [key, v]) => (this.byId.has(key.split("\u0000")[0]) ? t + v : t), 0));
    this.paidOut = money([...this.turnCol.values()].reduce((a, b) => a + b, 0));
    this.cashHeld = money(this.collected - this.paidOut);
    this.rows = this.members.map((m) => this.memberRow(m));
    this.gap = money(this.rows.reduce((t, r) => t + r.owing, 0));
    this.schedule = this.members.map((m, i) => this.turnRow(i, m));
    this.nextTurn = this.schedule.find((r) => !r.done) ?? null;
    this.nextByDate = this.schedule.find((r) => dayDiff(r.date, today) >= 0) ?? null;
  }

  member(id: string) { return this.byId.get(id); }
  tier(m: MemberRec) { return m.tier ?? this.base; }
  weekly(m: MemberRec) { return money(this.tier(m) / 4); }
  paidAmount(m: MemberRec, w: number) { return this.amt.get(k(m.id, w)) ?? 0; }
  paid(m: MemberRec, w: number) { return this.paidAmount(m, w) >= this.weekly(m) - EPS; }
  exited(m: MemberRec) { return m.exitWeek != null; }
  exitWeek(m: MemberRec) { return m.exitWeek ?? this.weeks; }
  liable(m: MemberRec, w: number) { return !(this.exited(m) && w > this.exitWeek(m)); }
  turnCollected(turn: number) { return this.turnCol.get(turn) ?? 0; }
  lockedTurns(): Set<number> {
    const s = new Set(this.rec.locks.map((l) => l.turn - 1));
    for (const [t, v] of this.turnCol) if (v > 0) s.add(t - 1);
    return s;
  }

  private memberRow(m: MemberRec): MemberRow {
    const wk = this.weekly(m);
    const due: number[] = [];
    for (let w = 1; w <= this.week; w++) if (this.liable(m, w)) due.push(w);
    const paidSoFar = money(due.reduce((t, w) => t + this.paidAmount(m, w), 0));
    const owing = money(Math.max(0, due.length * wk - paidSoFar));
    const ex = this.exited(m);
    let streak = 0;
    if (!(ex && owing <= 0)) {
      for (let w = Math.min(this.week, this.exitWeek(m)); w > 0; w--) {
        if (this.paid(m, w)) break;
        streak++;
      }
    }
    let totalPaid = 0, paidTotal = 0;
    for (let w = 1; w <= this.weeks; w++) {
      if (this.paid(m, w)) totalPaid++;
      paidTotal += this.paidAmount(m, w);
    }
    const paidDue = due.filter((w) => this.paid(m, w)).length;
    return {
      id: m.id, member: m.name, weekly: wk, owing, streak, exited: ex, exitWeek: m.exitWeek,
      ahead: totalPaid - paidDue, paidTotal: money(paidTotal),
      standing: owing > 0 ? `Owing GHS ${fmtNum(owing)}` : ex ? "Exited" : "Up to date",
    };
  }

  private turnRow(i: number, m: MemberRec): TurnRow {
    const turn = i + 1;
    const date = addWeeks(this.start, 4 * turn);
    const lock = this.rec.locks.find((l) => l.turn === turn);
    const col = this.turnCollected(turn);
    let net: number, fee: number;
    if (lock) {
      // Pool frozen at first payout, so later tier, fee or member changes can't reopen a paid turn.
      net = money(lock.net);
      fee = money(lock.fee);
    } else {
      const gross = money(this.tier(m) * this.n);
      fee = money(gross * this.fee);
      net = money(gross - fee);
    }
    let raw = 0;
    for (const x of this.members) for (let w = 4 * i + 1; w <= 4 * i + 4; w++) raw += this.paidAmount(x, w);
    const funded = money(raw * (1 - this.fee));
    const remaining = money(Math.max(0, net - col));
    const days = dayDiff(date, this.today);
    return {
      index: i, turn: `Turn ${turn}`, memberId: m.id, recipient: m.name, date, dateS: formatDate(date), fee, net,
      collected: col, remaining, funded,
      pctFunded: net ? Math.floor(Math.min(funded / net, 1) * 100) : 0,
      pctCollected: net ? Math.floor(Math.min(col / net, 1) * 100) : 0,
      done: col > 0 && col >= net - EPS, locked: !!lock || col > 0,
      disbDate: lock?.disbursedDate ?? "", days: days >= 0 ? days : null, exited: this.exited(m),
    };
  }
}

/** Reasons a member-list or start-date change would corrupt records. Empty means safe. */
export function memberListProblems(
  g: Group, newNames: string[], hasRecords: (name: string) => boolean, startChanged: boolean,
): string[] {
  const old = g.members.map((m) => m.name);
  const errs: string[] = [];
  const low = newNames.map((n) => n.toLowerCase());
  const dups = [...new Set(newNames.filter((n) => low.filter((x) => x === n.toLowerCase()).length > 1))].sort();
  if (dups.length) errs.push(`Each name must be unique. Duplicated: ${dups.join(", ")}.`);
  if (newNames.length < 2) errs.push("The group needs at least 2 members.");
  const gone = old.filter((m) => !newNames.includes(m) && hasRecords(m));
  if (gone.length)
    errs.push(`${gone.join(", ")} would lose their payment history. To fix a spelling use Rename. To remove someone mid-cycle, set the week they left under Members.`);
  const locked = g.lockedTurns();
  if (locked.size && newNames.length !== old.length) {
    errs.push("Payouts have already been made this cycle, so members can't be added or removed. That would move every payout date and change every pool.");
  } else if (locked.size) {
    const moved = [...locked].sort((a, b) => a - b)
      .filter((i) => i < old.length && (i >= newNames.length || newNames[i] !== old[i]))
      .map((i) => `Turn ${i + 1} (${old[i]})`);
    if (moved.length) errs.push(`${moved.join(", ")} already has a payout recorded, so its recipient can't change.`);
  }
  if (locked.size && startChanged) errs.push("Payouts have already been made this cycle, so the start date can't change.");
  return errs;
}

export function orderChanges(old: string[], next: string[]): string[] {
  const pos = new Map(old.map((m, i) => [m, i]));
  const out = next.flatMap((m, i) =>
    pos.get(m) === i ? [] : [pos.has(m) ? `${m}: Turn ${pos.get(m)! + 1} → Turn ${i + 1}` : `${m}: added as Turn ${i + 1}`]);
  return [...out, ...old.filter((m) => !next.includes(m)).map((m) => `${m}: removed`)];
}
