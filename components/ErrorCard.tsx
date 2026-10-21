"use client";
import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

/** What an error boundary shows: plain words, a reference for the logs, and a retry that fetches the page again. */
export function ErrorCard({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => console.error(error), [error]);
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <section className="card stack w-full max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-warn-soft text-warn [&_svg]:size-6"><Icon name="warning" /></span>
        <div>
          <h1 className="m-0 text-xl font-bold">This page couldn&apos;t load</h1>
          <p className="caption mt-1.5">
            The connection to the database may have dropped for a moment. Your records are safe: every save is all-or-nothing,
            so nothing is ever left half done.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <a className="btn" href="/"><Icon name="home" />Overview</a>
          <button className="btn primary" onClick={retry}><Icon name="undo" />Try again</button>
        </div>
        {error.digest && <p className="caption num">Reference: {error.digest}</p>}
      </section>
    </div>
  );
}
