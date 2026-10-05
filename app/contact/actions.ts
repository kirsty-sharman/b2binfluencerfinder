"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ContactState = { error?: string; success?: boolean };
export async function submitContact(_: ContactState, data: FormData): Promise<ContactState> {
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "").trim().toLowerCase();
  const message = String(data.get("message") || "").trim();
  if (data.get("company_fax")) return { error: "Unable to submit. Please try again." };
  if (!name || name.length > 120) return { error: "Enter your name (up to 120 characters)." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (message.length < 10 || message.length > 5000) return { error: "Write a message between 10 and 5,000 characters." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("submit_public_contact", { contact_name: name, contact_email: email, contact_message: message });
    if (!error) return { success: true };
  } catch {}
  return { error: "Your message couldn’t be saved. Please try again later." };
}
