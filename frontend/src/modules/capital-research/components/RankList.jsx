import { scoreColor, tier } from '../utils.js';

const TIER_CLS = {
  'A+': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  A:    'bg-emerald-50 text-emerald-600 border-emerald-200',
  B:    'bg-amber-50 text-amber-700 border-amber-200',
  C:    'bg-orange-50 text-orange-700 border-orange-200',
  D:    'bg-red-50 text-red-600 border-red-200',
};

export default function RankList({ sectors }) {
  return (
    <div className="flex flex-col gap-2.5 mb-9">
      {sectors.map((d, i) => {
        const sc = scoreColor(d.score);
        const t  = tier(d.score);
        return (
          <div className="grid grid-cols-[22px_230px_1fr_34px_36px] items-center gap-2.5" key={d.name}>
            <div className="text-xs text-slate-400 text-right">{i + 1}</div>
            <div>
              <div className="text-sm font-bold text-slate-800">{d.name}</div>
              <div className="text-xs text-slate-400">{d.sub}</div>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${d.score}%`, background: sc }} />
            </div>
            <div className="font-mono font-bold text-sm text-right" style={{ color: sc }}>{d.score}</div>
            <span className={`inline-flex items-center justify-center text-xs font-bold px-1.5 py-0.5 border rounded ${TIER_CLS[t] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>{t}</span>
          </div>
        );
      })}
    </div>
  );
}
