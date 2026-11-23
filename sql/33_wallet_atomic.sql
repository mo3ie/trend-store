-- Atomic wallet adjust: one statement under a row lock, so two requests racing
-- can never spend the same balance twice (escrow + cards rely on this).
create or replace function public.wallet_adjust(p_user uuid, p_delta numeric, p_allow_negative boolean default false)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  insert into wallets(user_id, balance, updated_at) values (p_user, 0, now()) on conflict (user_id) do nothing;
  select balance into v from wallets where user_id = p_user for update;
  if not p_allow_negative and v + p_delta < 0 then
    return null;
  end if;
  update wallets set balance = v + p_delta, updated_at = now() where user_id = p_user;
  return v + p_delta;
end $$;
revoke all on function public.wallet_adjust(uuid, numeric, boolean) from public, anon, authenticated;
