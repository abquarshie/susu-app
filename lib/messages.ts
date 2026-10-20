// WhatsApp-ready messages, worded exactly as in the Streamlit app.
import { fmtNum, formatDate } from "./format";
import type { Group, PaymentRec, PayoutRec } from "./model";

export function exportWeekly(g: Group): string {
  const out = [
    `📌 *SUSU WEEK ${g.week} UPDATE*`, `💰 *Cash held:* GHS ${fmtNum(g.cashHeld)}`,
    `📥 *Collected:* GHS ${fmtNum(g.collected)}`, `🎁 *Paid out:* GHS ${fmtNum(g.paidOut)}`,
    `🏁 *Cycle:* Week ${g.week} of ${g.weeks}`, "", "👥 *MEMBER STANDING*",
  ];
  for (const r of g.rows) {
    if (r.exited && r.owing <= 0) { out.push(`⚪ *${r.member}*: Exited`); continue; }
    const streak = r.streak >= 2 ? ` · 🔴 ${r.streak} weeks behind` : "";
    out.push(`${r.owing <= 0 ? "✅" : "❌"} *${r.member}*: ${r.standing}${streak}`);
  }
  out.push("", "🎁 *PAYOUTS*");
  for (const r of g.schedule)
    out.push(`*${r.recipient}* · ${r.dateS}` + (r.done ? " · ✅ fully collected" : ` · GHS ${fmtNum(r.remaining)} remaining`));
  if (g.nextByDate) out.push("", `➡️ *Next payout:* ${g.nextByDate.recipient} on ${g.nextByDate.dateS}`);
  out.push("", "Thank you everyone for keeping the susu on track 🙏");
  return out.join("\n");
}

export function exportReminder(g: Group): string {
  const head = `🔔 *SUSU PAYMENT REMINDER — WEEK ${g.week}*\n\n`;
  const owing = g.rows.filter((r) => r.owing > 0);
  if (!owing.length) return head + "✅ *Everyone is up to date this week!* 🎉\n\nThank you all for staying on track 🙏";
  let body = "Hi everyone 👋 A quick reminder for members with outstanding contributions:\n\n";
  body += owing.map((r) => `• ❌ *${r.member}*: ${r.standing}`).join("\n");
  if (g.nextByDate)
    body += `\n\nPlease settle your outstanding amount when you can so we can keep the next payout on schedule.\n` +
      `🎁 *Next payout:* ${g.nextByDate.recipient} · ${g.nextByDate.dateS}`;
  return head + body + "\n\nThank you 🙏";
}

export function exportOnboarding(g: Group): string {
  const out = [
    "📋 *SUSU GROUP — ONBOARDING DETAILS*", "", `🗓️ *Start:* ${formatDate(g.start)}`, `🏁 *End:* ${formatDate(g.end)}`,
    `👥 *Members:* ${g.n}`, `🔄 *Cycle:* ${g.weeks} weeks`, "", "ℹ️ *HOW IT WORKS*", "• Contributions are weekly.",
    "• Each turn lasts exactly 4 weeks.", "• Payout dates are fixed by the rotation schedule.",
  ];
  if (g.fee) out.push(`• An admin fee of ${fmtNum(g.feePct)}% is deducted from each payout.`);
  out.push("", "👤 *MEMBER TARGETS*", ...g.rows.filter((r) => !r.exited).map((r) => `*${r.member}* — GHS ${fmtNum(r.weekly)}/week`));
  out.push("", "🎁 *PAYOUT SCHEDULE*", ...g.schedule.map((r) => `*${r.turn} — ${r.recipient}* · ${r.dateS} · GHS ${fmtNum(r.net)}`));
  return out.join("\n");
}

export function exportHistory(g: Group): string {
  const out = [`📊 *SUSU CONTRIBUTION HISTORY — WEEK ${g.week}*`, `🗓️ *Period:* ${formatDate(g.start)} → ${formatDate(g.end)}`, ""];
  for (const m of g.members) {
    out.push(`👤 *${m.name}*${g.exited(m) ? " (exited)" : ""} · GHS ${fmtNum(g.weekly(m))}/wk`);
    for (let w = 1; w <= g.weeks; w++) {
      const amt = g.paidAmount(m, w);
      let s: string;
      if (!g.liable(m, w) && amt <= 0) s = "⚪ Exempt";
      else if (g.paid(m, w)) s = "✅ Paid";
      else if (amt > 0) s = `🟡 Partial · GHS ${fmtNum(amt)} of ${fmtNum(g.weekly(m))}`;
      else s = w > g.week ? "⏳ Upcoming" : "❌ Owing";
      out.push(`  Wk ${String(w).padStart(2, "0")}: ${s}`);
    }
    out.push("");
  }
  return out.join("\n");
}

export function receiptText(tx: PaymentRec, member: string): string {
  return `🧾 *SUSU PAYMENT RECEIPT*\n\nMember: *${member}*\nWeek: *${String(tx.week).padStart(2, "0")}*\n` +
    `Amount: *GHS ${fmtNum(tx.amount)}*\nMethod: ${tx.method || "—"}\nReference: ${tx.reference || "—"}\n` +
    `Date: ${tx.paidOn || "—"}\nRecorded by: ${tx.recordedBy || "—"}\nReceipt ID: ${tx.id}\n\nThank you for your contribution 🙏`;
}

export function payoutReceiptText(p: PayoutRec, recipient: string): string {
  return `🧾 *SUSU PAYOUT RECEIPT*\n\nRecipient: *${recipient}*\nTurn: *Turn ${p.turn}*\n` +
    `Amount: *GHS ${fmtNum(p.amount)}*\nMethod: ${p.method || "—"}\nReference: ${p.reference || "—"}\n` +
    `Date: ${p.paidOn || "—"}\nRecorded by: ${p.recordedBy || "—"}\nReceipt ID: ${p.id}`;
}
