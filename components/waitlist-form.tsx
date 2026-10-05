"use client";
import { useActionState } from "react";
import { joinWaitlist } from "@/app/waitlist/actions";
export function WaitlistForm() {
  const [state, action, pending] = useActionState(joinWaitlist, {});
  if (state.success) return <div className="marketing-confirmation" role="status"><h3>You’re on the list.</h3><p>We’ll be in touch when early access opens.</p></div>;
  return <form action={action} className="marketing-form">
    <label>Work email<input name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254}/></label>
    <label>Company website<input name="website" type="url" autoComplete="url" placeholder="https://yourcompany.com" required maxLength={2048}/></label>
    <div className="marketing-trap" aria-hidden="true"><label>Leave empty<input name="company_fax" tabIndex={-1} autoComplete="off"/></label></div>
    <button className="marketing-cta" disabled={pending}>{pending ? "Joining…" : "Join the waitlist"}<span aria-hidden="true">↗</span></button>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <p className="marketing-fine">We’ll email you when early access opens.</p>
  </form>;
}
