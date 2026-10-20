import { useState } from 'react';
import { useResults } from '../state/results';
import { budgetFlows, type Flow } from '../model/flows';
import { Panel } from './Controls';
import { fmtB, pct } from '../format';

/** Spread label centers so they don't overlap: each needs `h` px; keep inside [lo, hi]. */
function spread(centers: number[], h: number[], lo: number, hi: number): number[] {
  const y = [...centers];
  for (let i = 1; i < y.length; i++) y[i] = Math.max(y[i], y[i - 1] + (h[i - 1] + h[i]) / 2);
  const over = y.at(-1)! + h.at(-1)! / 2 - hi;
  if (over > 0) for (let i = y.length - 1; i >= 0; i--) y[i] = Math.min(y[i] - (i === y.length - 1 ? over : 0), i < y.length - 1 ? y[i + 1] - (h[i] + h[i + 1]) / 2 : y[i]);
  if (y[0] - h[0] / 2 < lo) { const s = lo - (y[0] - h[0] / 2); for (let i = 0; i < y.length; i++) y[i] += s; }
  return y;
}

const fill = (slot: string) => (slot === 'borrow' ? 'url(#hatch-borrow)' : `var(--cat-${slot})`);

/** Sankey: money in (left) → the budget (center) → money out (right). */
function Sankey({ inflows, outflows }: { inflows: Flow[]; outflows: Flow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 760, H = 400, PAD = 14, GAP = 6, NODE = 12;
  const xL = 200, xC = 374, xR = 548;
  const total = inflows.reduce((a, f) => a + f.value, 0);
  const avail = (n: number) => H - 2 * PAD - GAP * (n - 1);
  const scale = Math.min(avail(inflows.length), avail(outflows.length)) / total;
  const stack = (fs: Flow[]) => {
    const h = fs.reduce((a, f) => a + f.value * scale, 0) + GAP * (fs.length - 1);
    let y = (H - h) / 2;
    return fs.map((f) => { const r = { f, y0: y, y1: y + f.value * scale }; y = r.y1 + GAP; return r; });
  };
  const left = stack(inflows), right = stack(outflows);
  const cTop = (H - total * scale) / 2;
  const band = (x1: number, a0: number, a1: number, x2: number, b0: number, b1: number) => {
    const m = (x1 + x2) / 2;
    return `M${x1} ${a0} C${m} ${a0} ${m} ${b0} ${x2} ${b0} L${x2} ${b1} C${m} ${b1} ${m} ${a1} ${x1} ${a1} Z`;
  };
  let cIn = cTop, cOut = cTop;
  // Two-line labels for tall nodes, one line ("Name $X") for thin ones; then push apart to avoid overlaps.
  const labels = (rows: typeof left) => {
    const h = rows.map(({ y0, y1 }) => (y1 - y0 >= 30 ? 30 : 15));
    const ys = spread(rows.map(({ y0, y1 }) => (y0 + y1) / 2), h, 2, H - 2);
    return rows.map((r, i) => ({ ...r, ly: ys[i], two: h[i] === 30 }));
  };
  const lText = (f: Flow, x: number, ly: number, two: boolean, anchor: 'start' | 'end') => two ? (
    <>
      <text x={x} y={ly - 2} textAnchor={anchor} className="sk-label">{f.label}</text>
      <text x={x} y={ly + 12} textAnchor={anchor} className="sk-value">{fmtB(f.value)}</text>
    </>
  ) : (
    <text x={x} y={ly + 4} textAnchor={anchor} className="sk-label">{f.label} <tspan className="sk-value">{fmtB(f.value)}</tspan></text>
  );
  const dim = (id: string) => (hover && hover !== id ? 0.15 : 0.45);
  const label = (f: Flow) => `${f.label}: ${fmtB(f.value)} (${pct(f.value / total, 0)})`;

  return (
    <div className="sankey-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} className="sankey" role="img"
        aria-label={`Money in: ${inflows.map(label).join('; ')}. Money out: ${outflows.map(label).join('; ')}.`}>
        <defs>
          <pattern id="hatch-borrow" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--cat-7)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--panel)" strokeWidth="2" />
          </pattern>
        </defs>
        {left.map(({ f, y0, y1 }) => {
          const c0 = cIn; cIn += f.value * scale;
          return (
            <path key={f.id} d={band(xL + NODE, y0, y1, xC, c0, cIn)} fill={fill(f.slot)} opacity={dim(f.id)}
              onPointerEnter={() => setHover(f.id)} onPointerLeave={() => setHover(null)}><title>{label(f)}</title></path>
          );
        })}
        {right.map(({ f, y0, y1 }) => {
          const c0 = cOut; cOut += f.value * scale;
          return (
            <path key={f.id} d={band(xC + NODE, c0, cOut, xR, y0, y1)} fill="var(--series-base)" opacity={dim(f.id)}
              onPointerEnter={() => setHover(f.id)} onPointerLeave={() => setHover(null)}><title>{label(f)}</title></path>
          );
        })}
        <rect x={xC} y={cTop} width={NODE} height={total * scale} rx={3} className="node-center" />
        <text x={xC + NODE / 2} y={cTop - 4} textAnchor="middle" className="sk-label strong">{fmtB(total)}</text>
        {labels(left).map(({ f, y0, y1, ly, two }) => (
          <g key={f.id}>
            <rect x={xL} y={y0} width={NODE} height={Math.max(1, y1 - y0)} rx={3} fill={fill(f.slot)} />
            {lText(f, xL - 8, ly, two, 'end')}
          </g>
        ))}
        {labels(right).map(({ f, y0, y1, ly, two }) => (
          <g key={f.id}>
            <rect x={xR} y={y0} width={NODE} height={Math.max(1, y1 - y0)} rx={3} className="node-out" />
            {lText(f, xR + NODE + 8, ly, two, 'start')}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Donut for part-to-whole (≤ 6 slices) with a labeled legend showing the change vs current law. */
function Donut({ title, slices, total }: { title: string; slices: Flow[]; total: number }) {
  const R = 70, r = 46, C = 90;
  let a = -Math.PI / 2;
  const arc = (v: number) => {
    const a0 = a, a1 = a + (v / total) * Math.PI * 2; a = a1;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, t: number) => `${C + rad * Math.cos(t)} ${C + rad * Math.sin(t)}`;
    return `M${p(R, a0)} A${R} ${R} 0 ${big} 1 ${p(R, a1)} L${p(r, a1)} A${r} ${r} 0 ${big} 0 ${p(r, a0)} Z`;
  };
  return (
    <figure className="donut">
      <figcaption>{title}</figcaption>
      <div className="donut-body">
        <svg viewBox="0 0 180 180" role="img" aria-label={`${title}: ${slices.map((s) => `${s.label} ${pct(s.value / total, 0)}`).join(', ')}`}>
          {slices.filter((s) => s.value > 0).map((s) => <path key={s.id} d={arc(s.value)} fill={fill(s.slot)} className="slice"><title>{`${s.label}: ${fmtB(s.value)}`}</title></path>)}
          <text x={C} y={C - 2} textAnchor="middle" className="donut-total">{fmtB(total)}</text>
          <text x={C} y={C + 14} textAnchor="middle" className="donut-sub">total</text>
        </svg>
        <ul className="donut-legend">
          {slices.map((s) => {
            const d = s.value - s.base;
            return (
              <li key={s.id}>
                <i className="sw-box" style={{ background: s.slot === 'borrow' ? undefined : fill(s.slot) }} data-hatch={s.slot === 'borrow' || undefined} />
                <span>{s.label}</span>
                <span className="num">{pct(s.value / total, 0)}</span>
                <span className="num muted">{fmtB(s.value)}{Math.abs(d) >= 0.5 && <em className={d > 0 ? 'up' : 'down'}> {d > 0 ? '▲' : '▼'}{fmtB(Math.abs(d))}</em>}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </figure>
  );
}

export function MoneyFlow() {
  const { budget } = useResults();
  const f = budgetFlows(budget);
  const [ind, pay, corp, trade, other] = f.revenue;
  const funding: Flow[] = [ind, pay, ...(f.borrowing > 0 ? [{ id: 'borrowing', label: 'Borrowing', value: f.borrowing, base: f.baseBorrowing, slot: 'borrow' }] : []), corp, trade, other];
  const sum = (xs: Flow[]) => xs.reduce((a, x) => a + x.value, 0);
  const policyNet = budget.policyLines.reduce((a, p) => a + p.value, 0);
  return (
    <Panel title="Where the money goes" className="moneyflow" right={<span className="hint">This year, your plan</span>}>
      <Sankey inflows={f.inflows} outflows={f.outflows} />
      <div className="donuts">
        <Donut title="How it's paid for" slices={funding} total={sum(funding)} />
        <Donut title="What it's spent on" slices={f.spending} total={sum(f.spending)} />
      </div>
      <p className="hint">▲▼ = change vs current law.{Math.abs(policyNet) >= 0.5 && <> Policy-switch lump sums ({fmtB(policyNet, true)}) appear in the flow diagram but not the donuts.</>} Hover a band for its value.</p>
    </Panel>
  );
}
