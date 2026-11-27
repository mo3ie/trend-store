-- 47 — Activity log + admin reports («التقارير»).
--
-- site_events: what people open and press on the storefront (visitors and signed-in
-- customers). Written ONLY by POST /api/track (service role; the user is taken from the
-- session cookie, never from the body). Nothing typed into inputs is recorded — only the
-- page path, how long it stayed open, and the visible text of the button/link pressed.
-- RLS on with no policies → invisible to anon/authenticated; read only through the
-- admin report functions below (execute revoked from public roles).

create table if not exists public.site_events (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  sid        text not null,                 -- anonymous per-browser id
  user_id    uuid,                          -- set when signed in
  kind       text not null check (kind in ('view','click','event')),
  path       text not null,
  label      text,                          -- button/link text or event name
  target     text,                          -- link destination
  dur_ms     integer,                       -- views: time the page stayed open
  device     text,
  ref        text                           -- external referrer host (first view)
);
create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_user_idx on public.site_events (user_id, created_at desc) where user_id is not null;
create index if not exists site_events_sid_idx on public.site_events (sid, created_at desc);
alter table public.site_events enable row level security;

-- "/products/3f2a…-…" → "/products/:id" so pages group together.
create or replace function public.report_norm_path(p text) returns text language sql immutable as $$
  select regexp_replace(regexp_replace(split_part(coalesce(p,'/'),'?',1),
    '/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}', '/:id', 'g'), '/[0-9]{3,}', '/:n', 'g')
$$;

-- ── Overview ────────────────────────────────────────────────────────────────
create or replace function public.admin_report_overview(p_days int default 7)
returns jsonb language plpgsql security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
        r jsonb;
begin
  with ev as (select * from site_events where created_at >= since),
  v as (select * from ev where kind = 'view')
  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'views', (select count(*) from v),
        'visitors', (select count(distinct sid) from ev),
        'users', (select count(distinct user_id) from ev where user_id is not null),
        'clicks', (select count(*) from ev where kind = 'click'),
        'avg_view_sec', (select round(avg(least(dur_ms, 1800000)) / 1000.0) from ev where label = '__leave' and dur_ms > 0),
        'signups', (select count(*) from profiles where created_at >= since),
        'logins', (select count(*) from login_events where created_at >= since),
        'orders', (select count(*) from store_orders where created_at >= since and deleted_at is null),
        'orders_total', (select coalesce(sum(total),0) from store_orders where created_at >= since and deleted_at is null and payment_status = 'paid'),
        'active_subs', (select count(*) from subscriptions where status = 'active' and (expires_at is null or expires_at > now()))
      )),
    'daily', (select coalesce(jsonb_agg(d order by d->>'day'), '[]') from (
        select jsonb_build_object('day', to_char(date_trunc('day', created_at at time zone 'Africa/Tripoli'), 'YYYY-MM-DD'),
          'views', count(*) filter (where kind = 'view'), 'visitors', count(distinct sid),
          'users', count(distinct user_id)) d
        from ev group by date_trunc('day', created_at at time zone 'Africa/Tripoli')) x),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]') from (
        select extract(hour from created_at at time zone 'Africa/Tripoli')::int h, count(*) n from v group by 1) x),
    'pages', (select coalesce(jsonb_agg(x order by (x->>'views')::int desc), '[]') from (
        select jsonb_build_object('path', pv.np, 'views', pv.n, 'visitors', pv.vis, 'avg_sec', lv.sec) x
        from (select report_norm_path(path) np, count(*) n, count(distinct sid) vis from v group by 1 order by 2 desc limit 25) pv
        left join (select report_norm_path(path) np, round(avg(least(dur_ms, 1800000)) / 1000.0) sec
                   from ev where label = '__leave' and dur_ms > 0 group by 1) lv on lv.np = pv.np) y),
    'clicks', (select coalesce(jsonb_agg(x order by (x->>'n')::int desc), '[]') from (
        select jsonb_build_object('label', label, 'path', report_norm_path(path), 'n', count(*), 'people', count(distinct sid)) x
        from ev where kind = 'click' and coalesce(label,'') <> '' group by label, report_norm_path(path) order by count(*) desc limit 30) y),
    'products', (select coalesce(jsonb_agg(x order by (x->>'views')::int desc), '[]') from (
        select jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'image', p.image_url,
          'views', count(*), 'visitors', count(distinct v.sid)) x
        from v join products p on v.path = '/products/' || p.id::text
        group by p.id order by count(*) desc limit 12) y),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', d, 'n', n) order by n desc), '[]') from (
        select coalesce(device,'غير معروف') d, count(distinct sid) n from ev group by 1) x),
    'refs', (select coalesce(jsonb_agg(jsonb_build_object('ref', ref, 'n', n) order by n desc), '[]') from (
        select ref, count(distinct sid) n from ev where coalesce(ref,'') <> '' group by ref order by 2 desc limit 10) x),
    'first_event', (select min(created_at) from site_events)
  ) into r;
  return r;
end $$;

