"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PAGES = [
  ["/", "Overview"], ["/record", "Record"], ["/members", "Members"], ["/share", "Share"], ["/settings", "Settings"],
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="seg" aria-label="Pages">
      {PAGES.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
