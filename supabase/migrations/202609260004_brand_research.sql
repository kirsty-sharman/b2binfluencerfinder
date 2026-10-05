create table if not exists public.phrase_lists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null default 'Master phrase list',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table if not exists public.phrases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  phrase_list_id uuid references public.phrase_lists(id) on delete set null,
  phrase text not null,
  intent text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  source text not null default 'manual' check (source in ('manual', 'csv', 'provider', 'suggested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  url text not null,
  title text not null,
  content_type text not null default 'article',
  summary text,
  topics text[] not null default '{}',
  target_industries text[] not null default '{}',
  evidence_strength text not null default 'unreviewed'
    check (evidence_strength in ('unreviewed', 'weak', 'moderate', 'strong')),
  eligible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, url)
);

alter table public.phrase_lists enable row level security;
alter table public.phrases enable row level security;
alter table public.content_assets enable row level security;

drop policy if exists "members can manage phrase lists" on public.phrase_lists;
create policy "members can manage phrase lists"
on public.phrase_lists for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can manage phrases" on public.phrases;
create policy "members can manage phrases"
on public.phrases for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "members can manage content assets" on public.content_assets;
create policy "members can manage content assets"
on public.content_assets for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create unique index if not exists phrases_brand_phrase_unique_idx
on public.phrases (brand_id, lower(phrase));

create index if not exists phrases_brand_status_idx
on public.phrases (brand_id, status);

create index if not exists content_assets_brand_eligible_idx
on public.content_assets (brand_id, eligible);
