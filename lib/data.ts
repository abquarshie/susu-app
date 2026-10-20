import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, type Tx } from "./db";
import { money, parseNames } from "./format";
import { Group, type Records } from "./model";
import { hashPw } from "./password";
import { COOKIE, verifySession } from "./session";

export const DEFAULTS = {
  startDate: "2026-08-17",
  baseMonthly: 1000,
  adminFeePct: 0,
  names: "Alice, Bob, Charlie, Diana, Frank, Grace",
};

type Db = Tx | typeof prisma;

/** First run on an empty database: create the group row and sample members. The import script replaces these. */
export async function ensureGroup(db: Db = prisma) {
  const existing = await db.group.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  const boot = process.env.ADMIN_PASSCODE ?? "";
  return prisma.$transaction(async (tx) => {
    const again = await tx.group.findUnique({ where: { id: 1 } });
    if (again) return again;
    const g = await tx.group.create({
      data: {
        id: 1, startDate: new Date(`${DEFAULTS.startDate}T00:00:00Z`), baseMonthly: DEFAULTS.baseMonthly,
        adminFeePct: DEFAULTS.adminFeePct, passcodeHash: boot ? hashPw(boot) : "",
      },
    });
    await tx.member.createMany({ data: parseNames(DEFAULTS.names).map((name, position) => ({ name, position })) });
    await tx.activity.create({ data: { type: "setting", text: "Group created with sample members", detail: [], who: "system" } });
    return g;
  });
}

export async function loadRecords(db: Db = prisma): Promise<Records> {
  const [group, members, payments, payouts, locks] = await Promise.all([
    db.group.findUniqueOrThrow({ where: { id: 1 } }),
    db.member.findMany({ orderBy: { position: "asc" } }),
    db.payment.findMany({ orderBy: { recordedAt: "desc" } }),
    db.payout.findMany({ orderBy: { recordedAt: "desc" } }),
    db.turnLock.findMany(),
  ]);
  return {
    settings: {
      rev: group.rev, startDate: group.startDate.toISOString().slice(0, 10),
      baseMonthly: money(group.baseMonthly), adminFeePct: Number(group.adminFeePct),
    },
    members: members.map((m) => ({
      id: m.id, name: m.name, position: m.position,
      tier: m.monthlyTier == null ? null : money(m.monthlyTier), exitWeek: m.exitWeek,
    })),
    payments: payments.map((p) => ({
      id: p.id, memberId: p.memberId, week: p.week, amount: money(p.amount), paidOn: p.paidOn, method: p.method,
      reference: p.reference, status: p.status, recordedBy: p.recordedBy, recordedAt: p.recordedAt.toISOString(),
    })),
    payouts: payouts.map((p) => ({
      id: p.id, turn: p.turn, memberId: p.memberId, amount: money(p.amount), paidOn: p.paidOn, method: p.method,
      reference: p.reference, status: p.status, recordedBy: p.recordedBy, recordedAt: p.recordedAt.toISOString(),
    })),
    locks: locks.map((l) => ({ turn: l.turn, memberId: l.memberId, net: money(l.net), fee: money(l.fee), disbursedDate: l.disbursedDate })),
  };
}

/** Everything a page needs. Also records this week's opening cash the first time the week is seen. */
export const loadGroup = cache(async () => {
  await ensureGroup();
  const rec = await loadRecords();
  const g = new Group(rec, new Date());
  if (g.week > 0) {
    await prisma.snapshot.upsert({ where: { week: g.week }, create: { week: g.week, cashHeld: g.cashHeld }, update: {} });
  }
  return { g, rec };
});

export async function currentAdmin(): Promise<string> {
  const s = await verifySession((await cookies()).get(COOKIE)?.value);
  if (!s) redirect("/login?timeout=1");
  return s.name;
}
