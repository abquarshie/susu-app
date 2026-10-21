"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";
import { Icon } from "@/components/icons";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="stack">
      <label className="field"><span>Your name</span>
        <input className="input" name="name" maxLength={40} defaultValue={state?.name} placeholder="Recorded on every change you make" autoComplete="name" required />
      </label>
      <label className="field"><span>Passcode</span>
        <input className="input" name="passcode" type="password" autoComplete="current-password" required autoFocus={!!state?.name} />
      </label>
      {state?.error && <p className="note warn" role="alert"><Icon name="warning" />{state.error}</p>}
      <button className="btn primary big wide mt-1" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
