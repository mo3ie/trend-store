-- Saved ad audiences — a reusable targeting spec the user can load when creating
-- a campaign. Idempotent.
create table if not exists ad_audiences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  name       text not null,
  targeting  jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table ad_audiences enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='ad_audiences' and policyname='users_own_audiences') then
    create policy "users_own_audiences" on ad_audiences for all using (auth.uid() = user_id);
  end if;
end $$;
create index if not exists idx_ad_audiences_user on ad_audiences(user_id);
