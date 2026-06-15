-- Trend Store migrations — run once in Supabase SQL Editor
-- https://supabase.com/dashboard/project/grazynglhjuuxesgusgd/sql/new

-- 1. Add variants support to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- 2. Add payment + delivery fields to store_orders
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payment_method   TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS payment_status   TEXT DEFAULT 'pending';
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS notes            TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS address_text     TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS dpay_session_id  TEXT;

-- 2b. Yusor Pay (يسر باي) — merchant token persisted between OpenSession and CompleteSession
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS yusor_token          TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS yusor_transaction_id TEXT;
ALTER TABLE store_orders ADD COLUMN IF NOT EXISTS yusor_valid_to       TIMESTAMPTZ;

-- 3. Create user_addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT        DEFAULT 'المنزل',
  address_text TEXT        NOT NULL,
  lat          DECIMAL,
  lng          DECIMAL,
  is_default   BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- 4. Index for fast user address lookups
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON user_addresses(user_id);

-- 5. Row Level Security for user_addresses
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "users see own addresses"
  ON user_addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "users insert own addresses"
  ON user_addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "users update own addresses"
  ON user_addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "users delete own addresses"
  ON user_addresses FOR DELETE
  USING (auth.uid() = user_id);
