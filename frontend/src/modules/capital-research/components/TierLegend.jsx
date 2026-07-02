const TIERS = [
  { label: 'A+', desc: '≥ 85  Prioridad máxima',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'A',  desc: '≥ 75  Allocación primaria', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { label: 'B',  desc: '≥ 60  Condicional',         cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'C',  desc: '≥ 45  Solo componente',     cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  { label: 'D',  desc: '< 45  Evitar',              cls: 'bg-red-50 text-red-600 border-red-200' },
];

export default function TierLegend() {
  return (
    <div className="flex flex-wrap gap-3.5 mb-6 text-xs text-slate-500">
      {TIERS.map(t => (
        <div key={t.label} className="flex items-center gap-1.5">
          <span className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 border rounded ${t.cls}`}>{t.label}</span>
          {t.desc}
        </div>
      ))}
    </div>
  );
}
