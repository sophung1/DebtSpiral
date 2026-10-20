import { useStore, BASE } from '../state/store';
import { useResults } from '../state/results';
import { programs, live, manual } from '../model/data';
import { Panel, Slider } from './Controls';
import { fmtB, fmt$, pct } from '../format';

export function SpendingPanel() {
  const { scn, budget, households } = useResults();
  const set = useStore((s) => s.set);
  const groups = [
    ['Social insurance & health', ['social_security', 'medicare', 'medicaid', 'aca']],
    ['Safety net & tax credits', ['snap', 'eitc', 'ctc', 'ssi', 'unemployment']],
    ['Other mandatory', ['veterans', 'fed_retirement', 'other_mandatory']],
    ['Discretionary (annual appropriations)', ['defense', 'nondefense']],
  ] as const;

  return (
    <Panel title="Spending" className="spending" right={<span className="panel-total">{fmtB(budget.totalOutlays)} outlays</span>}>
      {groups.map(([g, ids]) => (
        <div key={g}>
          <h3>{g}</h3>
          {ids.map((id) => {
            const p = programs.find((x) => x.id === id)!;
            const line = budget.outlays.find((o) => o.id === id)!;
            const f = scn.programs[id];
            const who = households.filter((h) => (h.base.benefits[id] ?? 0) > 0 || (h.now.benefits[id] ?? 0) > 0);
            return (
              <div key={id} className="program">
                <Slider label={<>{p.name} <span className={`delta ${line.value < line.base - 0.5 ? 'pos' : line.value > line.base + 0.5 ? 'neg' : ''}`}>{fmtB(line.value)}</span></>}
                  value={f} base={1} min={0} max={2} step={0.01}
                  format={(v) => (v === 1 ? 'current law' : `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}% benefits`)}
                  onChange={(v) => set((s) => { s.programs[id] = v; })} />
                {who.length > 0 && (
                  <ul className="per-hh">
                    {who.map(({ a, base, now }) => {
                      const b0 = base.benefits[id] ?? 0, b1 = now.benefits[id] ?? 0;
                      return (
                        <li key={a.id}>
                          <span>{a.icon} {a.name}</span>
                          <span>{fmt$(b1)}/yr{Math.abs(b1 - b0) >= 1 && <em className={b1 > b0 ? 'pos' : 'neg'}> ({fmt$(b1 - b0, true)})</em>}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <h3>Interest on the debt <span className="delta">{fmtB(budget.netInterest)}</span></h3>
      <Slider label="Change in market interest rates" value={scn.rateShock} base={BASE.rateShock}
        min={-0.03} max={0.05} step={0.0025} format={(v) => `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(2)} pts`}
        onChange={(v) => set((s) => { s.rateShock = v; })}
        hint={<>10-yr Treasury yield {pct(live.yield10y.value, 2)}, average rate on all debt {pct(live.avgInterestRate.value, 2)}. In year 1 only about {pct(manual.rateRepricingShareYear1, 0)} of the debt reprices (new borrowing and rollovers).</>} />
    </Panel>
  );
}
