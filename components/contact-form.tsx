"use client";
import { useActionState } from "react";
import { submitContact } from "@/app/contact/actions";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, {});
  if (state.success) return <div className="marketing-confirmation" role="status"><h3>Message received.</h3><p>Thanks for getting in touch. We’ll reply to the email address you provided.</p></div>;
  return <form action={action} className="marketing-form">
    <label>Your name<input name="name" autoComplete="name" required maxLength={120}/></label>
    <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>
    <label>How can we help?<textarea name="message" required minLength={10} maxLength={5000} rows={5}/></label>
    <div className="marketing-trap" aria-hidden="true"><label>Leave empty<input name="company_fax" tabIndex={-1} autoComplete="off"/></label></div>
    {state.error && <p role="alert">{state.error}</p>}
    <button className="marketing-cta" disabled={pending}>{pending ? "Sending…" : "Send message"}<span aria-hidden="true">↗</span></button>
    <p className="marketing-fine">We’ll use your details to respond to your message.</p>
  </form>;
}
