-- 3D / 360 product media + saved device-diagnosis reports
alter table public.products add column if not exists spin_images text[] not null default '{}';
alter table public.products add column if not exists model_url text;
alter table public.products add column if not exists model_task text;

create table if not exists public.device_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  device jsonb not null default '{}',
  results jsonb not null default '{}',
  score int,
  ai_report text,
  created_at timestamptz not null default now()
);
alter table public.device_reports enable row level security;
-- no public policies: written/read only through API routes with the service role
