-- ═══════════ Daily gift (provably-fair automatic draw) ═══════════
create table if not exists public.daily_draws (
  day date primary key,                       -- Libya calendar day
  seed_hash text not null,                    -- sha256(seed), published BEFORE the draw
  seed text,                                  -- secret until the draw, revealed after
  gift_title text not null default 'هدية مفاجأة من محل ترند',
  gift_image text,
  entries_count int not null default 0,
  entries_hash text,                          -- sha256 of the ordered entry list used
  winner_user_id uuid,
  winner_name text,                           -- masked public name
  claim_code text,                            -- shown only to the winner + admin
  drawn_at timestamptz,
  claimed_at timestamptz,
  claimed_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.daily_draw_entries (
  id bigint generated always as identity primary key,
  day date not null references public.daily_draws(day) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (day, user_id)
);
alter table public.daily_draws enable row level security;
alter table public.daily_draw_entries enable row level security;
create table if not exists public.daily_gift_plan (   -- admin schedules gifts per day (optional)
  day date primary key,
  gift_title text not null,
  gift_image text
);
alter table public.daily_gift_plan enable row level security;

-- ═══════════ Used marketplace with escrow («سوق المستعمل بضمان») ═══════════
create table if not exists public.market_settings (
  id int primary key default 1 check (id = 1),
  commission_pct numeric not null default 5,       -- store fee taken from the seller's payout
  protection_days int not null default 3,          -- buyer has N days after handover to confirm/dispute
  min_price numeric not null default 20
);
insert into public.market_settings (id) values (1) on conflict do nothing;
alter table public.market_settings enable row level security;

create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  title text not null,
  category text not null default 'هواتف',
  brand text, model text, storage text, color text,
  condition text not null default 'good' check (condition in ('like_new','good','fair','parts')),
  battery_health int,
  price numeric not null check (price > 0),
  description text,
  images text[] not null default '{}',
  city text,
  diag_report_id uuid,                              -- optional link to a /diagnose report
  status text not null default 'pending' check (status in ('pending','active','reserved','sold','rejected','removed')),
  reject_reason text,
  views int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_listings_status_idx on public.market_listings(status, created_at desc);
alter table public.market_listings enable row level security;

create table if not exists public.market_orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id),
  buyer_id uuid not null,
  seller_id uuid not null,
  price numeric not null,
  commission numeric not null,
  seller_payout numeric not null,
  delivery text not null default 'store' check (delivery in ('store','courier','meet')),
  status text not null default 'held' check (status in ('held','handed_over','completed','disputed','refunded','cancelled')),
  confirm_deadline timestamptz,
  dispute_reason text,
  resolution text,
  timeline jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_orders_buyer_idx on public.market_orders(buyer_id);
create index if not exists market_orders_seller_idx on public.market_orders(seller_id);
alter table public.market_orders enable row level security;

create table if not exists public.market_messages (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.market_orders(id) on delete cascade,
  sender_id uuid not null,
  is_admin boolean not null default false,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.market_messages enable row level security;

-- ═══════════ Digital cards (local + international), provider API plugged later ═══════════
create table if not exists public.card_products (
  id uuid primary key default gen_random_uuid(),
  provider_sku text,                     -- provider's product code (filled when the API arrives)
  name text not null,
  brand text not null,
  region text not null default 'local' check (region in ('local','international')),
  category text not null default 'mobile',   -- mobile | games | stores | streaming | other
  face_value text,                       -- e.g. "10 USD", "20 د.ل"
  price numeric not null check (price > 0),  -- selling price in LYD
  image text,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.card_products enable row level security;

create table if not exists public.card_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  card_product_id uuid not null references public.card_products(id),
  qty int not null default 1 check (qty between 1 and 10),
  total numeric not null,
  status text not null default 'pending' check (status in ('pending','delivered','failed','refunded')),
  codes jsonb not null default '[]',     -- [{code, serial, pin, expiry}]
  provider_ref text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists card_orders_user_idx on public.card_orders(user_id, created_at desc);
alter table public.card_orders enable row level security;
-- No public RLS policies: everything goes through API routes using the service role.
