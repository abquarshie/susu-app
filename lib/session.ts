// Signed sign-in cookie. Uses Web Crypto only, so it runs in proxy.ts as well as in Server Actions.
// The cookie carries the admin's name and when they were last active; it is refreshed on every
// request and refused after 30 idle minutes, matching the Streamlit session timeout.

export const COOKIE = "susu_session";
export const TIMEOUT_MS = 30 * 60 * 1000;

export type Session = { name: string; last: number };

const enc = new TextEncoder();

async function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters).");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function signSession(name: string, last = Date.now()): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify({ name, last } satisfies Session)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await key(), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined, now = Date.now()): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64url(body))) as Session;
    if (typeof s.name !== "string" || typeof s.last !== "number" || now - s.last > TIMEOUT_MS) return null;
    return s;
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TIMEOUT_MS / 1000,
};
