/*
 * Give the money back when a campaign never reached the platform.
 *
 * Until now a failed launch left the customer charged: `ad_campaigns.status`
 * became 'failed', the wallet stayed debited, and nothing connected the two.
 * One real customer lost 110 د.ل that way on 2026-10-13.
 *
 * The flip from 'success' to 'refunded' is the idempotency guard, and it has to
 * be the SAME statement that decides whether to credit — otherwise a retried
 * launch (the route is retryable by design) refunds twice. Only the caller that
 * actually changed the row pays out.
 */
create or replace function public.refund_ad_payment(p_campaign uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_amount numeric;
  v_balance numeric;
begin
  update ad_payments
     set status = 'refunded'
   where campaign_id = p_campaign
     and status = 'success'
  returning user_id, amount into v_user, v_amount;

  -- Nothing to refund: never paid, or another caller got here first.
  if v_user is null then
    return jsonb_build_object('refunded', false);
  end if;

  insert into wallets (user_id, balance, updated_at)
       values (v_user, v_amount, now())
  on conflict (user_id) do update
          set balance = wallets.balance + v_amount, updated_at = now()
    returning balance into v_balance;

  insert into wallet_transactions (user_id, amount, type, method, status, note)
       values (v_user, v_amount, 'credit', 'refund', 'completed',
               coalesce(nullif(btrim(p_reason), ''), 'استرجاع إعلان فشل إطلاقه'));

  return jsonb_build_object('refunded', true, 'userId', v_user,
                            'amount', v_amount, 'balance', v_balance);
end
$$;

-- Service role only: it credits a wallet from a campaign id alone.
revoke all on function public.refund_ad_payment(uuid, text) from public;
revoke all on function public.refund_ad_payment(uuid, text) from anon, authenticated;
