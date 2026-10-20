import { useRef, useState } from 'react';
import { useStore, BASE } from '../state/store';
import { thresholds } from '../model/scenario';
import { fmtK, pct } from '../format';
import { NumInput } from './Controls';

const W = 720, H = 300;
const PAD = { l: 44, r: 14, t: 16, b: 30 };
const XMIN = 1e3, XMAX = 1e7;
const YMAX = 0.8;

const X = (v: number) => PAD.l + ((Math.log10(Math.max(v, XMIN)) - 3) / 4) * (W - PAD.l - PAD.r);
const Xinv = (px: number) => Math.pow(10, 3 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * 4);
const Y = (r: number) => H - PAD.b - (r / YMAX) * (H - PAD.t - PAD.b);
const Yinv = (py: number) => ((H - PAD.b - py) / (H - PAD.t - PAD.b)) * YMAX;

/** Round to 3 significant figures so dragged thresholds stay readable. */
const nice = (v: number) => {
  const m = Math.pow(10, Math.floor(Math.log10(v)) - 2);
  return Math.round(v / m) * m;
};

type Drag = { kind: 'rate' | 'th'; i: number } | null;

export function BracketEditor() {
  const scn = useStore((s) => s.scn);
  const set = useStore((s) => s.set);
  const [filing, setFiling] = useState<'single' | 'mfj'>('single');
  const [drag, setDrag] = useState<Drag>(null);
  const svg = useRef<SVGSVGElement>(null);

  const b = scn.brackets;
  const th = thresholds(b, filing);
  const baseTh = thresholds(BASE.brackets, filing);
  const ratio = (i: number) => (filing === 'single' ? 1 : b.mfjRatio[i]);

  const toSvg = (e: React.PointerEvent) => {
    const pt = svg.current!.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.current!.getScreenCTM()!.inverse());
  };

  const setThreshold = (i: number, shown: number) => set((s) => {
    const t = thresholds(s.brackets, filing);
    const lo = t[i - 1] * 1.02 + 100, hi = i + 1 < t.length ? t[i + 1] / 1.02 - 100 : XMAX;
    s.brackets.single[i] = Math.round(nice(Math.min(hi, Math.max(lo, shown))) / ratio(i));
  });
  const setRate = (i: number, r: number) => set((s) => {
    s.brackets.rates[i] = Math.round(Math.min(0.99, Math.max(0, r)) * 1000) / 1000;
  });

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = toSvg(e);
    if (drag.kind === 'rate') setRate(drag.i, Math.round(Yinv(p.y) * 200) / 200);
    else setThreshold(drag.i, Xinv(p.x));
  };
  const start = (d: Drag) => (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag(d);
  };

  const addBracket = () => set((s) => {
    const n = s.brackets.rates.length;
    s.brackets.single.push(Math.round(nice(s.brackets.single[n - 1] * 2)));
    s.brackets.rates.push(Math.min(0.9, s.brackets.rates[n - 1] + 0.03));
    s.brackets.mfjRatio.push(s.brackets.mfjRatio[n - 1]);
  });
  const removeBracket = (i: number) => set((s) => {
    for (const k of ['single', 'rates', 'mfjRatio'] as const) s.brackets[k].splice(i, 1);
  });

  const step = (ts: number[], rs: number[]) =>
    rs.map((r, i) => `${i === 0 ? 'M' : 'L'}${X(ts[i])} ${Y(r)} L${X(ts[i + 1] ?? XMAX)} ${Y(r)}`).join(' ');

  return (
    <div className="bracket-editor">
      <div className="seg" role="tablist">
        {(['single', 'mfj'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filing === f} className={filing === f ? 'active' : ''} onClick={() => setFiling(f)}>
            {f === 'single' ? 'Single' : 'Married filing jointly'}
          </button>
        ))}
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="be-svg" onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
        {[0, 0.2, 0.4, 0.6, 0.8].map((r) => (
          <g key={r}><line x1={PAD.l} x2={W - PAD.r} y1={Y(r)} y2={Y(r)} className="grid" /><text x={PAD.l - 6} y={Y(r) + 4} className="axis" textAnchor="end">{pct(r, 0)}</text></g>
        ))}
        {[1e3, 1e4, 1e5, 1e6, 1e7].map((v) => (
          <text key={v} x={X(v)} y={H - 10} className="axis" textAnchor="middle">{fmtK(v)}</text>
        ))}
        <path d={step(baseTh, BASE.brackets.rates)} className="be-base" />
        <path d={`${step(th, b.rates)} L${X(XMAX)} ${Y(0)} L${X(XMIN)} ${Y(0)} Z`} className="be-fill" />
        {b.rates.map((r, i) => {
          const x1 = X(th[i]), x2 = X(th[i + 1] ?? XMAX);
          return (
            <g key={`r${i}`}>
              <line x1={x1} x2={x2} y1={Y(r)} y2={Y(r)} className="be-rate" />
              <line x1={x1} x2={x2} y1={Y(r)} y2={Y(r)} className="be-hit ns" onPointerDown={start({ kind: 'rate', i })}>
                <title>Drag up/down to change the {pct(r)} rate</title>
              </line>
              {x2 - x1 > 30 && <text x={(x1 + x2) / 2} y={Y(r) - 7} className="be-label" textAnchor="middle">{pct(r, Math.round(r * 1000) % 10 ? 1 : 0)}</text>}
            </g>
          );
        })}
        {th.map((t, i) => i > 0 && (
          <g key={`t${i}`}>
            <line x1={X(t)} x2={X(t)} y1={Y(b.rates[i - 1])} y2={Y(b.rates[i])} className="be-rate" />
            <line x1={X(t)} x2={X(t)} y1={PAD.t} y2={H - PAD.b} className="be-hit ew" onPointerDown={start({ kind: 'th', i })}>
              <title>Drag left/right to move the bracket starting at {fmtK(t)}</title>
            </line>
            <circle cx={X(t)} cy={(Y(b.rates[i - 1]) + Y(b.rates[i])) / 2} r={6} className="be-knob" />
          </g>
        ))}
      </svg>
      <p className="hint">Drag the flat parts up or down to set a bracket's rate. Drag the round knobs left or right to move where a bracket starts. Dashed line = current law. X-axis = taxable income (log scale).</p>
      <table className="be-table">
        <thead><tr><th>Taxable income from</th><th>Rate</th><th /></tr></thead>
        <tbody>
          {b.rates.map((r, i) => (
            <tr key={i}>
              <td>{i === 0 ? '$0' : (
                <NumInput step={1000} value={th[i]} aria-label={`Bracket ${i + 1} threshold`} onCommit={(v) => setThreshold(i, v)} />
              )}</td>
              <td><NumInput step={0.5} min={0} max={99} value={+(r * 100).toFixed(1)} aria-label={`Bracket ${i + 1} rate`} onCommit={(v) => setRate(i, v / 100)} />%</td>
              <td>{i > 0 && <button className="icon" onClick={() => removeBracket(i)} aria-label="Remove bracket">✕</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" onClick={addBracket}>+ Add top bracket</button>
    </div>
  );
}
