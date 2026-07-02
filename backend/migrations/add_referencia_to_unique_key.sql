-- Multiple brokers (Colliers, JLL, Newmark, Cushman & Wakefield, etc.) often
-- report on the same país/ciudad/subzona/sector/tipo/periodo combination.
-- The old unique index treated those as the "same" row and silently dropped
-- all but the last broker synced. Adding referencia to the key lets every
-- broker's report for a given market/period coexist as its own row.
--
-- IMPORTANT: this must be a PLAIN column index (no coalesce/expressions).
-- Supabase's upsert(...).onConflict('col1,col2,...') sends a plain column
-- list to Postgres's ON CONFLICT clause, and Postgres requires an exact
-- match against the index's indexed columns — an expression-based index
-- (e.g. coalesce(ciudad,'')) will NOT match a plain-column ON CONFLICT
-- target, causing "no unique or exclusion constraint matching the ON
-- CONFLICT specification". The app already defaults ciudad/subzona/tipo/
-- periodo/referencia to '' instead of null, so a plain index is safe —
-- NULL-vs-NULL non-uniqueness never comes into play.
--
-- Run in Supabase SQL Editor.

drop index if exists market_data_unique;

create unique index market_data_unique
  on market_data (pais, ciudad, subzona, sector, tipo, periodo, referencia);
