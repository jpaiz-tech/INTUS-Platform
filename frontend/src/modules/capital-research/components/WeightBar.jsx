const DIMS = [
  { key: 'd1', label: 'DURABILIDAD', pct: '27%', bg: 'bg-emerald-50/60', items: [
    'Éxito del sector a largo plazo (horizonte 10+ años)',
    'Resistencia a avances globales: IA, ecommerce, automatización',
    'Tendencias seculares de demanda · viabilidad del modelo de negocio',
    'Riesgo regulatorio estructural · tendencia secular de demanda',
  ]},
  { key: 'd2', label: 'SOLIDEZ', pct: '22%', bg: 'bg-slate-50', items: [
    'Durabilidad del modelo de negocio',
    'Previsibilidad de ingresos',
    'Posición competitiva del operador',
    'Penaliza si el sector es predominantemente independientes',
  ]},
  { key: 'd3', label: 'ADHESIÓN', pct: '18%', bg: 'bg-emerald-50/40', items: [
    'Probabilidad de renovación',
    'Costo de fit-out y adhesión a la ubicación',
    'Criticidad del espacio para la operación',
    'Facilidad de re-arrendamiento si el inquilino sale',
  ]},
  { key: 'd4', label: 'SOLVENCIA', pct: '16%', bg: 'bg-slate-50', items: [
    'Calidad crediticia del inquilino',
    'Disponibilidad de garantía corporativa',
    'Solidez del balance general',
    'Tasa histórica de incumplimiento',
  ]},
  { key: 'd5', label: 'RESILIENCIA', pct: '17%', bg: 'bg-emerald-50/30', items: [
    'Riesgo y capacidad de sobrevivir shocks de corto plazo',
    'Riesgo de cierre forzado (pandemia / evento)',
    'Desempeño en recesión · demanda esencial vs. discrecional',
  ]},
];

export default function WeightBar() {
  return (
    <>
      <div className="grid grid-cols-[27fr_22fr_18fr_16fr_17fr] border border-slate-200 rounded-lg overflow-hidden mb-1">
        {DIMS.map(d => (
          <div key={d.key} className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 border-r border-slate-200 last:border-r-0 whitespace-nowrap ${d.bg}`}>
            {d.label} <span className="opacity-50 font-normal">{d.pct}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[27fr_22fr_18fr_16fr_17fr] border border-t-0 border-slate-200 rounded-b-lg overflow-hidden mb-6">
        {DIMS.map(d => (
          <div key={d.key} className={`p-2.5 border-r border-slate-200 last:border-r-0 ${d.bg}`}>
            <ul className="flex flex-col gap-1">
              {d.items.map((item, i) => (
                <li key={i} className="text-xs text-slate-500 leading-snug pl-3 relative">
                  <span className="absolute left-0 text-emerald-500">·</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
