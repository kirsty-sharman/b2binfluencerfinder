import { notFound, redirect } from "next/navigation";
import { RateEstimator } from "@/components/rate-estimator";
import { BrandOverview } from "@/components/brand-overview";
import { BrandProfileForm } from "@/components/brand-profile-form";
import { PhraseLibrary } from "@/components/phrase-library";
import { ContentAssetLibrary } from "@/components/content-asset-library";
import { DiscoveryRuns } from "@/components/discovery-runs";
import { DiscoveryRunView } from "@/components/discovery-run-detail";
import { CreatorResults } from "@/components/creator-results";
import { MatchReview } from "@/components/match-review";
import { ShortlistWorkspace } from "@/components/shortlist-workspace";
import { OutreachWorkspace } from "@/components/outreach-workspace";
import { PublicationWorkspace } from "@/components/publication-workspace";
import { VisibilityWorkspace } from "@/components/visibility-workspace";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getBrandOverview, getBrandProfile } from "@/lib/brands";
import { getContentAssetLibrary, getPhraseLibrary } from "@/lib/research";
import { getDiscoveryRun, listDiscoveryRuns, providerConfiguration } from "@/lib/discovery";
import { getMatchReview, listCreatorResults, listShortlists } from "@/lib/matching";
import { getOutcomeWorkspace } from "@/lib/outcomes";

type PageProps = {
  params: Promise<{ brandId: string; section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const maxDuration = 600;

const sectionCopy: Record<string, { title: string; description: string }> = {
  profile: { title: "Brand profile", description: "Brand intelligence, industries, audiences, claims, exclusions, and target questions will be edited here." },
  phrases: { title: "Phrase library", description: "Saved research phrases, approvals, intent, import, and discovery-run selection are part of Build Slice 2." },
  content: { title: "Content assets", description: "Website scanning and the evidence-focused content library are part of Build Slice 2." },
  runs: { title: "Discovery runs", description: "The proven DataForSEO and Bright Data pipeline moves into this staged background-run workspace in Build Slice 3." },
  creators: { title: "Creator results", description: "The approved enriched-creator table and evidence preview arrive with matching and review in Build Slice 4." },
  matches: { title: "Match review", description: "Creator, content asset, target question, evidence, and human decision controls arrive in Build Slice 4." },
  shortlists: { title: "Shortlists", description: "Human-approved creator–asset matches and manual outreach status arrive in Build Slice 4." },
};

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { brandId, section = [] } = await params;
  if (section[0] === "rate-estimator" && section.length === 1) {
    if (!await getBrandProfile(brandId)) notFound();
    return <main className="page"><div className="page-header"><div className="page-header-copy"><h1>Creator rate estimator</h1><p>Plan a starting offer for original educational content.</p></div></div><RateEstimator/></main>;
  }
  if (section[0] === "profile" && section.length === 1) {
    const profile = await getBrandProfile(brandId);
    if (!profile) notFound();
    return <BrandProfileForm brand={profile} />;
  }

  if (section[0] === "phrases") redirect(`/app/brands/${brandId}/visibility/questions`);
  if (section[0] === "visibility" && section[1] === "questions" && section.length === 2) {
    const library = await getPhraseLibrary(brandId);
    if (!library) notFound();
    return <PhraseLibrary brandSlug={brandId} phrases={library.phrases} migrationRequired={library.migrationRequired} />;
  }

  if (section[0] === "content" && section.length === 1) {
    const library = await getContentAssetLibrary(brandId, true);
    if (!library) notFound();
    return <ContentAssetLibrary brandSlug={brandId} assets={library.assets} total={library.total} migrationRequired={library.migrationRequired} />;
  }

  if (section[0] === "runs" && section.length === 1) {
    const [profile, overview, runData] = await Promise.all([getBrandProfile(brandId), getBrandOverview(brandId), listDiscoveryRuns(brandId)]);
    if (!profile || !overview || !runData) notFound();
    return <DiscoveryRuns channels={providerConfiguration().channels} brandSlug={brandId} runs={runData.runs} industries={profile.targetIndustries.map((industry) => industry.name)} eligibleAssets={Number(overview.metrics[1]?.value || 0)} migrationRequired={runData.migrationRequired} />;
  }

  if (section[0] === "runs" && section.length === 2) {
    const run = await getDiscoveryRun(brandId, section[1]);
    if (!run) notFound();
    return <DiscoveryRunView run={run} providers={providerConfiguration()} />;
  }

  if (section[0] === "creators" && section.length === 1) {
    const [results, shortlistData, rawFilters] = await Promise.all([listCreatorResults(brandId), listShortlists(brandId), searchParams]);
    if (!results || !shortlistData) notFound();
    const filters = Object.fromEntries(Object.entries(rawFilters).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
    return <CreatorResults brandSlug={brandId} creators={results.creators} targetIndustries={results.targetIndustries} assets={results.assets} shortlists={shortlistData.shortlists.map((shortlist) => ({ id: shortlist.id, name: shortlist.name }))} migrationRequired={results.migrationRequired || shortlistData.migrationRequired} semanticMigrationRequired={results.semanticMigrationRequired} initialFilters={filters} />;
  }

  if (section[0] === "matches" && section[1] === "preview" && section.length === 2) {
    redirect(`/app/brands/${brandId}/creators`);
  }

  if (section[0] === "matches" && section.length === 2) {
    redirect(`/app/brands/${brandId}/creators/matches/${section[1]}`);
  }

  if (section[0] === "creators" && section[1] === "matches" && section.length === 3) {
    const match = await getMatchReview(brandId, section[2]);
    if (!match) notFound();
    return <MatchReview match={match} />;
  }

  if (section[0] === "shortlists" && section.length === 1) {
    const data = await listShortlists(brandId);
    if (!data) notFound();
    return <ShortlistWorkspace brandSlug={brandId} shortlists={data.shortlists} migrationRequired={data.migrationRequired} />;
  }

  if (section[0] === "outreach" && section.length === 1) {
    const data = await getOutcomeWorkspace(brandId);
    if (!data) notFound();
    return <OutreachWorkspace brandSlug={brandId} candidates={data.candidates} migrationRequired={data.migrationRequired} />;
  }

  if (section[0] === "publications" && section.length === 1) {
    const data = await getOutcomeWorkspace(brandId);
    if (!data) notFound();
    return <PublicationWorkspace brandSlug={brandId} candidates={data.candidates} publications={data.publications} migrationRequired={data.migrationRequired} />;
  }

  if (section[0] === "visibility" && section.length === 1) {
    const data = await getOutcomeWorkspace(brandId);
    const library=await getPhraseLibrary(brandId);
    if (!data) notFound();
    return <VisibilityWorkspace savedPrompts={(library?.phrases||[]).filter(p=>p.status==="approved").map(p=>p.phrase)} brandSlug={brandId} observations={data.observations} questions={data.questions} migrationRequired={data.migrationRequired} />;
  }

  const brand = await getBrandOverview(brandId);
  if (!brand) notFound();
  if (section.length === 0) return <BrandOverview brand={brand} />;

  const copy = sectionCopy[section[0]];
  if (!copy) notFound();
  return <PlaceholderPage {...copy} />;
}
