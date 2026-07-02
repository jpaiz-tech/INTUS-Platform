import { scoreColor, tier, tierClass } from '../utils.js';

export default function RankList({ sectors }) {
  return (
    <div className="rank-list">
      {sectors.map((d, i) => {
        const sc = scoreColor(d.score);
        return (
          <div className="rank-row" key={d.name}>
            <div className="rank-num">{i + 1}</div>
            <div className="rank-name-wrap">
              <div className="rank-name">{d.name}</div>
              <div className="rank-sub">{d.sub}</div>
            </div>
            <div className="rank-track">
              <div className="rank-fill" style={{ width: `${d.score}%`, background: sc }} />
            </div>
            <div className="rank-score" style={{ color: sc }}>{d.score}</div>
            <span className={`rank-tier ${tierClass(d.score)}`}>{tier(d.score)}</span>
          </div>
        );
      })}
    </div>
  );
}
