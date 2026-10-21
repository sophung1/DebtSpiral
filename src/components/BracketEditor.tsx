import { useRef, useState } from 'react';
import { useStore, BASE } from '../state/store';
import { thresholds, enforceProgressive } from '../model/scenario';
import { fmtK, pct } from '../format';
import { NumInput, Toggle } from './Controls';

const YMAX = 0.8, XMAX = 1e8;

/** Round to 3 significant figures so dragged thresholds stay readable. */
const nice = (v: number) => {
  const m = Math.pow(10, Math.floor(Math.log10(v)) - 2);
  return Math.round(v / m) * m;
};
/** 3 significant figures so seven labels fit on a phone: $12.4k, $202k, $1.2M. */
const short = (v: number) => (v >= 1e6 ? `$${+(v / 1e6).toPrecision(2)}M` : v >= 1e3 ? `$${+(v / 1e3).toPrecision(3)}k` : `$${v}`);
const rateLabel = (r: number) => pct(r, Math.round(r * 1000) % 10 ? 1 : 0);

/** Equalizer-style editor: one column per bracket, drag a bar for its rate, drag a divider to move a threshold. */
export function BracketEditor() {
  const scn = useStore((s) => s.scn);
  const set = useStore((s) => s.set);
  const [filing, setFiling] = useState<'single' | 'mfj'>('single');
  const [progressive, setProgressive] = useState(true);
  // Rates when a bar drag began, so pushes are measured from there and undo themselves as you drag back.
  const start = useRef<number[] | null>(null);
  const [drag, setDrag] = useState<{ i: number; x: number; t: number; w: number } | null>(null);

  const b = scn.brackets, n = b.rates.length;
  const th = thresholds(b, filing);
  const ratio = (i: number) => (filing === 'single' ? 1 : b.mfjRatio[i]);

  const setThreshold = (i: number, shown: number) => set((s) => {
    const t = thresholds(s.brackets, filing);
    const lo = t[i - 1] * 1.02 + 100, hi = i + 1 < t.length ? t[i + 1] / 1.02 - 100 : XMAX;
    s.brackets.single[i] = Math.round(nice(Math.min(hi, Math.max(lo, shown))) / ratio(i));
  });
  const setRate = (i: number, r: number) => set((s) => {
    const rates = [...(start.current ?? s.brackets.rates)];
    rates[i] = Math.round(Math.min(0.99, Math.max(0, r)) * 1000) / 1000;
    s.brackets.rates = progressive ? enforceProgressive(rates, i) : rates;
  });

  const rateAt = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.round(((r.bottom - e.clientY) / r.height) * YMAX * 200) / 200;
  };
  const barDown = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = [...b.rates];
    setRate(i, rateAt(e));
  };
  const barMove = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) setRate(i, rateAt(e));
  };
  const barKey = (i: number) => (e: React.KeyboardEvent) => {
    const d = { ArrowUp: 0.005, ArrowRight: 0.005, ArrowDown: -0.005, ArrowLeft: -0.005, PageUp: 0.05, PageDown: -0.05 }[e.key];
    if (d) { e.preventDefault(); setRate(i, b.rates[i] + d); }
  };
  // Dragging a divider one column-width to the right multiplies the threshold by 10 (log scale).
  const divDown = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ i, x: e.clientX, t: th[i], w: e.currentTarget.parentElement!.getBoundingClientRect().width / n });
  };
  const divMove = (e: React.PointerEvent) => {
    if (drag) setThreshold(drag.i, drag.t * Math.pow(10, (e.clientX - drag.x) / drag.w));
  };
  const divKey = (i: number) => (e: React.KeyboardEvent) => {
    const f = { ArrowRight: 1.05, ArrowUp: 1.05, ArrowLeft: 1 / 1.05, ArrowDown: 1 / 1.05 }[e.key];
    if (f) { e.preventDefault(); setThreshold(i, th[i] * f); }
  };

  const addBracket = () => set((s) => {
    const k = s.brackets.rates.length;
    s.brackets.single.push(Math.round(nice(s.brackets.single[k - 1] * 2)));
    s.brackets.rates.push(Math.min(0.9, s.brackets.rates[k - 1] + 0.03));
    s.brackets.mfjRatio.push(s.brackets.mfjRatio[k - 1]);
  });
  const removeBracket = (i: number) => set((s) => {
    for (const k of ['single', 'rates', 'mfjRatio'] as const) s.brackets[k].splice(i, 1);
  });

  return (
    <div className="bracket-editor">
      <div className="eq-head">
        <div className="seg" role="tablist">
          {(['single', 'mfj'] as const).map((f) => (
            <button key={f} role="tab" aria-selected={filing === f} className={filing === f ? 'active' : ''} onClick={() => setFiling(f)}>
              {f === 'single' ? 'Single' : 'Married filing jointly'}
            </button>
          ))}
        </div>
        <Toggle label="Keep rates progressive" checked={progressive} onChange={setProgressive} />
      </div>
      <div className="eq">
        <div className="eq-plot">
          {[0, 0.2, 0.4, 0.6, 0.8].map((r) => (
            <div key={r} className="eq-grid" style={{ bottom: `${(r / YMAX) * 100}%` }}><span>{pct(r, 0)}</span></div>
          ))}
          {b.rates.map((r, i) => {
            const base = BASE.brackets.rates[i];
            return (
              <div key={i} className={`eq-track ${base !== undefined && Math.abs(r - base) > 1e-9 ? 'changed' : ''}`} role="slider" tabIndex={0}
                aria-label={`Bracket ${i + 1} rate (income from ${fmtK(th[i])})`} aria-valuemin={0} aria-valuemax={99} aria-valuenow={+(r * 100).toFixed(1)} aria-valuetext={rateLabel(r)}
                onPointerDown={barDown(i)} onPointerMove={barMove(i)} onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }} onKeyDown={barKey(i)}>
                {base !== undefined && <div className="eq-base" style={{ height: `${(Math.min(base, YMAX) / YMAX) * 100}%` }} title={`Current law: ${rateLabel(base)}`} />}
                <div className="eq-bar" style={{ height: `${(Math.min(r, YMAX) / YMAX) * 100}%` }}><span>{rateLabel(r)}</span></div>
              </div>
            );
          })}
          {th.map((t, i) => i > 0 && (
            <button key={i} className="eq-div" style={{ left: `${(i / n) * 100}%` }}
              aria-label={`Bracket ${i + 1} starts at ${fmtK(t)}; arrow keys move it`}
              onPointerDown={divDown(i)} onPointerMove={divMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)} onKeyDown={divKey(i)} />
          ))}
        </div>
        <div className="eq-ranges">
          {th.map((t, i) => <span key={i} title={fmtK(t)}>{short(t)}{i + 1 === n && '+'}</span>)}
        </div>
      </div>
      <p className="hint">Labels under the bars are where each bracket starts (taxable income). Drag a bar up or down to set that bracket's rate. Drag the handles between bars left or right to move where a bracket starts. The outline behind each bar is current law. {progressive ? 'Progressive is on: raising a bracket lifts the ones above it, lowering one drops the ones below.' : 'Progressive is off: any bracket can have any rate.'}</p>
      <details className="be-exact">
        <summary>Exact values</summary>
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
      </details>
    </div>
  );
}
