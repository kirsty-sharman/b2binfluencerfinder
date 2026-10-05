alter table public.creator_asset_matches
  add column if not exists analysis_status text not null default 'not_started'
    check (analysis_status in ('not_started', 'queued', 'running', 'completed', 'failed')),
  add column if not exists analysis_model text,
  add column if not exists analysis_input_hash text,
  add column if not exists semantic_analysis jsonb,
  add column if not exists analysis_error text,
  add column if not exists analyzed_at timestamptz;

create index if not exists creator_asset_matches_analysis_status_idx
on public.creator_asset_matches (brand_id, analysis_status);
