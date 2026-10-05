import { AppShell } from "@/components/app-shell";
import { requireViewer } from "@/lib/auth";
import { listBrands } from "@/lib/brands";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const [viewer, brands] = await Promise.all([requireViewer(), listBrands()]);
  return <AppShell viewer={viewer} brands={brands}>{children}</AppShell>;
}
