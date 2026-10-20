import { useState } from 'react';
import { useResults } from '../state/results';
import type { YearPoint } from '../model/outcomes';
import { Panel } from './Controls';
import { fmtB, pct } from '../format';

const W = 320, H = 170;

/** Compact $ axis labels: $0, $500B, $1T, $1.5T, $40T. */
const axis$ = (b: number) => (b === 0 ? '$0' : Math.abs(b) >= 1000 ? `${b < 0 ? '−' : ''}$${+(Math.abs(b) / 1000).toFixed(1)}T` : `${b < 0 ? '−' : ''}$${Math.round(Math.abs(b))}B`);
const PAD = { l: 46, r: 12, t: 12, b: 24 };

type Pick = (p: YearPoint) => number | null;

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || Math.abs(hi) || 1;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
  const ticks = [];
  const top = Math.ceil(hi / step - 1e-9) * step;
  for (let v = Math.floor(lo / step) * step; v <= top + step * 0.001; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function Chart({ title, base, plan, pick, fmt, axisFmt, zero }: {
  title: string; base: YearPoint[]; plan: YearPoint[]; pick: Pick; fmt: (v: number) => string; axisFmt?: (v: number) => string; zero?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const idx = plan.map((_, i) => i).filter((i) => pick(plan[i]) !== null);
  const vals = idx.flatMap((i) => [pick(base[i])!, pick(plan[i])!]);
  const ticks = niceTicks(Math.min(zero ? 0 : Infinity, ...vals), Math.max(...vals));
  const [y0, y1] = [ticks[0], ticks.at(-1)!];
  const X = (i: number) => PAD.l + ((i - idx[0]) / (idx.at(-1)! - idx[0])) * (W - PAD.l - PAD.r);
  const Y = (v: number) => H - PAD.b - ((v - y0) / (y1 - y0 || 1)) * (H - PAD.t - PAD.b);
  const path = (s: YearPoint[]) => idx.map((i, k) => `${k ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(pick(s[i])!).toFixed(1)}`).join(' ');

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = PAD.l + ((e.clientX - r.left) / r.width) * (W - PAD.l - PAD.r);
    let best = idx[0];
    for (const i of idx) if (Math.abs(X(i) - x) < Math.abs(X(best) - x)) best = i;
    setHover(best);
  };

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}, FY${plan[idx[0]].fy} to FY${plan.at(-1)!.fy}. Your plan ends at ${fmt(pick(plan.at(-1)!)!)}, current law at ${fmt(pick(base.at(-1)!)!)}.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} className={t === 0 && y0 < 0 ? 'zero' : 'grid'} />
              <text x={PAD.l - 6} y={Y(t) + 4} className="axis" textAnchor="end">{(axisFmt ?? fmt)(t)}</text>
            </g>
          ))}
          {idx.filter((i) => (plan[i].fy - plan[idx[0]].fy) % 2 === 0).map((i) => (
            <text key={i} x={X(i)} y={H - 6} className="axis" textAnchor="middle">{`'${String(plan[i].fy).slice(2)}`}</text>
          ))}
          <path d={path(base)} className="line base" />
          <path d={path(plan)} className="line plan" />
          {hover !== null && (
            <g className="hover">
              <line x1={X(hover)} x2={X(hover)} y1={PAD.t} y2={H - PAD.b} />
              <circle cx={X(hover)} cy={Y(pick(base[hover])!)} r={4} className="dot base" />
              <circle cx={X(hover)} cy={Y(pick(plan[hover])!)} r={4} className="dot plan" />
            </g>
          )}
          <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} className="hit"
            onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover !== null && (
          <div className="tip" style={{ left: `${(X(hover) / W) * 100}%` }}>
            <strong>FY{plan[hover].fy}</strong>
            <span><i className="sw plan" />Your plan {fmt(pick(plan[hover])!)}</span>
            <span><i className="sw base" />Current law {fmt(pick(base[hover])!)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

export function Outlook() {
  const { projection: plan, baseProjection: base, budget } = useResults();
  const charts: { title: string; pick: Pick; fmt: (v: number) => string; axisFmt?: (v: number) => string; zero?: boolean }[] = [
    { title: 'Debt-to-GDP', pick: (p) => p.debt / p.gdp, fmt: (v) => pct(v, 0) },
    { title: 'Annual deficit', pick: (p) => p.deficit, fmt: (v) => fmtB(v), axisFmt: axis$, zero: true },
    { title: 'Interest cost', pick: (p) => p.interest, fmt: (v) => fmtB(v), axisFmt: axis$, zero: true },
    { title: 'Debt held by the public', pick: (p) => p.debt, fmt: (v) => fmtB(v), axisFmt: axis$, zero: true },
  ];
  return (
    <Panel title="10-year outlook" className="outlook"
      right={<span className="legend"><span><i className="sw plan" />Your plan</span><span><i className="sw base" />Current law</span></span>}>
      <div className="charts">
        {charts.map((c) => <Chart key={c.title} {...c} base={base} plan={plan} />)}
      </div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <div className="table-scroll">
          <table>
            <thead><tr><th>FY</th>{charts.map((c) => <th key={c.title} colSpan={2}>{c.title}</th>)}</tr>
              <tr><th />{charts.map((c) => [<th key={c.title + 'p'}>Plan</th>, <th key={c.title + 'b'}>Current law</th>])}</tr></thead>
            <tbody>
              {plan.map((p, i) => (
                <tr key={p.fy}><td>{p.fy}</td>{charts.map((c) => {
                  const a = c.pick(p), b = c.pick(base[i]);
                  return [<td key={c.title + 'p'}>{a === null ? '–' : c.fmt(a)}</td>, <td key={c.title + 'b'}>{b === null ? '–' : c.fmt(b)}</td>];
                })}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="hint">Your plan takes effect in FY2027. The primary balance (deficit before interest) stays fixed as a share of GDP. Interest accrues on the growing or shrinking debt, and nominal GDP grows {pct(budget.nominalGrowth, 1)}/yr (set real growth and inflation in the Debt card). It's a simple projection, not a CBO-style forecast.</p>
    </Panel>
  );
}
