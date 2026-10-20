import "server-only";
import { revalidatePath } from "next/cache";
import { prisma, type Tx } from "./db";
import { currentAdmin, loadRecords } from "./data";
import { Group } from "./model";

export type ActionResult = { ok: boolean; message: string; kind?: "success" | "warning" | "error" };
export type Entry = { type: "payment" | "payout" | "setting"; text: string; detail?: string[] };

/** Thrown inside a commit when the fresh record shows the change is unsafe. Nothing is written. */
export class Refused extends Error {}
class Conflict extends Error {}

export type CommitCtx = { tx: Tx; g: Group; who: string };

/**
 * The Streamlit commit(), as one Postgres transaction:
 *  1. bump Group.rev only if it still equals the rev the page was rendered with (row lock serialises writers);
 *  2. reload every record inside the transaction and rebuild the model;
 *  3. run the mutation, which may throw Refused;
 *  4. write the activity entries.
 * Any failure rolls the whole thing back.
 */
export async function commit(
  clientRev: number,
  success: string,
  mutate: (ctx: CommitCtx) => Promise<Entry | Entry[] | void>,
  kind: ActionResult["kind"] = "success",
): Promise<ActionResult> {
  const who = await currentAdmin();
  try {
    await prisma.$transaction(
      async (tx) => {
        const bumped = await tx.group.updateMany({ where: { id: 1, rev: clientRev }, data: { rev: { increment: 1 } } });
        if (bumped.count === 0) throw new Conflict();
        const g = new Group(await loadRecords(tx), new Date());
        const out = await mutate({ tx, g, who });
        const entries = out ? (Array.isArray(out) ? out : [out]) : [];
        if (entries.length) {
          await tx.activity.createMany({
            data: entries.map((e) => ({ type: e.type, text: e.text, detail: e.detail ?? [], who })),
          });
        }
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (e) {
    revalidatePath("/", "layout");
    if (e instanceof Conflict)
      return { ok: false, kind: "warning", message: "Someone else updated the group since you loaded this page. Your view has been refreshed. Please re-apply your change." };
    if (e instanceof Refused) return { ok: false, kind: "warning", message: e.message };
    console.error(e);
    return { ok: false, kind: "error", message: "The change could not be saved. Nothing was changed. Please try again." };
  }
  revalidatePath("/", "layout");
  return { ok: true, kind, message: success };
}
