import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Same format as the Streamlit app (scrypt$16384$8$1$<salt>$<digest>), so the existing
// passcode carries over on import. Legacy SHA-256 and plaintext are still accepted, then upgraded.

const PREFIX = "scrypt$16384$8$1$";

export function hashPw(pw: string): string {
  const salt = randomBytes(16);
  const digest = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `${PREFIX}${salt.toString("hex")}$${digest.toString("hex")}`;
}

export function isScryptHash(v: string | null | undefined): boolean {
  return !!v && v.startsWith(PREFIX) && v.split("$").length === 6;
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPw(entered: string, stored: string | null | undefined): boolean {
  if (!entered || !stored) return false;
  if (isScryptHash(stored)) {
    try {
      const [, n, r, p, salt, digest] = stored.split("$");
      const got = scryptSync(entered, Buffer.from(salt, "hex"), digest.length / 2, { N: +n, r: +r, p: +p });
      return same(got.toString("hex"), digest);
    } catch {
      return false;
    }
  }
  if (/^[0-9a-f]{64}$/.test(stored)) return same(createHash("sha256").update(entered).digest("hex"), stored);
  return same(entered, stored);
}
