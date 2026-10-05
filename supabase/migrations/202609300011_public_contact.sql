-- Public visitors can submit messages but cannot read any submissions.
create table if not exists public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  email text not null check (length(email) <= 254),
  message text not null check (length(message) between 10 and 5000),
  created_at timestamptz not null default now()
);
alter table public.contact_submissions enable row level security;
revoke all on public.contact_submissions from anon, authenticated;

create or replace function public.submit_public_contact(contact_name text, contact_email text, contact_message text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if contact_name is null or length(trim(contact_name)) not between 1 and 120
    or contact_email is null or length(contact_email) > 254
    or contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or contact_message is null or length(trim(contact_message)) not between 10 and 5000 then
    raise exception 'Invalid contact submission';
  end if;
  insert into public.contact_submissions(name, email, message)
  values (trim(contact_name), lower(trim(contact_email)), trim(contact_message));
end;
$$;
revoke all on function public.submit_public_contact(text, text, text) from public;
grant execute on function public.submit_public_contact(text, text, text) to anon, authenticated;
