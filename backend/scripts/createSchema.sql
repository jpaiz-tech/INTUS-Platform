-- ============================================================
-- ETRA Normalized Schema
-- Run this in the Supabase SQL editor once.
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- sector_formats: one row per tab per sector
CREATE TABLE IF NOT EXISTS sector_formats (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_name     text NOT NULL,
  short_label     text NOT NULL,
  tab_label       text,
  asset_type      text,
  score           integer,
  score_exact     numeric(4,1),
  tier            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(sector_name, short_label)
);

-- dimension_scores: one row per dimension per format
CREATE TABLE IF NOT EXISTS dimension_scores (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sector_name     text NOT NULL,
  format_label    text NOT NULL,
  dimension       text NOT NULL,
  weight          numeric(4,2),
  score           integer,
  contribution    numeric(5,2),
  created_at      timestamptz DEFAULT now(),
  UNIQUE(sector_name, format_label, dimension)
);

-- research_runs: full audit trail for every agent run
CREATE TABLE IF NOT EXISTS research_runs (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id          text UNIQUE,
  sector_name     text,
  industry_input  text,
  company_input   text,
  real_estate_type text,
  research_mode   text,
  agent           text,
  status          text DEFAULT 'completed',
  output_summary  text,
  created_at      timestamptz DEFAULT now()
);

-- companies: reference operators cited in research
CREATE TABLE IF NOT EXISTS companies (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text NOT NULL,
  sector_name     text,
  role            text DEFAULT 'reference',
  source_run_id   text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(name, sector_name)
);

-- Add normalized score columns to existing sectors table
ALTER TABLE sectors
  ADD COLUMN IF NOT EXISTS tier       text,
  ADD COLUMN IF NOT EXISTS assets     text[],
  ADD COLUMN IF NOT EXISTS score_exact numeric(4,1);

-- Indexes for common dashboard queries
CREATE INDEX IF NOT EXISTS idx_sectors_score         ON sectors(score DESC);
CREATE INDEX IF NOT EXISTS idx_sector_formats_sector ON sector_formats(sector_name);
CREATE INDEX IF NOT EXISTS idx_sector_formats_score  ON sector_formats(score DESC);
CREATE INDEX IF NOT EXISTS idx_dimension_scores_sector ON dimension_scores(sector_name);
CREATE INDEX IF NOT EXISTS idx_dimension_scores_dim  ON dimension_scores(dimension);
CREATE INDEX IF NOT EXISTS idx_research_runs_sector  ON research_runs(sector_name);
CREATE INDEX IF NOT EXISTS idx_research_runs_created ON research_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companies_sector      ON companies(sector_name);
