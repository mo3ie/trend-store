-- Ads VIP membership: a paid monthly subscription (50 LYD) grants VIP until this
-- timestamp. getUserTier() returns "vip" when tier='vip' (admin) OR vip_until>now.
-- Idempotent.
alter table profiles add column if not exists vip_until timestamptz;
