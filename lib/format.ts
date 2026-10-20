// Formatting helpers. Ghana is UTC+0 all year, so dates are handled in UTC throughout.

export const EPS = 0.005;
export const METHODS = ["Cash", "MoMo", "Bank transfer", "Other"] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function money(x: unknown): number {
  const n = Number(x ?? 0);
  return Math.round((Number.isFinite(n) ? n : 0) * 100 + 1e-7) / 100;
}

export function fmtNum(v: unknown): string {
  const n = money(v);
  return Number.isInteger(n)
    ? n.toLocaleString("en-US")
    : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ordinal(d: number): string {
  if (d >= 11 && d <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[d % 10] ?? "th";
}

/** 17th Aug 2026 */
export function formatDate(dt: Date): string {
  const d = dt.getUTCDate();
  return `${d}${ordinal(d)} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/** 17 Aug */
export function formatShort(dt: Date): string {
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

/** 17 Aug 2026 — the plain form stored on payments */
export function formatPlain(dt: Date): string {
  return `${String(dt.getUTCDate()).padStart(2, "0")} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}

/** 20 Oct 2026 09:03 */
export function formatStamp(dt: Date): string {
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  return `${formatPlain(dt)} ${hh}:${mm}`;
}

/** YYYY-MM-DD for <input type="date"> */
export function isoDay(dt: Date): string {
  return dt.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD as a UTC date, or null. */
export function parseIsoDay(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || isoDay(d) !== s ? null : d;
}

/** "17th Aug 2026" or "17 Aug 2026" → Date */
export function parseDisplayDate(txt: string | null | undefined): Date | null {
  if (!txt) return null;
  const m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})\s+(\d{4})/.exec(txt.trim());
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1, 3).toLowerCase());
  return mon < 0 ? null : new Date(Date.UTC(+m[3], mon, +m[1]));
}

export function addWeeks(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 7 * 86_400_000);
}

export function dayDiff(a: Date, b: Date): number {
  const day = (x: Date) => Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
  return Math.round((day(a) - day(b)) / 86_400_000);
}

export function newId(prefix: string): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  const stamp = `${n.getUTCFullYear()}${p(n.getUTCMonth() + 1)}${p(n.getUTCDate())}${p(n.getUTCHours())}${p(n.getUTCMinutes())}${p(n.getUTCSeconds())}`;
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${stamp}-${rand.toUpperCase()}`;
}

export function parseNames(txt: string): string[] {
  return txt.split(",").map((n) => n.replace(/\s+/g, " ").trim()).filter(Boolean);
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
