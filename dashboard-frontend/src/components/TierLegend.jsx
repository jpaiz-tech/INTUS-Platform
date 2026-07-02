const TIERS = [
  { cls: 't-Ap', label: 'A+', desc: '≥ 85  Prioridad máxima' },
  { cls: 't-A',  label: 'A',  desc: '≥ 75  Allocación primaria' },
  { cls: 't-B',  label: 'B',  desc: '≥ 60  Condicional' },
  { cls: 't-C',  label: 'C',  desc: '≥ 45  Solo componente' },
  { cls: 't-D',  label: 'D',  desc: '< 45  Evitar' },
];

export default function TierLegend() {
  return (
    <div className="tier-legend">
      {TIERS.map(t => (
        <div key={t.cls} className="tleg-item">
          <span className={`rank-tier ${t.cls}`}>{t.label}</span> {t.desc}
        </div>
      ))}
    </div>
  );
}
