-- Market Intelligence v2 — flexible JSONB schema
-- Run in Supabase SQL Editor. Drops the old market_data table if it exists.

drop table if exists market_data cascade;

create table market_data (
  id            uuid primary key default gen_random_uuid(),

  -- Core indexed fields (always present, used for filtering and dedup)
  pais          text not null,
  ciudad        text,
  subzona       text,
  sector        text not null,   -- 'Oficinas' | 'Industrial' | 'Retail'
  tipo          text,            -- sub-type e.g. 'Centro Comercial', 'Galera'
  periodo       text,
  fecha         date,

  -- Sheet tracking (for write-back and updates)
  sheet_tab     text,            -- original tab name in the spreadsheet
  sheet_row     integer,         -- row number in the sheet (1-indexed, header = 1)

  -- All metric columns stored as flexible JSONB
  -- Keys are normalized from spreadsheet headers (lowercase snake_case)
  data          jsonb not null default '{}',

  -- Preserved as top-level columns for easy access. referencia defaults to
  -- '' (application-enforced) not null — see unique index note below.
  referencia    text default '',
  info_resumen  text,

  source_type   text,            -- 'sheet_sync' | 'pasted_text' | 'pdf' | 'manual'
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Unique constraint for upsert — one row per market/period/broker combination.
-- referencia is included because multiple brokers (Colliers, JLL, Newmark,
-- Cushman & Wakefield, etc.) often report on the same market/period —
-- each broker's report is its own row, not an update of another's.
--
-- PLAIN columns, no coalesce/expressions — Supabase's onConflict param sends
-- a plain column list to Postgres's ON CONFLICT clause, which must exactly
-- match the index definition. The app defaults ciudad/subzona/tipo/periodo/
-- referencia to '' instead of null, so NULL-vs-NULL non-uniqueness never
-- comes into play and a plain index is safe.
create unique index market_data_unique
  on market_data (pais, ciudad, subzona, sector, tipo, periodo, referencia);

-- Indexes for common filters
create index market_data_pais_sector on market_data (pais, sector);
create index market_data_ciudad      on market_data (ciudad);
create index market_data_periodo     on market_data (periodo);
create index market_data_sheet_tab   on market_data (sheet_tab, sheet_row);

-- GIN index for querying inside the JSONB data blob
create index market_data_gin on market_data using gin (data);
