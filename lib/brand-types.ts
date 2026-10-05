export type BrandOverviewData = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  metrics: Array<{ label: string; value: string; note: string }>;
  latestRun: {
    id: string;
    name: string;
    completedAt: string;
    cost: string;
    queries: number;
    posts: number;
    profiles: number;
    awaitingReview: number;
    status: "draft" | "queued" | "running" | "ready" | "failed" | "cancelled";
  } | null;
  priorityAssets: Array<{
    id: string;
    title: string;
    type: string;
    industry: string;
    matches: number;
  }>;
  industries: string[];
  trustedSubjects: string;
  targetQuestion: string;
};
