"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWaitlistWebsite } from "@/lib/waitlist-website";
export type WaitlistState = { error?: string; success?: boolean };
export async function joinWaitlist(_: WaitlistState, data: FormData): Promise<WaitlistState> {
  const email = String(data.get("email") || "").trim().toLowerCase();
  const website = String(data.get("website") || "").trim();
  if (data.get("company_fax")) return { error: "Unable to submit. Please try again." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid work email." };
  const normalizedWebsite = normalizeWaitlistWebsite(website);
  if (!normalizedWebsite) return { error: "Enter a valid company website, such as yourcompany.com." };
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("join_public_waitlist", { signup_email: email, signup_website: normalizedWebsite });
    if (error) {
      // Log the error code only: database error details can contain submitted personal data.
      console.error("Waitlist submission failed", { code: error.code, missingMigration: error.code === "PGRST202" });
      return { error: "Applications are temporarily unavailable. Please try again later." };
    }
    return { success: true };
  } catch {
    console.error("Waitlist submission failed before completion", {
      supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    });
    return { error: "Applications are temporarily unavailable. Please try again later." };
  }
}
