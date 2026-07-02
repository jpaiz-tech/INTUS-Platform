-- ══════════════════════════════════════════════════════════════════
-- INTUS Platform — Supabase schema additions
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- NOTE: the research tables (sectors, research_runs, industries, formats,
-- risks, recommendations, market data tables) already exist from the
-- research project — this file only ADDS what the unified platform needs.
-- ══════════════════════════════════════════════════════════════════

-- Prefactibilidad projects (replaces the browser IndexedDB of the HTML app).
-- id is text: the legacy app generates Date.now() ids and they are preserved.
create table if not exists public.platform_projects (
  id         text primary key,
  name       text,
  location   text,
  inputs     jsonb not null,
  at         timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists platform_projects_touch on public.platform_projects;
create trigger platform_projects_touch
  before update on public.platform_projects
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────
-- Team-shared data: any authenticated @intuscorp.com user has full access.
alter table public.platform_projects enable row level security;

drop policy if exists "intuscorp full access" on public.platform_projects;
create policy "intuscorp full access" on public.platform_projects
  for all
  to authenticated
  using     (coalesce(auth.jwt() ->> 'email', '') ilike '%@intuscorp.com')
  with check (coalesce(auth.jwt() ->> 'email', '') ilike '%@intuscorp.com');

-- ══════════════════════════════════════════════════════════════════
-- RECOMMENDED (optional): apply the same domain-restricted RLS to the
-- existing research tables. The backend uses the service role key, so it
-- bypasses RLS and keeps working; this only locks down direct anon access.
-- Uncomment and run if/when desired:
--
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['sectors','research_runs','industries','formats','risks','recommendations']
--   loop
--     execute format('alter table public.%I enable row level security', t);
--     execute format('drop policy if exists "intuscorp full access" on public.%I', t);
--     execute format($p$create policy "intuscorp full access" on public.%I
--       for all to authenticated
--       using (coalesce(auth.jwt() ->> ''email'', '''') ilike ''%%@intuscorp.com'')
--       with check (coalesce(auth.jwt() ->> ''email'', '''') ilike ''%%@intuscorp.com'')$p$, t);
--   end loop;
-- end $$;

-- ══════════════════════════════════════════════════════════════════
-- GOOGLE SIGN-IN SETUP (one-time, in dashboards — not SQL):
-- 1. Google Cloud Console → APIs & Services → Credentials → Create
--    OAuth client ID (Web application). Authorized redirect URI:
--    https://<YOUR-PROJECT-REF>.supabase.co/auth/v1/callback
-- 2. Supabase Dashboard → Authentication → Providers → Google:
--    enable, paste Client ID + Client Secret.
-- 3. Supabase Dashboard → Authentication → URL Configuration:
--    add http://localhost:5174 to "Redirect URLs" (and the production URL later).
-- The app also enforces @intuscorp.com client-side and via the RLS above.
-- ══════════════════════════════════════════════════════════════════
