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

/** A phone number as WhatsApp wants it: digits only, with Ghana's 233 in place of a leading 0. "" when unusable. */
export function waNumber(phone: string | null | undefined): string {
  let d = String(phone ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 10) d = `233${d.slice(1)}`;
  d = d.replace(/\D/g, "");
  return d.length >= 9 && d.length <= 15 ? d : "";
}

/** A wa.me link that opens a chat with this number (or the share sheet, with no number) and the text filled in. */
export function waLink(phone: string | null | undefined, text: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

/** Tidies a typed phone number for saving. Throws nothing: an unusable number is kept as typed and simply gets no link. */
export function cleanPhone(v: unknown): string {
  return String(v ?? "").replace(/[^\d+ ()-]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
}

/**
 * Spreads one payment over the weeks it covers: first whatever the chosen week still needs, then each following
 * week's shortfall (up to lastWeek), and anything left over on the last week it reached. `have(w)` is what week w
 * already has. With carry off, or when nothing is short, the whole amount stays on the chosen week.
 */
export function splitPayment(amount: number, week: number, lastWeek: number, weekly: number, have: (w: number) => number,
  carry = true): { week: number; amount: number }[] {
  if (!carry) return [{ week, amount: money(amount) }];
  const out: { week: number; amount: number }[] = [];
  let left = money(amount);
  for (let w = week; w <= lastWeek && left > EPS; w++) {
    const short = money(weekly - have(w));
    if (short <= EPS) continue;
    const put = Math.min(short, left);
    out.push({ week: w, amount: money(put) });
    left = money(left - put);
  }
  if (!out.length) return [{ week, amount: money(amount) }];
  if (left > EPS) out[out.length - 1].amount = money(out[out.length - 1].amount + left);
  return out;
}

/** "5", "5–6" or "5, 7 and 8" for the weeks a split payment covers. */
export function weekList(weeks: number[]): string {
  if (weeks.length === 1) return String(weeks[0]);
  const run = weeks.every((w, i) => i === 0 || w === weeks[i - 1] + 1);
  if (run) return `${weeks[0]}–${weeks[weeks.length - 1]}`;
  return `${weeks.slice(0, -1).join(", ")} and ${weeks[weeks.length - 1]}`;
}
