alter table public.brands
  add column if not exists target_segments text[] not null default '{}',
  add column if not exists industry_topics text[] not null default '{}';

alter table public.brand_industries
  add column if not exists taxonomy_id text,
  add column if not exists taxonomy_version text,
  add column if not exists is_custom boolean not null default true;

create unique index if not exists brand_industries_brand_name_unique_idx
on public.brand_industries (brand_id, lower(name));

comment on table public.brand_industries is
  'Target organisational-buyer industries for creator discovery. Canonical taxonomy entries retain a stable taxonomy_id; custom labels remain valid and are never silently replaced.';

comment on column public.brands.target_segments is
  'Specific organisation types or sub-markets inside the selected target industries.';

comment on column public.brands.industry_topics is
  'Industry-specific language and topics used to expand discovery phrases.';
