import { useStore, BASE } from '../state/store';
import { useResults } from '../state/results';
import { BracketEditor } from './BracketEditor';
import { Panel, Slider, Toggle } from './Controls';
import { fmtB, fmtK, pct } from '../format';

const CAP_STEPS = [...Array.from({ length: 91 }, (_, i) => 100000 + i * 10000), null];
const capIndex = (c: number | null) => (c === null ? CAP_STEPS.length - 1 : CAP_STEPS.findIndex((x) => x !== null && x >= c));
const BASE_CAP_IDX = capIndex(BASE.ssWageBase);

export function TaxPanel() {
  const { scn, budget } = useResults();
  const set = useStore((s) => s.set);
  const rec = (id: string) => budget.receipts.find((r) => r.id === id)!;
  const delta = (id: string) => {
    const r = rec(id);
    const d = r.value - r.base;
    return <span className={`delta ${d > 0.5 ? 'pos' : d < -0.5 ? 'neg' : ''}`}>{fmtB(r.value)} ({fmtB(d, true)})</span>;
  };

  return (
    <Panel title="Taxes" className="taxes" right={<span className="panel-total">{fmtB(budget.totalReceipts)} revenue</span>}>
      <h3>Individual income tax brackets {delta('individualOrdinary')}</h3>
      <BracketEditor />

      <h3>Investment income {delta('capitalGains')}</h3>
      <Slider label="Top capital gains & dividend rate" value={scn.capGainsTopRate} base={BASE.capGainsTopRate}
        min={0} max={0.5} step={0.005} format={(v) => pct(v)} onChange={(v) => set((s) => { s.capGainsTopRate = v; })}
        hint="Plus the 3.8% net investment income tax" />

      <h3>Payroll taxes {delta('payrollSS')}</h3>
      <Slider label="Social Security tax rate (employer + employee)" value={scn.ssRate} base={BASE.ssRate}
        min={0} max={0.2} step={0.001} format={(v) => pct(v)} onChange={(v) => set((s) => { s.ssRate = v; })} />
      <Slider label="Social Security wage cap" value={capIndex(scn.ssWageBase)} base={BASE_CAP_IDX}
        min={0} max={CAP_STEPS.length - 1} step={1}
        format={(i) => (i === BASE_CAP_IDX ? fmtK(BASE.ssWageBase!) : CAP_STEPS[i] === null ? 'No cap' : fmtK(CAP_STEPS[i]!))}
        onChange={(i) => set((s) => { s.ssWageBase = i === BASE_CAP_IDX ? BASE.ssWageBase : CAP_STEPS[i]; })} />
      <Slider label={<>Medicare tax rate {delta('payrollHI')}</>} value={scn.hiRate} base={BASE.hiRate}
        min={0} max={0.08} step={0.001} format={(v) => pct(v)} onChange={(v) => set((s) => { s.hiRate = v; })} />

      <h3>Business & estates</h3>
      <Slider label={<>Corporate tax rate {delta('corporate')}</>} value={scn.corporateRate} base={BASE.corporateRate}
        min={0} max={0.45} step={0.005} format={(v) => pct(v)} onChange={(v) => set((s) => { s.corporateRate = v; })} />
      <Slider label={<>Estate tax rate {delta('estate')}</>} value={scn.estateRate} base={BASE.estateRate}
        min={0} max={0.8} step={0.01} format={(v) => pct(v, 0)} onChange={(v) => set((s) => { s.estateRate = v; })} />
      <Slider label="Estate tax exemption" value={scn.estateExemption} base={BASE.estateExemption}
        min={1e6} max={3e7} step={5e5} format={fmtK} onChange={(v) => set((s) => { s.estateExemption = v; })} />

      <Toggle label="Include behavioral responses" checked={scn.behavioral} onChange={(v) => set((s) => { s.behavioral = v; })}
        aside={<span className="hint">People and companies report less income when rates rise. Taxable income elasticity 0.25, capital gains 0.7, corporate 0.2.</span>} />
    </Panel>
  );
}