-- ── Live (last 5 minutes) ───────────────────────────────────────────────────
create or replace function public.admin_report_live()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'at' desc), '[]') from (
    select distinct on (e.sid) jsonb_build_object('sid', e.sid, 'user_id', e.user_id, 'name', coalesce(p.full_name, p.email),
      'path', e.path, 'device', e.device, 'at', e.created_at) x
    from site_events e left join profiles p on p.id = e.user_id
    where e.created_at >= now() - interval '5 minutes'
    order by e.sid, e.created_at desc) y
$$;

-- ── Customers ───────────────────────────────────────────────────────────────
create or replace function public.admin_report_users(p_days int default 30, p_q text default null, p_limit int default 200)
returns jsonb language sql security definer set search_path = public as $$
  with since as (select now() - make_interval(days => greatest(1, least(p_days, 365))) t),
  act as (
    select user_id, count(*) filter (where kind='view') views, count(*) filter (where kind='click') clicks,
           count(distinct date_trunc('day', created_at at time zone 'Africa/Tripoli')) days, max(created_at) last_seen
    from site_events, since where user_id is not null and created_at >= since.t group by user_id),
  lg as (select user_id, count(*) n, max(created_at) last_login from login_events, since where created_at >= since.t group by user_id),
  od as (select user_id, count(*) n, coalesce(sum(total) filter (where payment_status='paid'),0) paid from store_orders, since where created_at >= since.t and deleted_at is null group by user_id),
  sb as (select user_id, count(*) n from subscriptions where status='active' and (expires_at is null or expires_at > now()) group by user_id),
  ids as (select user_id from act union select user_id from lg union select user_id from od union select id from profiles, since where created_at >= since.t)
  select coalesce(jsonb_agg(x order by (x->>'last_seen') desc nulls last), '[]') from (
    select jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone, 'role', p.role,
      'joined', p.created_at, 'views', coalesce(act.views,0), 'clicks', coalesce(act.clicks,0), 'days', coalesce(act.days,0),
      'logins', coalesce(lg.n,0), 'orders', coalesce(od.n,0), 'paid', coalesce(od.paid,0), 'subs', coalesce(sb.n,0),
      'wallet', coalesce((select balance from wallets w where w.user_id = p.id), p.wallet_balance, 0),
      'last_seen', greatest(act.last_seen, lg.last_login)) x
    from ids join profiles p on p.id = ids.user_id
    left join act on act.user_id = p.id left join lg on lg.user_id = p.id
    left join od on od.user_id = p.id left join sb on sb.user_id = p.id
    where p_q is null or p_q = '' or p.full_name ilike '%'||p_q||'%' or p.email ilike '%'||p_q||'%' or p.phone ilike '%'||p_q||'%'
    order by greatest(act.last_seen, lg.last_login) desc nulls last
    limit greatest(1, least(p_limit, 500))) y
$$;

-- ── Business operations (one feed across every service) ─────────────────────
create or replace function public.report_ops(p_since timestamptz, p_user uuid default null, p_limit int default 300)
returns table(at timestamptz, user_id uuid, kind text, title text, amount numeric, status text, ref text)
language sql security definer set search_path = public as $$
  select * from (
    select created_at, user_id, 'order', 'طلب من المتجر (' || coalesce(jsonb_array_length(products),0) || ' منتج)', total, coalesce(payment_status,'') || ' · ' || coalesce(status,''), id::text
      from store_orders where created_at >= p_since and deleted_at is null and (p_user is null or user_id = p_user)
    union all
    select created_at, user_id, 'wallet', case when type = 'credit' and method = 'transfer' then 'استلام تحويل' when type = 'debit' and method = 'transfer' then 'تحويل لمستخدم'
           when type = 'credit' and method = 'refund' then 'استرجاع للمحفظة' when type = 'credit' and method = 'admin' then 'إضافة رصيد من الإدارة'
           when type = 'credit' then 'شحن المحفظة — ' || coalesce(method,'') when type = 'debit' then 'دفع من المحفظة — ' || coalesce(method,'')
           else 'محفظة: ' || coalesce(type,'') end, amount, status, id::text
      from wallet_transactions where created_at >= p_since and (p_user is null or user_id = p_user)
    union all
    select created_at, user_id, 'card', 'شراء كروت ×' || qty, total, status, id::text
      from card_orders where created_at >= p_since and (p_user is null or user_id = p_user)
    union all
    select created_at, user_id, 'utility', coalesce(title, kind), price, status, id::text
      from utility_orders where created_at >= p_since and (p_user is null or user_id = p_user)
    union all
    select created_at, user_id, 'subscription', 'اشتراك ' || product || coalesce(' — ' || tier, ''), price_lyd, status, id::text
      from subscriptions where created_at >= p_since and (p_user is null or user_id = p_user)
    union all
    select created_at, buyer_id, 'market', 'شراء من سوق المستعمل', price, status, id::text
      from market_orders where created_at >= p_since and (p_user is null or buyer_id = p_user)
    union all
    select created_at, seller_id, 'listing', 'إعلان في سوق المستعمل: ' || title, price, status, id::text
      from market_listings where created_at >= p_since and (p_user is null or seller_id = p_user)
    union all
    select created_at, user_id, 'maintenance', 'طلب صيانة: ' || coalesce(device,''), quote_price, status, id::text
      from maintenance_requests where created_at >= p_since and (p_user is null or user_id = p_user)
    union all
    select created_at, user_id, 'ad', 'حملة إعلانية — ' || coalesce(page_name,'') || coalesce(' (' || platform || ')', ''), total_price, status, id::text
      from ad_campaigns where created_at >= p_since and (p_user is null or user_id = p_user)
  ) u(at, user_id, kind, title, amount, status, ref)
  order by at desc limit greatest(1, least(p_limit, 1000))
