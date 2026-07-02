const DIMS = [
  { key: 'd1', label: 'DURABILIDAD', pct: '27%', items: [
    'Éxito del sector a largo plazo (horizonte 10+ años)',
    'Resistencia a avances globales: IA, ecommerce, automatización',
    'Tendencias seculares de demanda · viabilidad del modelo de negocio',
    'Riesgo regulatorio estructural · tendencia secular de demanda',
  ]},
  { key: 'd2', label: 'SOLIDEZ', pct: '22%', items: [
    'Durabilidad del modelo de negocio',
    'Previsibilidad de ingresos',
    'Posición competitiva del operador',
    'Penaliza si el sector es predominantemente independientes',
  ]},
  { key: 'd3', label: 'ADHESIÓN', pct: '18%', items: [
    'Probabilidad de renovación',
    'Costo de fit-out y adhesión a la ubicación',
    'Criticidad del espacio para la operación',
    'Facilidad de re-arrendamiento si el inquilino sale',
  ]},
  { key: 'd4', label: 'SOLVENCIA', pct: '16%', items: [
    'Calidad crediticia del inquilino',
    'Disponibilidad de garantía corporativa',
    'Solidez del balance general',
    'Tasa histórica de incumplimiento',
  ]},
  { key: 'd5', label: 'RESILIENCIA', pct: '17%', items: [
    'Riesgo y capacidad de sobrevivir shocks de corto plazo',
    'Riesgo de cierre forzado (pandemia / evento)',
    'Desempeño en recesión · demanda esencial vs. discrecional',
  ]},
];

export default function WeightBar() {
  return (
    <>
      <div className="wbar">
        {DIMS.map(d => (
          <div key={d.key} className={`wbar-seg wbar-${d.key}`}>
            {d.label} <span className="wbar-pct">{d.pct}</span>
          </div>
        ))}
      </div>
      <div className="wbar-cards">
        {DIMS.map(d => (
          <div key={d.key} className={`wbar-card wbar-card-${d.key}`}>
            <ul>
              {d.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
