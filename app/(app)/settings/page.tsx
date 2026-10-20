import { prisma } from "@/lib/db";
import { currentAdmin, loadGroup } from "@/lib/data";
import { formatStamp } from "@/lib/format";
import { toView } from "@/lib/view";
import { SettingsPanel } from "@/components/SettingsPanel";

export default async function SettingsPage() {
  const [{ g }, who, activity] = await Promise.all([
    loadGroup(), currentAdmin(), prisma.activity.findMany({ orderBy: { at: "desc" }, take: 200 }),
  ]);
  const s = g.rec.settings;
  return (
    <SettingsPanel
      view={toView(g)}
      who={who}
      settings={{ startDate: s.startDate, baseMonthly: s.baseMonthly, adminFeePct: s.adminFeePct, names: g.members.map((m) => m.name).join(", ") }}
      activity={activity.map((a) => ({ id: a.id, when: formatStamp(a.at), who: a.who, text: a.text, detail: a.detail.slice(0, 8).join(" · ") }))}
    />
  );
}
