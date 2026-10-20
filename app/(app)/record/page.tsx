import { loadGroup } from "@/lib/data";
import { namedPayments, namedPayouts, toView } from "@/lib/view";
import { RecordPanel } from "@/components/RecordPanel";

export default async function RecordPage() {
  const { g } = await loadGroup();
  return (
    <RecordPanel
      view={toView(g)}
      payments={namedPayments(g).filter((p) => p.status === "COMPLETED").slice(0, 200)}
      payouts={namedPayouts(g).filter((p) => p.status === "ACTIVE")}
    />
  );
}
