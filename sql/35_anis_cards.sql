-- Anis cards supplier: cost snapshot + resumable orders (operation id = card_orders.id)
alter table public.card_products
  add column if not exists provider text,                 -- 'anis' | null (manual)
  add column if not exists provider_cost numeric,         -- Anis unitPrice (LYD) last synced — sent as expectedUnitPrice
  add column if not exists provider_available boolean,
  add column if not exists provider_note text,            -- subcategory disclaimer to show buyers
  add column if not exists provider_synced_at timestamptz;
create unique index if not exists card_products_provider_sku_uq on public.card_products(provider, provider_sku) where provider_sku is not null;

alter table public.card_orders
  add column if not exists provider text,
  add column if not exists provider_card_id text,         -- exact request snapshot so a resume is byte-identical
  add column if not exists provider_cost numeric,
  add column if not exists provider_state text,           -- sent | processing | unknown | completed | notPlaced:<code>
  add column if not exists provider_tries int not null default 0,
  add column if not exists updated_at timestamptz default now();
