import { signOut } from "@/app/actions";
import { currentAdmin, loadGroup } from "@/lib/data";
import { formatShort } from "@/lib/format";
import { Icon } from "@/components/icons";
import { SideNav, TabBar } from "@/components/Nav";
import { Avatar, Bar } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ g }, who] = await Promise.all([loadGroup(), currentAdmin()]);
  const range = `${formatShort(g.start)} ${g.start.getUTCFullYear()} – ${formatShort(g.end)} ${g.end.getUTCFullYear()}`;
  const brand = (
    <a href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink no-underline">
      <img src="/icon.svg" alt="" className="size-8" />Susu
    </a>
  );
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="px-2">{brand}</div>
        <SideNav />
        <div className="mx-1 rounded-2xl bg-subtle p-3.5">
          <div className="flex items-baseline justify-between text-xs font-semibold">
            <span>Week {g.week} of {g.weeks}</span>
            <span className="text-muted">{Math.round((g.week / g.weeks) * 100)}%</span>
          </div>
          <div className="mt-2"><Bar pct={(g.week / g.weeks) * 100} label="Cycle progress" /></div>
          <div className="mt-2 text-xs text-muted">{range}</div>
        </div>
        <div className="mt-auto border-t border-line pt-4">
          <div className="flex items-center gap-2.5 px-1">
            <Avatar name={who} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight">{who}</div>
              <div className="truncate text-xs text-muted">Group admin</div>
            </div>
          </div>
          <form action={signOut}>
            <button className="btn ghost mt-2" type="submit"><Icon name="logout" /> Sign out</button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/85 px-4 pt-[calc(.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-lg md:hidden">
          {brand}
          <span className="pill accent">Week {g.week} of {g.weeks}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 md:px-8 md:pt-9 md:pb-16">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
