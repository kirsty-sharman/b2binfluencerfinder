"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function SignInForm({ previewMode }: { previewMode: boolean }) {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form action={action} className="auth-form">
      <div className="eyebrow">Welcome back</div>
      <h2>Sign in to your workspace</h2>
      <p className="muted">
        {previewMode
          ? "Supabase is not connected yet. Continue to the protected local preview."
          : "Sign in with your early-access account."}
      </p>
      {!previewMode ? (
        <>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input className="text-input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input className="text-input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
        </>
      ) : null}
      {state.error ? <div className="auth-error" role="alert">{state.error}</div> : null}
      <button className="primary-button wide-button" disabled={pending} type="submit">
        {pending ? "Signing in…" : previewMode ? "Open preview" : "Sign in"}
      </button>
    </form>
  );
}
