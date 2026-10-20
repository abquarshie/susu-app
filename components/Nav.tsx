"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const PAGES: [href: string, label: string, icon: IconName][] = [
  ["/", "Overview", "home"], ["/record", "Record", "add"], ["/members", "Members", "group"],
  ["/share", "Share", "share"], ["/settings", "Settings", "settings"],
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Pages" className="grid gap-0.5">
      {PAGES.map(([href, label, icon]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted no-underline transition-colors hover:bg-subtle hover:text-ink aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-ink [&_svg]:size-5">
          <Icon name={icon} />{label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav aria-label="Pages"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/90 px-1 pt-1.5 pb-[calc(.375rem+env(safe-area-inset-bottom))] backdrop-blur-lg md:hidden">
      {PAGES.map(([href, label, icon]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}
          className="group flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-semibold text-muted no-underline aria-[current=page]:text-brand-ink">
          <span className="grid h-7 w-12 place-items-center rounded-full transition-colors group-aria-[current=page]:bg-brand-soft [&_svg]:size-[22px]">
            <Icon name={icon} />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
