export type SearchResult = {
  rank: number | null;
  title: string;
  excerpt: string;
  url: string;
  domain: string;
};

export type SearchResponse = {
  results: SearchResult[];
  cost: number;
  externalId: string | null;
  raw: unknown;
};

export type SnapshotResponse = {
  snapshotId: string;
  records: Record<string, unknown>[];
};

export type SearchAdapter = {
  configured: boolean;
  searchLinkedIn(query: string, options: { locationCode: number; languageCode: string; depth: number }): Promise<SearchResponse>;
};

export type SnapshotCheckpoint = { snapshotId?: string; onTriggered?: (snapshotId:string)=>Promise<void> };

export type EnrichmentAdapter = {
  configured: boolean;
  enrichPosts(urls: string[], checkpoint?: SnapshotCheckpoint): Promise<SnapshotResponse>;
  enrichProfiles(urls: string[], checkpoint?: SnapshotCheckpoint): Promise<SnapshotResponse>;
};
