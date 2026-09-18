-- Per-user "brain": the owner's style, preferences and accumulated notes that the
-- AI follows and refines over time — one signature per user (optionally per page).
-- Idempotent — safe to re-run.
create table if not exists studio_memory (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  page_id     text not null default '*',   -- '*' = applies to all the user's pages
  style       text,                         -- distilled voice/style the AI keeps to
  notes       text,                         -- accumulated owner guidance (appended)
  updated_at  timestamptz default now(),
  unique (user_id, page_id)
);
alter table studio_memory enable row level security;
do $$ begin
  create policy studio_memory_own on studio_memory for select using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
