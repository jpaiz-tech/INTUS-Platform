-- Market Intelligence — market_data table
-- Run manually in Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists market_data (
  id               uuid primary key default gen_random_uuid(),
  pais             text not null,
  ciudad           text,
  subzona          text,
  sector           text not null,   -- 'Oficinas' | 'Industrial' | 'Retail'
  tipo             text,
  periodo          text,
  fecha            date,
  inventario_total numeric,
  inventario_a     numeric,
  inventario_b     numeric,
  m2_construccion  numeric,
  renta_prom       numeric,
  renta_a          numeric,
  renta_b          numeric,
  rango_renta_min  numeric,
  rango_renta_max  numeric,
  venta_prom       numeric,
  absorcion_neta   numeric,
  absorcion_bruta  numeric,
  periodo_absorcion text,
  cap_rate         numeric,
  ocupacion        numeric,
  disponibilidad   numeric,
  disponibilidad_a numeric,
  disponibilidad_b numeric,
  tendencia        text,
  referencia       text,
  info_resumen     text,
  source_type      text,            -- 'manual' | 'pasted_text' | 'pdf'
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists market_data_pais_sector  on market_data(pais, sector);
create index if not exists market_data_ciudad       on market_data(ciudad);
create index if not exists market_data_periodo      on market_data(periodo);
create index if not exists market_data_sector       on market_data(sector);
