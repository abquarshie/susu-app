/**
 * One-time move from the Streamlit app: loads blob.json (made by scripts/export_blob.py) into Postgres.
 *
 *   npm run import:sheets -- blob.json            # check what would be imported, writes nothing
 *   npm run import:sheets -- blob.json --write    # import into an empty database
 *   npm run import:sheets -- blob.json --write --replace   # wipe the database first
 *
 * Everything happens in one transaction: it either all lands or nothing does.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../lib/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

type Obj = Record<string, any>; // the blob is untyped JSON from the old app
const EPS = 0.005;
const money = (x: unknown) => Math.round((Number(x) || 0) * 100 + 1e-7) / 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "20 Oct 2026 09:03" → Date (Ghana time is UTC). Falls back to the given default. */
function stamp(s: unknown, fallback: Date): Date {
  const m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(String(s ?? "").trim());
  if (!m) return fallback;
  const mon = MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase());
  return mon < 0 ? fallback : new Date(Date.UTC(+m[3], mon, +m[1], +(m[4] ?? 0), +(m[5] ?? 0)));
}
const names = (txt: string) => String(txt).split(",").map((n) => n.replace(/\s+/g, " ").trim()).filter(Boolean);
const collectedOf = (ps: Obj) => money(ps.collected ?? ps.disbursed_amount ?? ps.amount_collected ?? 0);
const turnOf = (lbl: unknown) => { const m = /^(?:Turn|Month) (\d+)$/.exec(String(lbl)); return m ? +m[1] : null; };

