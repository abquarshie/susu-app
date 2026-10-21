import "server-only";

/** Settings the app can't run without, in plain words, so a misconfigured deploy says what's missing instead of crashing. */
export function configProblems(): string[] {
  const out: string[] = [];
  if (!process.env.DATABASE_URL) out.push("DATABASE_URL is not set (use Neon's pooled connection string).");
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < 16) out.push("SESSION_SECRET must be set to a random string of at least 16 characters.");
  return out;
}
