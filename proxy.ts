import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, cookieOptions, signSession, verifySession } from "@/lib/session";

// Gate every page behind sign-in and slide the 30-minute idle timeout forward on each request.
export async function proxy(req: NextRequest) {
  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  const onLogin = req.nextUrl.pathname === "/login";

  if (!session) {
    if (onLogin) return NextResponse.next();
    const url = new URL("/login", req.url);
    if (req.cookies.has(COOKIE)) url.searchParams.set("timeout", "1");
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE);
    return res;
  }
  if (onLogin) return NextResponse.redirect(new URL("/", req.url));

  const res = NextResponse.next();
  res.cookies.set(COOKIE, await signSession(session.name), cookieOptions);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
