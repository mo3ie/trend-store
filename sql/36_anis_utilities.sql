-- Anis «خالص» electricity meter charges + direct recharge (InstaPay / Vodafone Cash / USDT …)
-- operation id at Anis = utility_orders.id ; `request` is the exact Anis body so a resume is byte-identical.
create table if not exists public.utility_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('meter','recharge')),
  status text not null default 'processing' check (status in ('processing','succeeded','failed','refunded','action_needed')),
  provider_status text,                 -- Anis status / refund status / reason code
  request jsonb not null,
  cost numeric not null,                -- what Anis charges our wallet (LYD)
  price numeric not null,               -- what the customer paid (LYD)
  refunded numeric not null default 0,  -- LYD returned to the customer so far
  title text, target text,              -- package/product name, meter number / recipient (display)
  result jsonb,                         -- receipt+tokens / recharge details (proofUrl, reason, payout)
  error text,
  tries int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists utility_orders_user_idx on public.utility_orders(user_id, created_at desc);
create index if not exists utility_orders_open_idx on public.utility_orders(status) where status in ('processing','action_needed','failed');
alter table public.utility_orders enable row level security;

create table if not exists public.utility_settings (
  id int primary key default 1 check (id = 1),
  meter_enabled boolean not null default false,
  meter_markup_pct numeric not null default 0,
  meter_fee numeric not null default 0,
  recharge_enabled boolean not null default false,
  recharge_markup_pct numeric not null default 3,
  recharge_fee numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.utility_settings (id) values (1) on conflict do nothing;
alter table public.utility_settings enable row level security;
