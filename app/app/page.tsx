import { redirect } from "next/navigation";
import { listBrands } from "@/lib/brands";

export default async function AppHomePage() {
  const brands = await listBrands();
  const firstBrand = brands[0];

  redirect(firstBrand ? `/app/brands/${firstBrand.slug}` : "/app/brands/new");
}
