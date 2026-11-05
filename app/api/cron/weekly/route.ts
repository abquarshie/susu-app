import { prisma } from "@/lib/db";
import { loadRecords } from "@/lib/data";
import { Group } from "@/lib/model";

/**
 * Called by Vercel Cron every morning (see vercel.json). Saves this week's opening cash for the
 * "+GHS this week" figure on Overview, so it no longer waits for someone to open the app. The first
 * figure saved for a week is kept, so running it again (or an admin opening the app first) changes nothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not allowed", { status: 401 });
  try {
    const g = new Group(await loadRecords(), new Date());
    if (g.week === 0) return Response.json({ ok: true, saved: false, reason: "the cycle hasn't started" });
    const { count } = await prisma.snapshot.createMany({ data: [{ week: g.week, cashHeld: g.cashHeld }], skipDuplicates: true });
    return Response.json({ ok: true, week: g.week, saved: count > 0 });
  } catch (e) {
    console.error("cron weekly", e);
    return Response.json({ ok: false }, { status: 503 });
  }
}
