import Link from "next/link";
import { Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <section className="card stack w-full max-w-md text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-soft text-brand-ink [&_svg]:size-6"><Icon name="arrow" /></span>
        <div>
          <h1 className="m-0 text-xl font-bold">Page not found</h1>
          <p className="caption mt-1.5">That address doesn&apos;t exist in Susu Savings.</p>
        </div>
        <Link className="btn primary" href="/"><Icon name="home" />Back to Overview</Link>
      </section>
    </main>
  );
}
