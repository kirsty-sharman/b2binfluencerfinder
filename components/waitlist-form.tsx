"use client";
import { useActionState, useEffect } from "react";
import { joinWaitlist } from "@/app/waitlist/actions";
export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, {});
  useEffect(() => {
    // A full navigation lets the existing tag manager observe the confirmation URL.
    // Only navigate after the server confirms the application was saved.
    if (state.success) window.location.replace("/thank-you");
  }, [state.success]);
  if (state.success) return <div className="marketing-confirmation" role="status"><h3>Application received.</h3><p>Taking you to your confirmation… <a href="/thank-you">Continue</a></p></div>;
  return <form action={action} className="marketing-form">
    <label>Work email<input name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254}/></label>
    <label>Company website<input name="website" type="text" inputMode="url" autoComplete="url" autoCapitalize="none" spellCheck={false} placeholder="yourcompany.com" required maxLength={2048}/></label>
    <div className="marketing-trap" aria-hidden="true"><label>Leave empty<input name="company_fax" tabIndex={-1} autoComplete="off"/></label></div>
    <button className="marketing-cta" disabled={pending}>{pending ? "Submitting…" : "Apply for access"}<span aria-hidden="true">↗</span></button>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <p className="marketing-fine">Access is subject to approval. Look out for an email with next steps.</p>
  </form>;
}
