"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export type WaitlistState = { error?: string; success?: boolean };
export async function joinWaitlist(_: WaitlistState, data: FormData): Promise<WaitlistState> {
  const email = String(data.get("email") || "").trim().toLowerCase();
  const website = String(data.get("website") || "").trim();
  if (data.get("company_fax")) return { error: "Unable to submit. Please try again." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid work email." };
  let url: URL;
  try { url = new URL(website); } catch { return { error: "Enter a full website URL, starting with https://." }; }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password || website.length > 2048) return { error: "Enter a valid company website." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("join_public_waitlist", { signup_email: email, signup_website: url.href });
    if (error) return { error: "Waitlist signup is temporarily unavailable. Please try again later." };
    return { success: true };
  } catch { return { error: "Waitlist signup is temporarily unavailable. Please try again later." }; }
}
