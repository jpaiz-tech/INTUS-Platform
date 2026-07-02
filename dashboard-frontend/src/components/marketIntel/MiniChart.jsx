const PALETTE = ['#A88B4F', '#3A8E6C', '#4A7FA5', '#8E3A6C', '#7A6EA8', '#5A8E7A'];

const W = 560, PAD_L = 48, PAD_R = 16, PAD_T = 20, PAD_B = 40;

function niceMax(val) {
  if (!val) return 100;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / mag) * mag;
}

// Returns an array of "nice" tick values that span [lo, hi] with no duplicates.
function niceTicks(lo, hi, maxTicks = 5) {
  if (!isFinite(lo) || !isFinite(hi) || lo >= hi) return [lo, hi].filter(isFinite);
  const range = hi - lo;
  const mag   = Math.pow(10, Math.floor(Math.log10(range)));
  for (const s of [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10]) {
    const step  = s * mag;
    const lo2   = Math.floor(lo / step) * step;
    const count = Math.ceil((hi - lo2) / step) + 1;
    if (count <= maxTicks) {
      return Array.from({ length: count }, (_, i) => Math.round((lo2 + i * step) / step) * step);
    }
  }
  return Array.from({ length: maxTicks }, (_, i) => lo + (range / (maxTicks - 1)) * i);
}

function fmtTick(val) {
  if (val >= 1000) return `${Math.round(val / 1000)}k`;
  const r = Math.round(val * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function BarChart({ title, labels, datasets, height = 220 }) {
  const chartH = height - PAD_T - PAD_B;
  const allVals = datasets.flatMap(d => (d.values || []).filter(v => v != null));
  const maxVal  = allVals.length ? niceMax(Math.max(...allVals)) : 100;
  const TICKS   = 4;
  const groupW  = (W - PAD_L - PAD_R) / Math.max(labels.length, 1);
  const dsCount = datasets.length;
  const barW    = Math.min(groupW * 0.7 / dsCount, 44);

  return (
    <div className="mi-chart-wrap">
      {title && <div className="mi-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${height}`} className="mi-chart-svg" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines + Y labels */}
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const val = (maxVal / TICKS) * i;
          const y   = PAD_T + chartH - (val / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.65)">
                {val >= 1000 ? `${Math.round(val / 1000)}k` : Math.round(val)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {labels.map((label, gi) => {
          const cx = PAD_L + gi * groupW + groupW / 2;
          return (
            <g key={gi}>
              {datasets.map((ds, di) => {
                const val  = ds.values?.[gi];
                if (val == null) return null;
                const barH = (val / maxVal) * chartH;
                const x    = cx + (di - dsCount / 2) * (barW + 3) + (barW + 3) / 2 - barW / 2;
                const y    = PAD_T + chartH - barH;
                return (
                  <rect key={di} x={x} y={y} width={barW} height={Math.max(barH, 1)}
                    fill={ds.color || PALETTE[di % PALETTE.length]} rx={2} opacity={0.88}
                  />
                );
              })}
              <text x={cx} y={height - PAD_B + 16} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.65)">
                {label.length > 11 ? label.slice(0, 10) + '…' : label}
              </text>
            </g>
          );
        })}

        {/* Legend (only if multiple datasets) */}
        {datasets.length > 1 && (
          <g transform={`translate(${PAD_L}, ${height - 6})`}>
            {datasets.map((ds, di) => (
              <g key={di} transform={`translate(${di * 120}, 0)`}>
                <rect width={10} height={10} y={-8} fill={ds.color || PALETTE[di % PALETTE.length]} rx={1} />
                <text x={14} fontSize={9} fill="rgba(255,255,255,0.65)">{ds.label}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

function LineChart({ title, labels, datasets, height = 220 }) {
  const chartW = W - PAD_L - PAD_R;
  const chartH = height - PAD_T - PAD_B;
  const allVals = datasets.flatMap(d => (d.values || []).filter(v => v != null));
  if (!allVals.length) return (
    <div className="mi-chart-wrap">
      {title && <div className="mi-chart-title">{title}</div>}
      <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Sin datos disponibles</div>
    </div>
  );

  const rawMax = Math.max(...allVals);
  const rawMin = Math.min(...allVals);
  const ticks  = niceTicks(rawMin, rawMax);
  const minVal = ticks[0];
  const maxVal = ticks[ticks.length - 1];
  const range  = maxVal - minVal || 1;

  const xOf = i => PAD_L + (labels.length > 1 ? (i / (labels.length - 1)) * chartW : chartW / 2);
  const yOf = v => PAD_T + chartH - ((v - minVal) / range) * chartH;

  return (
    <div className="mi-chart-wrap">
      {title && <div className="mi-chart-title">{title}</div>}
      <svg viewBox={`0 0 ${W} ${height}`} className="mi-chart-svg" preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {ticks.map((val, i) => {
          const y = yOf(val);
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.65)">
                {fmtTick(val)}
              </text>
            </g>
          );
        })}

        {/* Lines + dots */}
        {datasets.map((ds, di) => {
          const color = ds.color || PALETTE[di % PALETTE.length];
          const pts   = (ds.values || []).map((v, i) => v != null ? [xOf(i), yOf(v)] : null);
          const segs  = [];
          let current = [];
          pts.forEach(p => {
            if (p) { current.push(p); } else { if (current.length > 1) segs.push(current); current = []; }
          });
          if (current.length > 1) segs.push(current);

          return (
            <g key={di}>
              {segs.map((seg, si) => (
                <polyline key={si} points={seg.map(([x, y]) => `${x},${y}`).join(' ')}
                  fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
              ))}
              {pts.filter(Boolean).map(([x, y], pi) => (
                <circle key={pi} cx={x} cy={y} r={3.5} fill={color} />
              ))}
            </g>
          );
        })}

        {/* X labels — max 7 visible, always show first + last */}
        {(() => {
          const MAX   = 7;
          const step  = labels.length > MAX ? Math.ceil(labels.length / (MAX - 1)) : 1;
          return labels.map((label, i) => {
            const isFirst = i === 0;
            const isLast  = i === labels.length - 1;
            if (!isFirst && !isLast && i % step !== 0) return null;
            return (
              <text key={i} x={xOf(i)} y={height - PAD_B + 16} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.65)">
                {label.length > 9 ? label.slice(0, 8) + '…' : label}
              </text>
            );
          });
        })()}

        {/* Legend */}
        {datasets.length > 1 && (
          <g transform={`translate(${PAD_L}, ${height - 6})`}>
            {datasets.map((ds, di) => (
              <g key={di} transform={`translate(${di * 120}, 0)`}>
                <line x1={0} x2={12} y1={-4} y2={-4} stroke={ds.color || PALETTE[di % PALETTE.length]} strokeWidth={2} />
                <text x={16} fontSize={9} fill="rgba(255,255,255,0.65)">{ds.label}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

export default function MiniChart({ type, title, labels, datasets }) {
  if (!labels?.length || !datasets?.length) return null;
  if (type === 'line') return <LineChart title={title} labels={labels} datasets={datasets} />;
  return <BarChart title={title} labels={labels} datasets={datasets} />;
}
