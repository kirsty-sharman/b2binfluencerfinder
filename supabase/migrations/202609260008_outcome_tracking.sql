-- Slice 5: human-led outreach, publication evidence, and directional AI visibility.

create table if not exists public.outreach_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  match_id uuid not null references public.creator_asset_matches(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text,
  status text not null default 'not_started'
    check (status in ('not_started', 'researching', 'ready', 'contacted', 'replied', 'negotiating', 'agreed', 'declined', 'paused')),
  contact_url text,
  last_contacted_at timestamptz,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id)
);

create table if not exists public.publications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  outreach_id uuid references public.outreach_records(id) on delete set null,
  match_id uuid not null references public.creator_asset_matches(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  asset_id uuid not null references public.content_assets(id) on delete cascade,
  target_question_id uuid references public.target_questions(id) on delete set null,
  title text not null,
  url text not null,
  channel text not null default 'linkedin'
    check (channel in ('linkedin', 'newsletter', 'website', 'podcast', 'youtube', 'industry_publication', 'other')),
  format text,
  published_at date not null,
  brand_link_status text not null default 'unknown'
    check (brand_link_status in ('present', 'missing', 'unknown')),
  disclosure_status text not null default 'unknown'
    check (disclosure_status in ('disclosed', 'not_required', 'missing', 'unknown')),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'live', 'broken', 'removed')),
  index_status text not null default 'not_checked'
    check (index_status in ('not_checked', 'indexed', 'not_indexed', 'blocked')),
  verified_at timestamptz,
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, url)
);

create table if not exists public.visibility_benchmarks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  answer_engine text not null
    check (answer_engine in ('chatgpt', 'perplexity', 'google_ai_overviews', 'gemini', 'claude', 'other')),
  observed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.visibility_observations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  benchmark_id uuid not null references public.visibility_benchmarks(id) on delete cascade,
  target_question_id uuid references public.target_questions(id) on delete set null,
  creator_publication_id uuid references public.publications(id) on delete set null,
  question_text text not null,
  brand_mentioned boolean not null default false,
  brand_recommended boolean not null default false,
  description_accurate boolean,
  creator_evidence_cited boolean not null default false,
  response_excerpt text,
  cited_urls text[] not null default '{}',
  competitors text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.outreach_records enable row level security;
alter table public.publications enable row level security;
alter table public.visibility_benchmarks enable row level security;
alter table public.visibility_observations enable row level security;

drop policy if exists "members can manage outreach records" on public.outreach_records;
create policy "members can manage outreach records" on public.outreach_records for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can manage publications" on public.publications;
create policy "members can manage publications" on public.publications for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can manage visibility benchmarks" on public.visibility_benchmarks;
create policy "members can manage visibility benchmarks" on public.visibility_benchmarks for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can manage visibility observations" on public.visibility_observations;
create policy "members can manage visibility observations" on public.visibility_observations for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists outreach_records_brand_status_idx on public.outreach_records (brand_id, status);
create index if not exists outreach_records_next_action_idx on public.outreach_records (brand_id, next_action_at);
create index if not exists publications_brand_published_idx on public.publications (brand_id, published_at desc);
create index if not exists publications_verification_idx on public.publications (brand_id, verification_status, index_status);
create index if not exists visibility_benchmarks_brand_observed_idx on public.visibility_benchmarks (brand_id, observed_at desc);
create index if not exists visibility_observations_benchmark_idx on public.visibility_observations (benchmark_id);
