-- ═══ Daily gift anti-fraud ═══
alter table public.daily_draw_entries add column if not exists device_hash text;
alter table public.daily_draw_entries add column if not exists ip_hash text;
alter table public.daily_draw_entries add column if not exists phone_hash text;
alter table public.daily_draw_entries add column if not exists excluded text;          -- reason if removed from the draw
create index if not exists dde_day_device on public.daily_draw_entries(day, device_hash);
create index if not exists dde_day_ip on public.daily_draw_entries(day, ip_hash);
create unique index if not exists dde_day_phone on public.daily_draw_entries(day, phone_hash) where phone_hash is not null;
alter table public.daily_draws add column if not exists redraws int not null default 0;
alter table public.daily_draws add column if not exists disqualified jsonb not null default '[]';
alter table public.daily_draws add column if not exists winner_phone_hash text;
alter table public.daily_draws add column if not exists winner_device_hash text;

-- ═══ Games & competitions ═══
create table if not exists public.daily_quiz (
  day date primary key,
  questions jsonb not null,        -- [{q, options[4], answer(index), explain}]
  created_at timestamptz not null default now()
);
alter table public.daily_quiz enable row level security;
create table if not exists public.game_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  game text not null check (game in ('quiz','price','memory')),
  day date not null,
  score int not null default 0,
  meta jsonb not null default '{}',
  device_hash text, ip_hash text,
  started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, game, day)
);
create index if not exists game_scores_day on public.game_scores(day);
alter table public.game_scores enable row level security;
create table if not exists public.game_weeks (
  week_start date primary key,     -- Saturday (Libya week)
  prize_title text not null default 'جوائز الأسبوع من محل ترند',
  winners jsonb not null default '[]',
  finalized_at timestamptz
);
alter table public.game_weeks enable row level security;

-- ═══ Paid deep USB scan vouchers ═══
create table if not exists public.deep_scan_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  code text not null unique,
  amount numeric not null,
  status text not null default 'paid' check (status in ('paid','used','refunded')),
  report_id uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.deep_scan_vouchers enable row level security;
