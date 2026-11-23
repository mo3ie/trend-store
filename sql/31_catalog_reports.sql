-- Daily catalog health checks (programmatic + AI descriptions)
create table if not exists public.catalog_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  trigger text not null default 'cron',          -- cron | manual
  checked int not null default 0,
  issues jsonb not null default '[]',             -- [{product_id,name,severity,code,message}]
  fixes jsonb not null default '[]',              -- [{product_id,name,action,detail}]
  summary jsonb not null default '{}'
);
alter table public.catalog_reports enable row level security;
alter table public.products add column if not exists description_ai boolean not null default false;
-- grounded descriptions: links the AI read
alter table public.products add column if not exists description_sources jsonb not null default '[]';
