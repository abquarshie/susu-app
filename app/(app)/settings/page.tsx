import { prisma } from "@/lib/db";
import { currentAdmin, loadGroup } from "@/lib/data";
import { formatStamp, isoDay } from "@/lib/format";
import { toView } from "@/lib/view";
import type { CycleSummary } from "@/app/actions";
import { SettingsPanel } from "@/components/SettingsPanel";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const [{ g }, who, activity, cycles, sp] = await Promise.all([
    loadGroup(), currentAdmin(), prisma.activity.findMany({ orderBy: { at: "desc" }, take: 200 }),
    prisma.cycle.findMany({ orderBy: { number: "desc" }, select: { number: true, closedAt: true, closedBy: true, summary: true } }),
    searchParams,
  ]);
  const s = g.rec.settings;
  return (
    <SettingsPanel
      view={toView(g)}
      who={who}
      section={sp.section}
      settings={{ startDate: s.startDate, baseMonthly: s.baseMonthly, adminFeePct: s.adminFeePct, names: g.members.map((m) => m.name).join(", ") }}
      activity={activity.map((a) => ({ id: a.id, when: formatStamp(a.at), who: a.who, text: a.text, detail: a.detail.slice(0, 8).join(" · ") }))}
      cycles={cycles.map((c) => ({ closed: isoDay(c.closedAt), by: c.closedBy, ...(c.summary as CycleSummary), number: c.number }))}
    />
  );
}