$$;

create or replace function public.admin_report_ops(p_days int default 7)
returns jsonb language sql security definer set search_path = public as $$
  with o as (select * from report_ops(now() - make_interval(days => greatest(1, least(p_days, 365))), null, 1000))
  select jsonb_build_object(
    'summary', (select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'n', n, 'sum', s, 'people', ppl) order by n desc), '[]')
                from (select kind, count(*) n, coalesce(sum(amount),0) s, count(distinct user_id) ppl from o group by kind) x),
    'feed', (select coalesce(jsonb_agg(jsonb_build_object('at', o.at, 'user_id', o.user_id, 'name', coalesce(p.full_name, p.email), 'kind', o.kind,
                'title', o.title, 'amount', o.amount, 'status', o.status) order by o.at desc), '[]')
             from (select * from o limit 300) o left join profiles p on p.id = o.user_id))
$$;

-- ── Subscribers ─────────────────────────────────────────────────────────────
create or replace function public.admin_report_subs()
returns jsonb language sql security definer set search_path = public as $$
  with s as (select s.*, coalesce(p.full_name, p.email) name, p.phone,
               case when s.status = 'active' and (s.expires_at is null or s.expires_at > now()) then 'active'
                    when s.status = 'active' then 'expired' else s.status end state
             from subscriptions s left join profiles p on p.id = s.user_id)
  select jsonb_build_object(
    'active', (select count(*) from s where state = 'active'),
    'subscribers', (select count(distinct user_id) from s where state = 'active'),
    'expiring7', (select count(*) from s where state = 'active' and expires_at < now() + interval '7 days'),
    'mrr', (select coalesce(sum(price_lyd / greatest(1, coalesce((select months from subscription_plans sp where sp.id = s.plan_id), 1))), 0) from s where state = 'active'),
    'revenue30', (select coalesce(sum(price_lyd),0) from s where created_at >= now() - interval '30 days'),
    'auto_renew', (select count(*) from s where state = 'active' and auto_renew),
    'by_product', (select coalesce(jsonb_agg(jsonb_build_object('product', product, 'tier', tier, 'n', n) order by n desc), '[]')
                   from (select product, tier, count(*) n from s where state = 'active' group by product, tier) x),
    'list', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'name', name, 'phone', phone, 'product', product, 'tier', tier,
                'state', state, 'starts_at', starts_at, 'expires_at', expires_at, 'price', price_lyd, 'auto_renew', auto_renew, 'pages', coalesce(array_length(page_ids,1),0))
                order by (state = 'active') desc, expires_at asc nulls last), '[]') from (select * from s order by created_at desc limit 400) z)
  )
$$;

-- ── One customer, everything ────────────────────────────────────────────────
create or replace function public.admin_report_user(p_user uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'whatsapp_key' from profiles p where p.id = p_user),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('at', created_at, 'kind', kind, 'path', path, 'label', label, 'dur_ms', dur_ms, 'device', device) order by created_at desc), '[]')
               from (select * from site_events where user_id = p_user order by created_at desc limit 400) e),
    'logins', (select coalesce(jsonb_agg(jsonb_build_object('at', created_at, 'ua', user_agent, 'app', app) order by created_at desc), '[]')
               from (select * from login_events where user_id = p_user order by created_at desc limit 60) l),
    'ops', (select coalesce(jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'title', title, 'amount', amount, 'status', status) order by at desc), '[]')
            from report_ops('-infinity', p_user, 300)),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', pth, 'n', n) order by n desc), '[]')
                  from (select report_norm_path(path) pth, count(*) n from site_events where user_id = p_user and kind = 'view' group by 1 order by 2 desc limit 10) t)
  )
$$;

revoke all on function public.admin_report_overview(int), public.admin_report_live(), public.admin_report_users(int, text, int),
  public.report_ops(timestamptz, uuid, int), public.admin_report_ops(int), public.admin_report_subs(), public.admin_report_user(uuid)
  from public, anon, authenticated;

-- Delivery: each browser event carries an id; unsent events are kept in the browser and
-- re-sent on the next page, so a duplicate delivery must be harmless.
alter table public.site_events add column if not exists eid text;
create unique index if not exists site_events_sid_eid on public.site_events (sid, eid);
