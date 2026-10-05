create table if not exists public.creator_asset_matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  asset_id uuid not null references public.content_assets(id) on delete cascade,
  target_question_id uuid references public.target_questions(id) on delete set null,
  suggested_impact smallint not null default 3 check (suggested_impact between 1 and 5),
  topic_expertise smallint not null default 3 check (topic_expertise between 1 and 5),
  industry_expertise smallint not null default 3 check (industry_expertise between 1 and 5),
  audience_relevance smallint not null default 3 check (audience_relevance between 1 and 5),
  asset_fit smallint not null default 3 check (asset_fit between 1 and 5),
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  explanation text not null,
  limitations text[] not null default '{}',
  collaboration_angles text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'maybe', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, creator_id, asset_id)
);

create table if not exists public.match_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  match_id uuid not null references public.creator_asset_matches(id) on delete cascade,
  creator_content_id uuid not null references public.creator_content(id) on delete cascade,
  evidence_type text not null default 'creator_post',
  excerpt text,
  strength text not null default 'supporting' check (strength in ('supporting', 'strong')),
  explanation text,
  created_at timestamptz not null default now(),
  unique (match_id, creator_content_id)
);

create table if not exists public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  match_id uuid not null references public.creator_asset_matches(id) on delete cascade,
  reviewer_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('maybe', 'accepted', 'rejected')),
  impact_score smallint not null check (impact_score between 1 and 5),
  selected_angle text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id)
);

create table if not exists public.shortlists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name)
);

create table if not exists public.shortlist_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  shortlist_id uuid not null references public.shortlists(id) on delete cascade,
  match_id uuid not null references public.creator_asset_matches(id) on delete cascade,
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (shortlist_id, match_id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.creator_asset_matches enable row level security;
alter table public.match_evidence enable row level security;
alter table public.review_decisions enable row level security;
alter table public.shortlists enable row level security;
alter table public.shortlist_members enable row level security;
alter table public.audit_events enable row level security;

drop policy if exists "members can manage creator asset matches" on public.creator_asset_matches;
create policy "members can manage creator asset matches" on public.creator_asset_matches for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage match evidence" on public.match_evidence;
create policy "members can manage match evidence" on public.match_evidence for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage review decisions" on public.review_decisions;
create policy "members can manage review decisions" on public.review_decisions for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage shortlists" on public.shortlists;
create policy "members can manage shortlists" on public.shortlists for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can manage shortlist members" on public.shortlist_members;
create policy "members can manage shortlist members" on public.shortlist_members for all to authenticated
using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
drop policy if exists "members can read audit events" on public.audit_events;
create policy "members can read audit events" on public.audit_events for select to authenticated
using (public.is_workspace_member(workspace_id));
drop policy if exists "members can create audit events" on public.audit_events;
create policy "members can create audit events" on public.audit_events for insert to authenticated
with check (public.is_workspace_member(workspace_id));

create index if not exists creator_asset_matches_brand_status_idx on public.creator_asset_matches (brand_id, status);
create index if not exists creator_asset_matches_creator_idx on public.creator_asset_matches (creator_id);
create index if not exists match_evidence_match_idx on public.match_evidence (match_id);
create index if not exists review_decisions_brand_decision_idx on public.review_decisions (brand_id, decision);
create index if not exists shortlists_brand_idx on public.shortlists (brand_id);
create index if not exists shortlist_members_shortlist_idx on public.shortlist_members (shortlist_id);
create index if not exists audit_events_brand_created_idx on public.audit_events (brand_id, created_at desc);

-- Give every brand a useful default destination for accepted creators.
insert into public.shortlists (workspace_id, brand_id, name, description)
select workspace_id, id, 'Priority experts', 'Accepted creator–asset matches for manual outreach.'
from public.brands
on conflict (brand_id, name) do nothing;

-- Backfill a transparent first recommendation for every currently eligible creator.
insert into public.creator_asset_matches (
  workspace_id, brand_id, creator_id, asset_id, target_question_id,
  suggested_impact, topic_expertise, industry_expertise, audience_relevance, asset_fit,
  confidence, explanation, limitations, collaboration_angles
)
select
  creator.workspace_id,
  creator.brand_id,
  creator.id,
  asset.id,
  question.id,
  case when coalesce(evidence.evidence_count, 0) >= 4 then 4 when coalesce(evidence.evidence_count, 0) >= 1 then 3 else 2 end,
  case when coalesce(evidence.evidence_count, 0) >= 4 then 4 when coalesce(evidence.evidence_count, 0) >= 1 then 3 else 2 end,
  case when coalesce(evidence.industry_count, 0) >= 2 then 4 when coalesce(evidence.industry_count, 0) = 1 then 3 else 2 end,
  case when creator.followers between 1000 and 100000 then 3 else 2 end,
  case when coalesce(evidence.evidence_count, 0) >= 2 then 4 when coalesce(evidence.evidence_count, 0) = 1 then 3 else 2 end,
  case when coalesce(evidence.evidence_count, 0) >= 3 then 'high' when coalesce(evidence.evidence_count, 0) >= 1 then 'medium' else 'low' end,
  concat(
    coalesce(creator.name, 'This creator'), ' has ', coalesce(evidence.evidence_count, 0),
    ' collected LinkedIn evidence item(s) connected to ',
    coalesce(evidence.industries, 'the selected target industries'),
    '. The recommendation keeps expertise and asset fit separate from audience size.'
  ),
  case when coalesce(evidence.evidence_count, 0) = 0 then array['No directly attributed creator post is available yet.']::text[] else '{}'::text[] end,
  array[
    concat('Add an expert perspective to “', asset.title, '” using a practical lesson from ', coalesce(evidence.industries, 'their field'), '.'),
    concat('Reframe one claim from “', asset.title, '” for ', coalesce(evidence.industries, 'the creator''s professional audience'), ' and link to the original evidence.'),
    concat('Turn the strongest finding in “', asset.title, '” into a short practitioner checklist with independent commentary.')
  ]::text[]
from public.creator_profiles creator
join public.content_assets asset on asset.brand_id = creator.brand_id and asset.eligible = true
left join lateral (
  select count(*)::integer as evidence_count,
         count(distinct content.industry)::integer as industry_count,
         string_agg(distinct content.industry, ', ') as industries
  from public.creator_content content
  where content.creator_id = creator.id
) evidence on true
left join lateral (
  select id from public.target_questions
  where brand_id = creator.brand_id and active = true
  order by created_at asc limit 1
) question on true
where creator.eligible = true
on conflict (brand_id, creator_id, asset_id) do nothing;

insert into public.match_evidence (
  workspace_id, brand_id, match_id, creator_content_id, excerpt, strength, explanation
)
select match.workspace_id, match.brand_id, match.id, content.id,
       coalesce(nullif(content.excerpt, ''), content.title),
       case when content.rank is not null and content.rank <= 5 then 'strong' else 'supporting' end,
       concat('Collected for “', content.source_phrase, '” in the ', content.industry, ' target market.')
from public.creator_asset_matches match
join lateral (
  select * from public.creator_content
  where creator_id = match.creator_id
  order by rank asc nulls last, created_at desc
  limit 3
) content on true
on conflict (match_id, creator_content_id) do nothing;
