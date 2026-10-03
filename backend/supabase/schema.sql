-- Run in Supabase: SQL Editor -> New query -> Run
create table if not exists public.lens_interactions (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  session_id   text not null,
  mode         text not null,          -- advisor | lab | general
  role         text,                   -- visitor | me | typed
  question     text,
  answer       text,
  label        text,                   -- object detected by camera, if any
  had_image    boolean default false,
  sources      jsonb,
  latency_ms   integer
);
create index if not exists lens_interactions_session_idx
  on public.lens_interactions (session_id, created_at desc);

-- The backend uses the service-role key (bypasses RLS). Keep RLS ON so the
-- table is never exposed to the browser directly.
alter table public.lens_interactions enable row level security;
