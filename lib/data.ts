import "server-only";
import { cache } from "react";
import { after } from "next/server";
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

// Only the columns the model uses: the audit fields (reversedBy, correctionReason…) stay in the database.
const LEDGER = {
  id: true, memberId: true, amount: true, paidOn: true, method: true, reference: true,
  status: true, recordedBy: true, recordedAt: true,
} as const;

/** All records in one parallel round trip, or null when the group row doesn't exist yet. */
async function readRecords(db: Db): Promise<Records | null> {
  const [group, members, payments, payouts, locks] = await Promise.all([
    db.group.findUnique({ where: { id: 1 }, select: { rev: true, startDate: true, baseMonthly: true, adminFeePct: true } }),
    db.member.findMany({ orderBy: { position: "asc" } }),
    db.payment.findMany({ orderBy: { recordedAt: "desc" }, select: { ...LEDGER, week: true } }),
    db.payout.findMany({ orderBy: { recordedAt: "desc" }, select: { ...LEDGER, turn: true } }),
    db.turnLock.findMany(),
  ]);
  if (!group) return null;
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

export async function loadRecords(db: Db = prisma): Promise<Records> {
  const rec = await readRecords(db);
  if (!rec) throw new Error("The group has not been set up yet.");
  return rec;
}

/** Everything a page needs. Also records this week's opening cash the first time the week is seen. */
export const loadGroup = cache(async () => {
  let rec = await readRecords(prisma);
  if (!rec) {
    await ensureGroup(); // first run only; normally the group row is already there
    rec = await loadRecords();
  }
  const g = new Group(rec, new Date());
  if (g.week > 0) {
    // After the response is sent, so it never slows or breaks a page. ON CONFLICT DO NOTHING keeps the first figure.
    const snap = { week: g.week, cashHeld: g.cashHeld };
    after(() => prisma.snapshot.createMany({ data: [snap], skipDuplicates: true }).catch((e) => console.error("snapshot", e)));
  }
  return { g, rec };
});

export async function currentAdmin(): Promise<string> {
  const s = await verifySession((await cookies()).get(COOKIE)?.value);
  if (!s) redirect("/login?timeout=1");
  return s.name;
}
