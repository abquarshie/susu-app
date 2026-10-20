import { FlashOnMount } from "@/components/Toaster";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ timeout?: string }> }) {
  const { timeout } = await searchParams;
  return (
    <main className="wrap">
      {timeout && <FlashOnMount message="Session timed out. Please sign in again." />}
      <div className="signin">
        <div className="signin-head">
          <div className="brand">Susu Savings</div>
          <div className="tag">Group savings tracker</div>
          <p>Sign in to manage the group.</p>
        </div>
        <div className="card"><LoginForm /></div>
      </div>
    </main>
  );
}
