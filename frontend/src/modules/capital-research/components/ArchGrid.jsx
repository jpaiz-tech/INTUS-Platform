import { scoreColor, tier } from '../utils.js';

const ARCH_TYPES = ['Industrial', 'Retail', 'Oficinas'];

const ARCH_META = {
  Industrial: {
    eyebrow: 'INDUSTRIAL',
    name: 'Parque Industrial Multi-Inquilino',
    sub: 'Torres · frío · médico · distribución',
    verdict: 'El tipo de activo con mayor densidad de sectores de alocación primaria. Torres telecomunicaciones y cold chain médico-farmacéutico lideran por adhesión estructural y crédito institucional. Mix con menor correlación a ciclos económicos adversos.',
  },
  Retail: {
    eyebrow: 'RETAIL STANDALONE · SINGLE-TENANT',
    name: 'Retail Standalone — Inquilino Único NNN',
    sub: 'Solo anclas esenciales con crédito institucional',
    verdict: 'El anchor determina la calidad del activo. El mix inline es secundario y depende del tráfico generado por la ancla. Sin anchor de calificación primaria, el formato no se sostiene dentro del mandato.',
  },
  Oficinas: {
    eyebrow: 'OFICINAS · HQ CORPORATIVO',
    name: 'Edificio Corporativo — HQ + Servicios',
    sub: 'Sedes regionales ancla + servicios profesionales',
    verdict: 'Las sedes HQ aportan leases de 10–15 años con crédito institucional y alta adhesión estructural. El mix de regulados y multinacionales reduce la volatilidad del flujo. Formato viable en mercados con oferta de oficinas clase A estabilizada.',
  },
};

// Returns the score specific to this asset type for a sector,
// by finding the tab whose asset label matches the type.
function formatScore(d, assetType) {
  const raw = assetType.toLowerCase();
  const key = raw === 'oficinas' ? 'office' : raw;
  const tab = (d.tabs || []).find(t =>
    ((t.assets && t.assets[0] ? t.assets[0].label : '') + ' ' + (t.shortLabel || ''))
      .toLowerCase().includes(key)
  );
  if (tab) {
    const chip = (d.assetChips || []).find(c => c.label === tab.shortLabel);
    if (chip && !chip.pending && chip.score != null) return chip.score;
    if (tab.score != null) return tab.score;
  }
  return d.scoreExact ?? d.score;
}

function buildArchCards(sectors) {
  return ARCH_TYPES.map(assetType => {
    const meta = ARCH_META[assetType];
    const matching = sectors
      .filter(d => Array.isArray(d.assets) && d.assets.includes(assetType))
      .sort((a, b) => formatScore(b, assetType) - formatScore(a, assetType));

    if (matching.length === 0) return null;

    const avg = Math.round(
      matching.reduce((sum, d) => sum + formatScore(d, assetType), 0) / matching.length
    );
    const sc = scoreColor(avg);

    return { assetType, meta, matching, avg, sc };
  }).filter(Boolean);
}

export default function ArchGrid({ sectors }) {
  const cards = buildArchCards(sectors);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(290px,1fr))] gap-3.5 mb-9">
      {cards.map(({ assetType, meta, matching, avg, sc }) => (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4" key={assetType}>
          <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5 opacity-80">{meta.eyebrow}</div>
          <div className="flex justify-between items-start mb-2.5">
            <div className="text-sm font-bold text-slate-800 leading-snug">
              {meta.name}<br />
              <span className="font-normal text-sm text-slate-400">{meta.sub}</span>
            </div>
            <div className="font-mono font-bold text-2xl text-right ml-3 leading-none" style={{ color: sc }}>
              {avg}<small className="block text-[11px] font-normal uppercase tracking-wide opacity-60 mt-0.5">TIER {tier(avg)}</small>
            </div>
          </div>
          <div className="flex flex-col gap-1 mb-2.5">
            {matching.slice(0, 5).map((d, i) => (
              <div className="grid grid-cols-[18px_1fr_30px] items-center gap-1.5 text-sm text-slate-500" key={d.name}>
                <span className="font-mono text-xs text-slate-400 text-right opacity-60">{i + 1}</span>
                <span>{d.name}{d.sub ? ` — ${d.sub.split('—')[0].trim()}` : ''}</span>
                <span className="font-mono font-bold text-sm text-right text-slate-800">{Math.round(formatScore(d, assetType))}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-baseline pt-2 mt-0.5 border-t border-slate-200">
            <span className="text-xs uppercase tracking-wide text-slate-400">promedio</span>
            <span className="font-mono font-bold text-lg text-emerald-600">{avg}</span>
          </div>
          <div className="text-sm italic text-slate-500 leading-relaxed border-t border-slate-100 pt-2 mt-2.5">{meta.verdict}</div>
        </div>
      ))}
    </div>
  );
}
