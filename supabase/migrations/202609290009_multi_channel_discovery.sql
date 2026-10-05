begin;
-- Existing IDs, decisions, evidence and shortlist memberships remain intact.
alter table public.creator_profiles alter column linkedin_url drop not null;
alter table public.creator_profiles add column if not exists primary_url text;
alter table public.creator_profiles add column if not exists primary_channel text not null default 'linkedin' check (primary_channel in ('linkedin','newsletter','blog','youtube','podcast','x'));
update public.creator_profiles set primary_url = linkedin_url where primary_url is null;
create unique index if not exists creator_primary_url_unique on public.creator_profiles(brand_id,primary_url);
alter table public.creator_content alter column linkedin_url drop not null;
alter table public.creator_content add column if not exists source_url text;
alter table public.creator_content add column if not exists channel text not null default 'linkedin' check (channel in ('linkedin','newsletter','blog','youtube','podcast','x'));
update public.creator_content set source_url=linkedin_url where source_url is null;
create unique index if not exists creator_content_source_unique on public.creator_content(run_id,source_url);
alter table public.discovery_run_queries add column if not exists channel text not null default 'linkedin' check (channel in ('linkedin','newsletter','blog','youtube','podcast','x'));
alter table public.discovery_run_queries drop constraint if exists discovery_run_queries_run_id_query_key;
create unique index if not exists discovery_queries_channel_unique on public.discovery_run_queries(run_id,channel,query);
create table if not exists public.creator_channels (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 brand_id uuid not null references public.brands(id), creator_id uuid references public.creator_profiles(id),
 channel text not null check(channel in ('linkedin','newsletter','blog','youtube','podcast','x')),
 external_id text not null, url text not null, name text not null, description text,
 audience bigint, identity_urls jsonb not null default '[]', identity_evidence text,
 evidence jsonb not null default '[]', limitations jsonb not null default '[]',
 qualification jsonb not null default '{}', first_seen_run_id uuid references public.discovery_runs(id),
 updated_at timestamptz not null default now(), unique(brand_id,channel,external_id)
);
create table if not exists public.discovery_channel_jobs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
 brand_id uuid not null references public.brands(id), run_id uuid not null references public.discovery_runs(id),
 channel text not null check(channel in ('linkedin','newsletter','blog','youtube','podcast','x')),
 status text not null default 'pending' check(status in ('pending','running','completed','failed','unavailable')),
 candidate_count int not null default 0, qualified_count int not null default 0,
 request_count int not null default 0, provider_cost numeric not null default 0,
 error_message text, lease_token uuid, lease_until timestamptz, updated_at timestamptz not null default now(),
 unique(run_id,channel)
);
alter table public.creator_channels enable row level security;
alter table public.discovery_channel_jobs enable row level security;
drop policy if exists creator_channels_workspace on public.creator_channels;
create policy creator_channels_workspace on public.creator_channels for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and exists(select 1 from public.brands b where b.id=creator_channels.brand_id and b.workspace_id=creator_channels.workspace_id) and (creator_id is null or exists(select 1 from public.creator_profiles p where p.id=creator_channels.creator_id and p.brand_id=creator_channels.brand_id and p.workspace_id=creator_channels.workspace_id)));
drop policy if exists channel_jobs_workspace on public.discovery_channel_jobs;
create policy channel_jobs_workspace on public.discovery_channel_jobs for all to authenticated using(public.is_workspace_member(workspace_id)) with check(public.is_workspace_member(workspace_id) and exists(select 1 from public.discovery_runs r where r.id=discovery_channel_jobs.run_id and r.brand_id=discovery_channel_jobs.brand_id and r.workspace_id=discovery_channel_jobs.workspace_id));
grant select, insert, update, delete on public.creator_channels, public.discovery_channel_jobs to authenticated;
-- Atomic lease makes repeated clicks / resumptions safe. Expired work can be resumed.
create or replace function public.claim_channel_job(job uuid, token uuid) returns boolean language plpgsql security invoker as $$
begin
 update public.discovery_channel_jobs set status='running',lease_token=token,lease_until=now()+interval '30 minutes',updated_at=now(),error_message=null
 where id=job and (status in ('pending','failed') or (status='running' and lease_until < now()));
 return found;
end $$;
revoke all on function public.claim_channel_job(uuid,uuid) from public;
grant execute on function public.claim_channel_job(uuid,uuid) to authenticated;
insert into public.creator_channels(workspace_id,brand_id,creator_id,channel,external_id,url,name,description,audience,identity_urls,identity_evidence,first_seen_run_id)
select workspace_id,brand_id,id,'linkedin',linkedin_url,linkedin_url,coalesce(name,'Unnamed creator'),headline,followers,jsonb_build_array(linkedin_url),'LinkedIn profile identity',first_seen_run_id
from public.creator_profiles where linkedin_url is not null on conflict do nothing;
commit;
