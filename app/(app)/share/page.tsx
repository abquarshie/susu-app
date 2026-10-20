import { loadGroup } from "@/lib/data";
import { exportHistory, exportOnboarding, exportReminder, exportWeekly, payoutReceiptText, receiptText } from "@/lib/messages";
import { fmtNum } from "@/lib/format";
import { namedPayments, namedPayouts } from "@/lib/view";
import { SharePanel, type Message } from "@/components/SharePanel";

export default async function SharePage() {
  const { g } = await loadGroup();
  const wk = `W${g.week}`;
  const messages: Message[] = [
    { group: "Weekly update", label: "Weekly update", text: exportWeekly(g), file: `Susu_Weekly_update_${wk}.txt` },
    { group: "Payment reminder", label: "Payment reminder", text: exportReminder(g), file: `Susu_Payment_reminder_${wk}.txt` },
    { group: "Onboarding details", label: "Onboarding details", text: exportOnboarding(g), file: `Susu_Onboarding_details_${wk}.txt` },
    { group: "Contribution history", label: "Contribution history", text: exportHistory(g), file: `Susu_Contribution_history_${wk}.txt` },
    ...namedPayments(g).slice(0, 20).map((p) => ({
      group: "Payment receipt",
      label: `${p.member} · Wk ${p.week} · GHS ${fmtNum(p.amount)}${p.status !== "COMPLETED" ? " · reversed" : ""}`,
      text: receiptText(p, p.member), file: `Receipt_${p.id}.txt`,
    })),
    ...namedPayouts(g).slice(0, 20).map((p) => ({
      group: "Payout receipt",
      label: `${p.recipient} · Turn ${p.turn} · GHS ${fmtNum(p.amount)}${p.status !== "ACTIVE" ? " · reversed" : ""}`,
      text: payoutReceiptText(p, p.recipient), file: `Payout_${p.id}.txt`,
    })),
  ];
  return <SharePanel messages={messages} />;
}
