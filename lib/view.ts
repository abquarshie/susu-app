// A plain, serialisable snapshot of the model for Client Components.
import { formatShort } from "./format";
import type { Group, PaymentRec, PayoutRec } from "./model";

export type MemberView = {
  id: string; name: string; turn: number; weekly: number; tier: number; exitWeek: number | null;
  amounts: number[]; // index w-1 → completed amount for week w
};
export type TurnView = {
  turn: number; label: string; memberId: string; recipient: string; dateS: string; short: string; net: number;
  collected: number; remaining: number; funded: number; done: boolean; locked: boolean; disbDate: string;
};
export type View = {
  rev: number; week: number; weeks: number; n: number; cashHeld: number; base: number; today: string;
  members: MemberView[]; turns: TurnView[]; nextTurn: number | null;
};

export function toView(g: Group): View {
  const locked = g.lockedTurns();
  return {
    rev: g.rec.settings.rev, week: g.week, weeks: g.weeks, n: g.n, cashHeld: g.cashHeld, base: g.base,
    today: g.today.toISOString().slice(0, 10),
    members: g.members.map((m) => ({
      id: m.id, name: m.name, turn: m.position + 1, weekly: g.weekly(m), tier: g.tier(m), exitWeek: m.exitWeek,
      amounts: Array.from({ length: g.weeks }, (_, i) => g.paidAmount(m, i + 1)),
    })),
    turns: g.schedule.map((r) => ({
      turn: r.index + 1, label: r.turn, memberId: r.memberId, recipient: r.recipient, dateS: r.dateS, short: formatShort(r.date),
      net: r.net, collected: r.collected, remaining: r.remaining, funded: r.funded, done: r.done,
      locked: locked.has(r.index), disbDate: r.disbDate,
    })),
    nextTurn: g.nextTurn ? g.nextTurn.index + 1 : null,
  };
}

export type PaymentView = PaymentRec & { member: string };
export type PayoutView = PayoutRec & { recipient: string };

export function namedPayments(g: Group): PaymentView[] {
  return g.rec.payments.map((p) => ({ ...p, member: g.member(p.memberId)?.name ?? "former member" }));
}
export function namedPayouts(g: Group): PayoutView[] {
  return g.rec.payouts.map((p) => ({ ...p, recipient: g.member(p.memberId)?.name ?? "former member" }));
}
