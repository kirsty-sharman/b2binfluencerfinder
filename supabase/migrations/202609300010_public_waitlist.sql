-- Run in the Supabase SQL editor. No public access to signup records.
create table if not exists public.marketing_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254),
  website text not null check (length(website) <= 2048),
  created_at timestamptz not null default now()
);
alter table public.marketing_waitlist enable row level security;
revoke all on public.marketing_waitlist from anon, authenticated;
create or replace function public.join_public_waitlist(signup_email text, signup_website text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if length(signup_email) > 254 or signup_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(signup_website) > 2048 or signup_website !~ '^https?://[^/[:space:]]+\.[^/[:space:]]+'
    or signup_email is null or signup_website is null then
    raise exception 'Invalid signup';
  end if;
  insert into public.marketing_waitlist(email, website)
  values (lower(trim(signup_email)), signup_website)
  on conflict (email) do nothing;
end;
$$;
revoke all on function public.join_public_waitlist(text, text) from public;
grant execute on function public.join_public_waitlist(text, text) to anon, authenticated;
