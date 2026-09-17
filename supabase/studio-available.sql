-- Availability flag for catalog items (in stock / out of stock).
-- Idempotent — safe to re-run.
alter table studio_products add column if not exists available boolean default true;
