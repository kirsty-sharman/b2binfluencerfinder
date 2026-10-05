-- Shared reservation for manual planning and automatic refills.
create table public.brand_search_reservations (
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.brand_search_reservations enable row level security;
revoke all on public.brand_search_reservations from anon, authenticated;
create or replace function public.reserve_brand_search(target_brand uuid)
returns text language plpgsql security definer set search_path='' as $$
declare last_search timestamptz; used integer;
begin
 if not exists(select 1 from public.brands b where b.id=target_brand and public.is_workspace_member(b.workspace_id)) then
  raise exception 'Brand access required';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(target_brand::text, 0));
 if exists(select 1 from public.discovery_runs where brand_id=target_brand and status in ('queued','running')) then
  return 'A search is already in progress.';
 end if;
 select greatest(
  (select max(created_at) from public.brand_search_reservations where brand_id=target_brand),
  (select max(created_at) from public.discovery_runs where brand_id=target_brand)
 ) into last_search;
 if last_search > now()-interval '24 hours' then
  return 'Next search available at ' || to_char(last_search+interval '24 hours','YYYY-MM-DD HH24:MI') || ' UTC. Your saved creators are still available.';
 end if;
 select count(*) into used from public.brand_search_reservations where brand_id=target_brand and created_at>now()-interval '30 days';
 if used>=10 then return 'This brand has used its 10 searches for the rolling 30-day allowance. Saved creators remain available.'; end if;
 insert into public.brand_search_reservations(brand_id) values(target_brand);
 return null;
end $$;
revoke all on function public.reserve_brand_search(uuid) from public;
grant execute on function public.reserve_brand_search(uuid) to authenticated;

-- Starting old drafts cannot bypass the allowance. Retries reuse saved work,
-- but are limited to three attempts for a run.
alter table public.discovery_runs add column if not exists execution_attempts integer not null default 0;
create or replace function public.guard_search_execution()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status <> 'queued' then return new; end if;
 if TG_OP='UPDATE' then
  if old.status='queued' then return new; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.brand_id::text,0));
 if new.execution_attempts>=3 then raise exception 'Retry limit reached. Review the failed search before continuing.'; end if;
 if new.started_at is null then
  if exists(select 1 from public.discovery_runs r where r.brand_id=new.brand_id and r.id<>new.id and
    (r.status in ('queued','running') or r.started_at>now()-interval '24 hours')) then
   raise exception 'Only one new search per brand is available every 24 hours.';
  end if;
  if (select count(*) from public.discovery_runs r where r.brand_id=new.brand_id and r.id<>new.id and r.started_at>now()-interval '30 days')>=10 then
   raise exception 'This brand has reached its 10-search rolling 30-day allowance.';
  end if;
  new.started_at=now();
 end if;
 new.execution_attempts=new.execution_attempts+1;
 return new;
end $$;
create trigger guard_search_execution before insert or update of status on public.discovery_runs
for each row execute function public.guard_search_execution();

-- Persist first review availability independently of later match edits.
alter table public.creator_profiles add column if not exists first_review_at timestamptz;
update public.creator_profiles p set first_review_at=m.first_at
from (select creator_id,min(created_at) first_at from public.creator_asset_matches group by creator_id) m
where p.id=m.creator_id and p.first_review_at is null;
create or replace function public.mark_creator_review_available()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.creator_profiles set first_review_at=coalesce(first_review_at,now()) where id=new.creator_id;
 return new;
end $$;
create trigger mark_creator_review_available after insert on public.creator_asset_matches
for each row execute function public.mark_creator_review_available();
