"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="stack">
      <label className="f">Your name
        <input name="name" maxLength={40} placeholder="Recorded on every change you make" autoComplete="name" required />
      </label>
      <label className="f">Passcode
        <input name="passcode" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn primary wide" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
