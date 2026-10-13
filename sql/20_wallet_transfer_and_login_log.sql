-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Wallet-to-wallet transfers
-- ─────────────────────────────────────────────────────────────────────────────

-- Both legs of a transfer carry the other party and a shared id, so a statement
-- can be read as a conversation ("to Ahmed", "from Ahmed") and the pair can be
-- audited together. Nullable: every existing top-up row stays valid.
alter table public.wallet_transactions
  add column if not exists counterparty_id uuid references auth.users(id) on delete set null,
  add column if not exists transfer_id uuid;

create index if not exists wallet_tx_transfer_idx on public.wallet_transactions(transfer_id);
create index if not exists wallet_tx_user_created_idx on public.wallet_transactions(user_id, created_at desc);

/*
 * The app's existing credit/debit helpers read a balance and then write it back.
 * That is a lost-update race: two concurrent spends both read the same balance
 * and the second overwrites the first. For top-ups it has been survivable; for a
 * transfer it is not, because the same race can MINT money (both sides credited
 * from a stale read).
 *
 * So a transfer is one statement in the database, with both wallet rows locked
 * in a deterministic order (lowest user_id first) so two simultaneous transfers
 * between the same pair queue instead of deadlocking.
 */
create or replace function public.wallet_transfer(
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from numeric;
  v_to numeric;
  v_transfer uuid := gen_random_uuid();
begin
  if p_from is null or p_to is null then raise exception 'missing_party'; end if;
  if p_from = p_to then raise exception 'same_user'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount'; end if;

  insert into wallets (user_id, balance, updated_at)
    values (p_from, 0, now()) on conflict (user_id) do nothing;
  insert into wallets (user_id, balance, updated_at)
    values (p_to, 0, now()) on conflict (user_id) do nothing;

  perform balance from wallets
    where user_id in (p_from, p_to)
    order by user_id
    for update;

  select balance into v_from from wallets where user_id = p_from;
  if v_from < p_amount then raise exception 'insufficient_funds'; end if;

  update wallets set balance = balance - p_amount, updated_at = now()
    where user_id = p_from returning balance into v_from;
  update wallets set balance = balance + p_amount, updated_at = now()
    where user_id = p_to returning balance into v_to;

  insert into wallet_transactions
    (user_id, amount, type, method, status, note, counterparty_id, transfer_id)
  values
    (p_from, p_amount, 'debit',  'transfer', 'completed',
     coalesce(nullif(btrim(p_note), ''), 'تحويل صادر'), p_to,   v_transfer),
    (p_to,   p_amount, 'credit', 'transfer', 'completed',
     coalesce(nullif(btrim(p_note), ''), 'تحويل وارد'), p_from, v_transfer);

  return jsonb_build_object('transfer_id', v_transfer,
                            'from_balance', v_from, 'to_balance', v_to);
end
$$;

-- SECURITY: this function moves money and takes the PAYER as an argument, so a
-- caller who could invoke it directly could drain any wallet. Only the service
-- role (which bypasses grants) may run it — never a logged-in browser client.
revoke all on function public.wallet_transfer(uuid, uuid, numeric, text) from public;
revoke all on function public.wallet_transfer(uuid, uuid, numeric, text) from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Login log
-- ─────────────────────────────────────────────────────────────────────────────

-- `auth.users.last_sign_in_at` only ever holds the LAST one, so there was no way
-- to answer "who signed in today" or "how often does this customer come back".
create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  ip text,
  user_agent text,
  app text not null default 'store',
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_idx on public.login_events(created_at desc);
create index if not exists login_events_user_idx on public.login_events(user_id, created_at desc);

-- Readable only through the admin API (service role). A customer has no business
-- reading the store's login history, including their own neighbours'.
alter table public.login_events enable row level security;
