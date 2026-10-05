import type { EnrichmentAdapter, SnapshotResponse, SnapshotCheckpoint } from "@/lib/providers/types";
import { fetchProviderJson } from "@/lib/providers/shared";

const baseUrl = "https://api.brightdata.com/datasets/v3";
const postDataset = "gd_lyy3tktm25m4avu764";
const profileDataset = "gd_l1viktl72bvl7bjuj0";

async function scrape(datasetId: string, urls: string[], label: string, checkpoint?: SnapshotCheckpoint): Promise<SnapshotResponse> {
  const token = process.env.BRIGHTDATA_API_TOKEN;
  if (!token) throw new Error("Bright Data credentials are not configured on the server.");
  if (!urls.length) return { snapshotId: "not-required", records: [] };
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const trigger = checkpoint?.snapshotId ? {snapshot_id:checkpoint.snapshotId} : await fetchProviderJson(`${baseUrl}/trigger?dataset_id=${datasetId}&format=json&include_errors=true`, {
    method: "POST", headers, body: JSON.stringify(urls.map((url) => ({ url }))),
  }, `${label} trigger`) as { snapshot_id?: string };
  if (!trigger.snapshot_id) throw new Error(`${label} did not return a snapshot ID.`);
  if (!checkpoint?.snapshotId) await checkpoint?.onTriggered?.(trigger.snapshot_id);
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const progress = await fetchProviderJson(`${baseUrl}/progress/${trigger.snapshot_id}`, { headers }, `${label} progress`) as { status?: string };
    if (progress.status === "ready") {
      const records = await fetchProviderJson(`${baseUrl}/snapshot/${trigger.snapshot_id}?format=json`, { headers }, `${label} snapshot`);
      return { snapshotId: trigger.snapshot_id, records: Array.isArray(records) ? records : [] };
    }
    if (progress.status === "failed") throw new Error(`${label} snapshot failed.`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`${label} timed out waiting for snapshot ${trigger.snapshot_id}.`);
}

export const brightDataAdapter: EnrichmentAdapter = {
  configured: Boolean(process.env.BRIGHTDATA_API_TOKEN),
  enrichPosts: (urls, checkpoint) => scrape(postDataset, urls, "Bright Data post enrichment", checkpoint),
  enrichProfiles: (urls, checkpoint) => scrape(profileDataset, urls, "Bright Data profile enrichment", checkpoint),
};
