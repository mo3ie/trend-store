-- الموظف الذكي (Content Studio): AI social-media manager per connected Page.
-- Idempotent — safe to re-run.

create table if not exists studio_brands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  page_id     text not null,
  brand_name  text,
  phones      text[] default '{}',
  addresses   text[] default '{}',
  links       text[] default '{}',
  hours       text,
  tone        text,          -- brand voice / description
  logo_url    text,
  colors      jsonb,         -- { primary, accent }
  extra       text,          -- any extra info the admin provides
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (user_id, page_id)
);

create table if not exists studio_products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  page_id     text not null,
  category    text,
  name        text not null,
  price_text  text,          -- e.g. "50 د.ل" (free text — ranges allowed)
  description text,
  images      text[] default '{}',
  active      boolean default true,
  created_at  timestamptz default now()
);
create index if not exists studio_products_page_idx on studio_products (user_id, page_id);

create table if not exists studio_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  page_id       text not null,
  posts_per_day int  default 3,
  duration_days int  default 7,
  start_date    date,
  status        text default 'draft',  -- draft | approved | active | done
  summary       text,
  created_at    timestamptz default now()
);
create index if not exists studio_plans_page_idx on studio_plans (user_id, page_id);

create table if not exists studio_posts (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid references studio_plans(id) on delete cascade,
  user_id        uuid not null,
  page_id        text not null,
  scheduled_for  timestamptz,
  caption        text,
  hashtags       text,
  cta            text,
  product_id     uuid,
  image_url      text,
  image_source   text,          -- upload | ai | stock | none
  status         text default 'draft', -- draft | approved | scheduled | published | failed
  boost          boolean default false,
  boost_budget_usd numeric,
  boost_days     int,
  error          text,
  created_at     timestamptz default now()
);
create index if not exists studio_posts_plan_idx on studio_posts (plan_id);

alter table studio_brands   enable row level security;
alter table studio_products enable row level security;
alter table studio_plans    enable row level security;
alter table studio_posts    enable row level security;

-- Owners can read their own rows (writes go through the service role in API routes).
do $$ begin
  create policy studio_brands_own   on studio_brands   for select using (auth.uid() = user_id);
  create policy studio_products_own on studio_products for select using (auth.uid() = user_id);
  create policy studio_plans_own    on studio_plans    for select using (auth.uid() = user_id);
  create policy studio_posts_own    on studio_posts    for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
