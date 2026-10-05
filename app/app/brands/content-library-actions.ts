"use server";
import { requireViewer } from "@/lib/auth";
import { getContentAssetLibrary } from "@/lib/research";
import { contentLibraryPage, type LibraryOptions } from "@/lib/content-library-view";
export async function loadContentLibraryPage(brandSlug: string, query: string, filter: string, page: number, options: LibraryOptions = {}) {
  await requireViewer();
  const library = await getContentAssetLibrary(brandSlug);
  if (!library) throw new Error("Content library unavailable.");
  return contentLibraryPage(library.assets, query.slice(0,200), filter, page, options);
}
