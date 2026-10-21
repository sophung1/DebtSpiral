import { YIELDS0 } from '../model/macro';
import { pct } from '../format';

const W = 300, H = 130, PAD = { l: 40, r: 22, t: 10, b: 22 };
const TERMS = ['2-yr', '10-yr', '30-yr'] as const;

/** Treasury yield curve today vs under the plan (2-, 10- and 30-year), with an inversion note. */
export function YieldCurve({ plan }: { plan: { y2: number; y10: number; y30: number } }) {
  const today = [YIELDS0.y2, YIELDS0.y10, YIELDS0.y30], mine = [plan.y2, plan.y10, plan.y30];
  const all = [...today, ...mine];
  // Whole-percent gridlines, 1 or 2 points apart.
  const lo = Math.max(0, Math.floor(Math.min(...all) * 100 - 0.25)), top = Math.ceil(Math.max(...all) * 100 + 0.25);
  const gap = top - lo > 6 ? 2 : 1, hiPt = lo + Math.ceil((top - lo) / gap) * gap;
  const [loR, hi] = [lo / 100, hiPt / 100];
  const X = (i: number) => PAD.l + (i / 2) * (W - PAD.l - PAD.r);
  const Y = (v: number) => H - PAD.b - ((v - loR) / (hi - loR || 0.01)) * (H - PAD.t - PAD.b);
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join(' ');
  const ticks = Array.from({ length: (hiPt - lo) / gap + 1 }, (_, k) => (lo + k * gap) / 100);
  const inverted = plan.y2 > plan.y10 + 0.0005;
  const changed = mine.some((v, i) => Math.abs(v - today[i]) > 0.00005);
  return (
    <figure className="chart yield-curve">
      <figcaption>Treasury yields by loan length (all borrowed today) {inverted && <em className="neg"> · inverted: short rates above long ones, a classic recession signal</em>}</figcaption>
      <span className="legend"><span><i className="sw base" />Today's market</span>{changed && <span><i className="sw plan" />With your plan, this year</span>}</span>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Yield curve. Today: ${today.map((v, i) => `${TERMS[i]} ${pct(v, 1)}`).join(', ')}. Your plan: ${mine.map((v, i) => `${TERMS[i]} ${pct(v, 1)}`).join(', ')}.`}>
        {ticks.map((t) => (
          <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} className="grid" /><text x={PAD.l - 6} y={Y(t) + 4} className="axis" textAnchor="end">{pct(t, 0)}</text></g>
        ))}
        {TERMS.map((t, i) => <text key={t} x={X(i)} y={H - 6} className="axis" textAnchor="middle">{t}</text>)}
        <path d={path(today)} className="line base" />
        {changed && <path d={path(mine)} className="line plan" />}
        {today.map((v, i) => <circle key={`b${i}`} cx={X(i)} cy={Y(v)} r={3.5} className="dot base" />)}
        {changed && mine.map((v, i) => <circle key={`p${i}`} cx={X(i)} cy={Y(v)} r={3.5} className="dot plan" />)}
      </svg>
    </figure>
  );
}
