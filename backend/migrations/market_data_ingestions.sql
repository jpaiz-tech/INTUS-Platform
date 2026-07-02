-- History of ingestion events (PDF/pasted-text uploads) for Market Intel.
-- One row per "Extraer" + "Guardar" cycle in the Cargar Datos tab.
-- Run in Supabase SQL Editor.

create table if not exists market_data_ingestions (
  id                  uuid primary key default gen_random_uuid(),

  source_type         text not null,   -- 'pdf' | 'pasted_text'
  file_name           text,            -- original PDF filename, null for pasted text
  source_description  text,            -- Claude's description of the document/source
  extraction_notes     text,

  rows_proposed       integer not null default 0,
  rows_inserted       integer not null default 0,
  rows_updated        integer not null default 0,

  created_at          timestamptz default now()
);

create index if not exists market_data_ingestions_created_at
  on market_data_ingestions (created_at desc);
