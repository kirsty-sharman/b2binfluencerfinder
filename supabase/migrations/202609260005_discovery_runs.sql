create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'queued', 'running', 'ready', 'failed', 'cancelled')),
  selected_industries jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  query_count integer not null default 0,
  raw_result_count integer not null default 0,
  unique_content_count integer not null default 0,
  profile_count integer not null default 0,
  provider_cost numeric(12, 6) not null default 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_run_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  run_id uuid not null references public.discovery_runs(id) on delete cascade,
  stage_key text not null,
  sequence smallint not null,
  label text not null,
  provider text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  request_id text,
  item_count integer not null default 0,
  cost numeric(12, 6) not null default 0,
  diagnostics jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, stage_key)
);

create table if not exists public.discovery_run_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  run_id uuid not null references public.discovery_runs(id) on delete cascade,
  phrase_id uuid references public.phrases(id) on delete set null,
  source_phrase text not null,
  industry text not null,
  query text not null,
  approved boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  result_count integer not null default 0,
  provider_cost numeric(12, 6) not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, query)
);

create table if not exists public.provider_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  run_id uuid not null references public.discovery_runs(id) on delete cascade,
  stage_id uuid references public.discovery_run_stages(id) on delete set null,
  provider text not null,
  record_type text not null,
  idempotency_key text not null,
  external_id text,
  status text not null default 'pending',
  request_payload jsonb not null default '{}'::jsonb,
  raw_response jsonb,
  cost numeric(12, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, idempotency_key)
);

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  first_seen_run_id uuid references public.discovery_runs(id) on delete set null,
  linkedin_url text not null,
  name text,
  headline text,
  location text,
  followers integer,
  profile_type text not null default 'person' check (profile_type in ('person', 'company', 'unknown')),
  eligible boolean not null default false,
  rejection_reason text,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, linkedin_url)
);

create table if not exists public.creator_content (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  run_id uuid not null references public.discovery_runs(id) on delete cascade,
  creator_id uuid references public.creator_profiles(id) on delete set null,
  linkedin_url text not null,
  author_url text,
  title text,
  excerpt text,
  industry text not null,
  source_phrase text not null,
  source_query text not null,
  rank integer,
  published_at timestamptz,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, linkedin_url)
);

alter table public.discovery_runs enable row level security;
alter table public.discovery_run_stages enable row level security;
alter table public.discovery_run_queries enable row level security;
alter table public.provider_records enable row level security;
alter table public.creator_profiles enable row level security;
alter table public.creator_content enable row level security;

drop policy if exists "members can manage discovery runs" on public.discovery_runs;
create policy "members can manage discovery runs" on public.discovery_runs for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage discovery run stages" on public.discovery_run_stages;
create policy "members can manage discovery run stages" on public.discovery_run_stages for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage discovery run queries" on public.discovery_run_queries;
create policy "members can manage discovery run queries" on public.discovery_run_queries for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage provider records" on public.provider_records;
create policy "members can manage provider records" on public.provider_records for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage creator profiles" on public.creator_profiles;
create policy "members can manage creator profiles" on public.creator_profiles for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage creator content" on public.creator_content;
create policy "members can manage creator content" on public.creator_content for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists discovery_runs_brand_created_idx on public.discovery_runs (brand_id, created_at desc);
create index if not exists discovery_run_stages_run_sequence_idx on public.discovery_run_stages (run_id, sequence);
create index if not exists discovery_run_queries_run_idx on public.discovery_run_queries (run_id);
create index if not exists provider_records_run_idx on public.provider_records (run_id);
create index if not exists creator_profiles_brand_eligible_idx on public.creator_profiles (brand_id, eligible);
create index if not exists creator_content_run_idx on public.creator_content (run_id);
