import { loadGroup } from "@/lib/data";
import { formatShort } from "@/lib/format";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { g } = await loadGroup();
  return (
    <main className="wrap stack">
      <header className="appbar">
        <span className="brand">Susu Savings</span>
        <span className="muted">
          Week {g.week} of {g.weeks} · {formatShort(g.start)} {g.start.getUTCFullYear()} – {formatShort(g.end)} {g.end.getUTCFullYear()}
        </span>
      </header>
      <Nav />
      {children}
    </main>
  );
}
