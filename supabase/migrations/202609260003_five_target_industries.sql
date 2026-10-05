alter table public.brand_industries
  drop constraint if exists brand_industries_priority_check;

alter table public.brand_industries
  add constraint brand_industries_priority_check
  check (priority between 1 and 5);