/** Pure conversion of the old blob into table rows. Exported for scripts/check-model.ts. */
export function convert(b: Obj) {
  const s: Obj = { start_date: "2026-08-17", base_monthly: 1000, admin_fee_percentage: 0, names_input: "", ...(b.settings ?? {}) };
  const now = new Date();
  const warn: string[] = [];

  // ── members, in payout order
  const list = names(s.names_input);
  if (list.length < 2) throw new Error("The blob has fewer than 2 members; nothing to import.");
  const base = money(s.base_monthly), feePct = Number(s.admin_fee_percentage) || 0, n = list.length;
  const tiers: Obj = b.tiers ?? {}, status: Obj = b.member_status ?? {};
  const members = list.map((name, position) => ({
    id: `m${position + 1}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`.slice(0, 40), name, position,
    monthlyTier: name in tiers ? money(tiers[name]) : null,
    exitWeek: status[name]?.status === "exited" && status[name]?.exit_week ? Number(status[name].exit_week) : null,
  }));
  const idOf = new Map(members.map((m) => [m.name, m.id]));
  const weekly = (name: string) => money((name in tiers ? Number(tiers[name]) : base) / 4);

  // ── payments: itemised transactions, plus old ticks that never got one
  const txs: Obj[] = b.payment_transactions ?? [];
  const seen = new Set<string>();
  const payments = txs.flatMap((t) => {
    const memberId = idOf.get(t.member);
    if (!memberId) { warn.push(`payment ${t.id}: member "${t.member}" is not in the member list, skipped`); return []; }
    seen.add(`${t.member}|${Number(t.week)}`);
    const recordedAt = stamp(t.time, now);
    return [{
      id: String(t.id), memberId, week: Number(t.week), amount: money(t.amount), paidOn: String(t.date ?? ""),
      method: String(t.method ?? "Other"), reference: String(t.reference ?? ""),
      status: (t.status ?? "completed") === "completed" ? ("COMPLETED" as const) : ("REVERSED" as const),
      recordedBy: String(t.who ?? "imported"), recordedAt,
      reversedAt: t.reversed_at ? stamp(t.reversed_at, recordedAt) : null, reversedBy: t.reversed_by ?? null, reversalReason: t.reversal_reason ?? null,
      correctedAt: t.corrected_at ? stamp(t.corrected_at, recordedAt) : null, correctedBy: t.corrected_by ?? null, correctionReason: t.correction_reason ?? null,
    }];
  });
  let ticks = 0;
  for (const [name, weeks] of Object.entries((b.payments ?? {}) as Obj)) {
    const memberId = idOf.get(name);
    if (!memberId) continue;
    for (const [w, ticked] of Object.entries(weeks as Obj)) {
      if (!ticked || seen.has(`${name}|${Number(w)}`)) continue;
      ticks++;
      payments.push({
        id: `PAY-TICK-${memberId}-W${w}`.slice(0, 60), memberId, week: Number(w), amount: weekly(name), paidOn: "",
        method: "Other", reference: "Converted from week grid", status: "COMPLETED", recordedBy: "import", recordedAt: now,
        reversedAt: null, reversedBy: null, reversalReason: null, correctedAt: null, correctedBy: null, correctionReason: null,
      });
    }
  }

  // ── payouts: ledger rows, balanced against each turn's recorded total
  const ledger: Obj[] = b.payout_ledger ?? [];
  const payouts = ledger.flatMap((p) => {
    const turn = turnOf(p.turn);
    const memberId = idOf.get(p.recipient) ?? (turn ? members[turn - 1]?.id : undefined);
    if (!turn || !memberId) { warn.push(`payout ${p.id}: can't place turn "${p.turn}" / "${p.recipient}", skipped`); return []; }
    const recordedAt = stamp(p.time, now);
    return [{
      id: String(p.id), turn, memberId, amount: money(p.amount), paidOn: String(p.date ?? ""), method: String(p.method ?? "Other"),
      reference: String(p.reference ?? ""), status: (p.status ?? "active") === "reversed" ? ("REVERSED" as const) : ("ACTIVE" as const),
      recordedBy: String(p.who ?? "imported"), recordedAt,
      reversedAt: p.reversed_at ? stamp(p.reversed_at, recordedAt) : null, reversedBy: p.reversed_by ?? null, reversalReason: p.reversal_reason ?? null,
    }];
  });
  const locks: { turn: number; memberId: string; net: number; fee: number; disbursedDate: string }[] = [];
  const statusByTurn = new Map<number, Obj>();
  for (const [k, ps] of Object.entries((b.payout_status ?? {}) as Obj)) { const t = turnOf(k); if (t) statusByTurn.set(t, { ...(statusByTurn.get(t) ?? {}), ...ps }); }
  for (const [turn, ps] of statusByTurn) {
    const col = collectedOf(ps);
    if (col <= 0 || turn > n) continue;
    const memberId = members[turn - 1].id;
    const ledgerSum = money(payouts.filter((p) => p.turn === turn && p.status === "ACTIVE").reduce((a, p) => a + p.amount, 0));
    const gap = money(col - ledgerSum);
    if (Math.abs(gap) > EPS) {
      // the old payout form edited a running total, so early or reduced payouts may have no ledger row
      payouts.push({
        id: `PAYOUT-IMPORT-T${turn}`, turn, memberId, amount: gap, paidOn: String(ps.disbursed_date ?? ""), method: "Other",
        reference: gap > 0 ? "Imported balance (no ledger row)" : "Import adjustment (total was reduced)", status: "ACTIVE",
        recordedBy: "import", recordedAt: now, reversedAt: null, reversedBy: null, reversalReason: null,
      });
      warn.push(`Turn ${turn}: ledger rows came to GHS ${ledgerSum} but GHS ${col} was recorded; added a GHS ${gap} balancing row`);
    }
    let net: number, fee: number;
    if (ps.net) { net = money(ps.net); fee = money(ps.fee ?? 0); }
    else if (ps.disbursed) { net = col; fee = feePct < 100 ? money((col / (1 - feePct / 100)) * (feePct / 100)) : 0; }
    else { const gross = money((members[turn - 1].monthlyTier ?? base) * n); fee = money(gross * feePct / 100); net = money(gross - fee); }
    locks.push({ turn, memberId, net, fee, disbursedDate: String(ps.disbursed_date ?? "") });
  }

  const snapshots = Object.entries((b.snapshots ?? {}) as Obj).map(([w, v]) => ({ week: Number(w), cashHeld: money(v) }));
  const recons = ((b.reconciliations ?? []) as Obj[]).map((r) => ({
    countedAt: stamp(r.date, now), actual: money(r.actual), system: money(r.system), difference: money(r.difference),
    note: String(r.note ?? ""), who: String(r.who ?? "imported"),
  }));
  const history = ((b.history ?? []) as Obj[]).map((h, i) => ({
    type: String(h.type ?? "setting"), text: String(h.text ?? ""), detail: ((h.detail ?? []) as unknown[]).map(String),
    who: String(h.who ?? "imported"), at: new Date(stamp(h.time, now).getTime() - i), // keep newest-first order on equal minutes
  }));

  return { s, base, feePct, n, list, members, payments, payouts, locks, snapshots, recons, history, warn, ticks };
}

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("Usage: npm run import:sheets -- blob.json [--write] [--replace]");
  const write = flags.includes("--write"), replace = flags.includes("--replace");
  const b: Obj = JSON.parse(readFileSync(file, "utf8"));
  const now = new Date();
  const { s, base, feePct, n, list, members, payments, payouts, locks, snapshots, recons, history, warn, ticks } = convert(b);

  console.log(`Group: start ${s.start_date}, GHS ${base}/month, fee ${feePct}%, rev ${b.rev ?? 0}`);
  console.log(`Members (${n}): ${list.join(", ")}`);
  console.log(`Payments: ${payments.length} (${ticks} from old ticked weeks) · Payouts: ${payouts.length} · Locked turns: ${locks.map((l) => l.turn).join(", ") || "none"}`);
  console.log(`Snapshots: ${snapshots.length} · Cash counts: ${recons.length} · Activity: ${history.length}`);
  warn.forEach((w) => console.log(`  ! ${w}`));
  if (!write) return console.log("\nDry run. Add --write to import.");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.count() + await tx.payout.count();
      if (existing && !replace) throw new Error("The database already has payments or payouts. Re-run with --replace to wipe it first.");
      for (const t of [tx.activity, tx.reconciliation, tx.snapshot, tx.payout, tx.payment, tx.turnLock, tx.member, tx.group] as const)
        await (t as { deleteMany: () => Promise<unknown> }).deleteMany();
      await tx.group.create({
        data: { id: 1, rev: Number(b.rev ?? 0), startDate: new Date(`${s.start_date}T00:00:00Z`), baseMonthly: base, adminFeePct: feePct, passcodeHash: String(b.passcode ?? "") },
      });
      await tx.member.createMany({ data: members });
      await tx.payment.createMany({ data: payments });
      await tx.payout.createMany({ data: payouts });
      await tx.turnLock.createMany({ data: locks });
      await tx.snapshot.createMany({ data: snapshots });
      await tx.reconciliation.createMany({ data: recons });
      await tx.activity.createMany({ data: [{ type: "setting", text: "Imported from Google Sheets", detail: warn.slice(0, 20), who: "import", at: now }, ...history] });
    }, { timeout: 120_000, maxWait: 20_000 });
    console.log("\nImported. Sign in with the same passcode as before.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("import-blob.ts")) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
