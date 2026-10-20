import { FlashOnMount } from "@/components/Toaster";
import { Icon } from "@/components/icons";
import { LoginForm } from "./LoginForm";

const POINTS = [
  ["cash", "Track every weekly contribution"],
  ["calendar", "Know who collects next, and when"],
  ["share", "Send updates and receipts to WhatsApp"],
] as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ timeout?: string }> }) {
  const { timeout } = await searchParams;
  return (
    <main className="grid min-h-dvh md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {timeout && <FlashOnMount message="Session timed out. Please sign in again." />}
      <section className="hero m-3 hidden flex-col justify-between rounded-3xl p-10 md:flex">
        <div className="flex items-center gap-2.5 text-lg font-bold"><img src="/icon.svg" alt="" className="size-9" />Susu Savings</div>
        <div>
          <h1 className="m-0 max-w-md text-4xl leading-tight font-bold tracking-tight">Your group&apos;s savings, clear and accounted for.</h1>
          <ul className="mt-8 grid list-none gap-4 p-0">
            {POINTS.map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3 text-white/85">
                <span className="grid size-9 place-items-center rounded-xl bg-white/12 ring-1 ring-white/15 [&_svg]:size-5"><Icon name={icon} /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-white/55">Every change is recorded with the admin&apos;s name.</div>
      </section>

      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center md:text-left">
            <img src="/icon.svg" alt="" className="mx-auto mb-5 size-12 md:hidden" />
            <h2 className="m-0 text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted">Sign in to manage the group.</p>
          </div>
          <LoginForm />
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted md:justify-start">
            <Icon name="lock" className="size-3.5" />Sessions end after 30 minutes idle.
          </p>
        </div>
      </section>
    </main>
  );
}
