// Small building blocks shared by every page (server or client).
import type { ReactNode } from "react";

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {sub ? <div className="page-sub">{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function Section({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="section">
      <h2 className="section-title">{title}</h2>
      {aside ? <span className="section-aside">{aside}</span> : null}
    </div>
  );
}

/** One figure on a summary card: a label, the number and an optional line underneath. */
export function Kpi({ label, value, foot, tone, icon }: {
  label: string; value: string; foot?: ReactNode; tone?: "in" | "out"; icon?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface p-3.5 shadow-soft md:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-xs font-medium text-muted">{label}</div>
        {icon ? <div className="grid size-7 flex-none place-items-center rounded-lg bg-subtle text-muted [&_svg]:size-4">{icon}</div> : null}
      </div>
      <div className={`num mt-1.5 mb-1 truncate text-lg font-bold tracking-tight md:text-2xl${tone === "out" ? " text-out" : tone === "in" ? " text-in" : ""}`}>{value}</div>
      {foot ? <div className="truncate text-xs text-muted">{foot}</div> : null}
    </div>
  );
}

export type Tone = "in" | "out" | "warn" | "accent" | "neutral";
export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

/** Initials in a circle, for member rows. */
export function Avatar({ name, tone }: { name: string; tone?: "in" | "out" | "muted" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  return <span className={`avatar${tone ? ` ${tone}` : ""}`} aria-hidden>{initials}</span>;
}

export function Bar({ pct, tone, label }: { pct: number; tone?: "in"; label?: string }) {
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className={`bar${tone ? ` ${tone}` : ""}`} role="progressbar" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v}%` }} />
    </div>
  );
}
