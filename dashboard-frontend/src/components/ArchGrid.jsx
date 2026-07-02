import { scoreColor, tier, tierClass } from '../utils.js';

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
    <div className="arch-grid">
      {cards.map(({ assetType, meta, matching, avg, sc }) => (
        <div className="arch-card" key={assetType}>
          <div className="arch-eyebrow">{meta.eyebrow}</div>
          <div className="arch-head">
            <div className="arch-name">
              {meta.name}<br />
              <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--w60)' }}>{meta.sub}</span>
            </div>
            <div className="arch-score" style={{ color: sc }}>
              {avg}<small>TIER {tier(avg)}</small>
            </div>
          </div>
          <div className="arch-comps">
            {matching.slice(0, 5).map((d, i) => (
              <div className="arch-comp" key={d.name}>
                <span className="ac-rank">{i + 1}</span>
                <span>{d.name}{d.sub ? ` — ${d.sub.split('—')[0].trim()}` : ''}</span>
                <span className="ac-s">{Math.round(formatScore(d, assetType))}</span>
              </div>
            ))}
          </div>
          <div className="arch-avg">
            <span className="arch-avg-label">promedio</span>
            <span className="arch-avg-score">{avg}</span>
          </div>
          <div className="arch-verdict">{meta.verdict}</div>
        </div>
      ))}
    </div>
  );
}
