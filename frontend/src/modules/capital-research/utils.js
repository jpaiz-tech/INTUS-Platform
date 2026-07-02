export function tier(s) {
  return s >= 85 ? 'A+' : s >= 75 ? 'A' : s >= 60 ? 'B' : s >= 45 ? 'C' : 'D';
}

export function tierClass(s) {
  return s >= 85 ? 't-Ap' : s >= 75 ? 't-A' : s >= 60 ? 't-B' : s >= 45 ? 't-C' : 't-D';
}

export function scoreColor(s) {
  return s >= 85 ? '#2D5E32' : s >= 75 ? '#4A6B4E' : s >= 60 ? '#B8893A' : s >= 45 ? '#A0522A' : '#8E3A3A';
}

export function subCls(s) {
  return s >= 7 ? 'sp-hi' : s >= 5 ? 'sp-md' : 'sp-lo';
}

export const IRO_MAP = {
  'Retail': 'R', 'Industrial': 'I', 'Office': 'O', 'Oficinas': 'O',
  'HQ': 'O', 'HQ Corp.': 'O', 'Banca': 'O', 'Seguros': 'O', 'Consultoría': 'O',
  'Abogados': 'O', 'Voz / Call': 'O', 'BPO / KPO': 'O', 'Tech HQ': 'O',
  'Cold Storage': 'I', 'Producción': 'I', 'FTZ Mfg': 'I', 'Bodega': 'I',
  'Last-Mile': 'I', 'Dark Store': 'I', 'Plásticos': 'I', 'Hazmat': 'I',
  'Digital Infra': 'I', 'Storage': 'I', 'Torres': 'I', 'DC / Dist.': 'I',
  'Disp. Médicos': 'I',
  'Planta de Producción': 'I', 'Manufactura FTZ': 'I', 'Bodega / Dist.': 'I',
  'Last-Mile Hub': 'I', 'Plásticos / Químicos': 'I', 'Bodega Hazmat': 'I',
  'Big Box': 'R', 'Vet': 'R', 'Pet Care': 'R', 'Dealers OEM': 'R',
  'Electrónica': 'R', 'Gimnasios': 'R', 'Tiendas': 'R', 'Cadena': 'R',
  'Retail Anchor': 'R', 'Clínicas Vet.': 'R', 'Cadena Farmacéutica': 'R',
};

export function probClass(p) {
  const lc = p.toLowerCase();
  return lc.includes('alto') ? 'risk-prob-hi' : lc.includes('bajo') ? 'risk-prob-lo' : 'risk-prob-mid';
}

export function impactClass(p) {
  return p.toLowerCase().includes('alto') ? 'risk-impact-hi' : 'risk-impact-mid';
}
