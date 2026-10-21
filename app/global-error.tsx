"use client";
import "./globals.css";

// Last resort when the root layout itself fails. Kept dependency-free so it can always render.
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-dvh place-items-center px-4">
          <section className="card stack w-full max-w-md text-center">
            <h1 className="m-0 text-xl font-bold">Susu Savings is unavailable</h1>
            <p className="caption">Something went wrong while starting the app. Your records are safe. Please try again in a moment.</p>
            <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
            {error.digest && <p className="caption num">Reference: {error.digest}</p>}
          </section>
        </main>
      </body>
    </html>
  );
}
