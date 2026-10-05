import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Viewer = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  previewMode: boolean;
};

export async function requireViewer(): Promise<Viewer> {
  if (!isSupabaseConfigured()) {
    return {
      id: "preview-user",
      email: "kirsty@preview.local",
      displayName: "Kirsty Sharman",
      initials: "KS",
      previewMode: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/sign-in");

  const displayName =
    data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "User";
  const initials = displayName
    .split(/\s+/)
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    id: data.user.id,
    email: data.user.email || "",
    displayName,
    initials,
    previewMode: false,
  };
}
