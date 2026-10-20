import type { ReactNode } from 'react';
import { useStore, BASE } from '../state/store';
import { useResults } from '../state/results';
import { programs, policies, live, manual } from '../model/data';
import { BUCKETS, bucketDelta, ssCashFlow } from '../model/buckets';
import { setPolicy } from '../model/scenario';
import { BracketEditor } from './BracketEditor';
import { Panel, Slider, Toggle } from './Controls';
import { fmtB, fmt$, fmtK, pct } from '../format';

const CAP_STEPS = [...Array.from({ length: 91 }, (_, i) => 100000 + i * 10000), null];
const capIndex = (c: number | null) => (c === null ? CAP_STEPS.length - 1 : CAP_STEPS.findIndex((x) => x !== null && x >= c));
const BASE_CAP_IDX = capIndex(BASE.ssWageBase);

function Bucket({ id, children, className = '' }: { id: string; children: ReactNode; className?: string }) {
  const { budget, scn } = useResults();
  const def = BUCKETS.find((b) => b.id === id)!;
  const d = bucketDelta(budget, scn, def);
  const badge = Math.abs(d) < 0.5
    ? <span className="panel-total muted">no change</span>
    : <span className={`panel-total ${d < 0 ? 'pos' : 'neg'}`}>{d < 0 ? 'saves' : 'adds'} {fmtB(Math.abs(d))}</span>;
  return <Panel title={def.title} right={badge} className={`bucket bucket-${id} ${className}`}>{children}</Panel>;
}

/** Shows a revenue line's current value and its change from current law. */
function RevDelta({ id }: { id: string }) {
  const { budget } = useResults();
  const r = budget.receipts.find((x) => x.id === id)!;
  const d = r.value - r.base;
  return <span className={`delta ${d > 0.5 ? 'pos' : d < -0.5 ? 'neg' : ''}`}>{fmtB(r.value)}{Math.abs(d) >= 0.5 && ` (${fmtB(d, true)})`}</span>;
}

function ProgramSlider({ id }: { id: string }) {
  const { scn, budget, households } = useResults();
  const set = useStore((s) => s.set);
  const p = programs.find((x) => x.id === id)!;
  const line = budget.outlays.find((o) => o.id === id)!;
  const who = households.filter((h) => (h.base.benefits[id] ?? 0) > 0 || (h.now.benefits[id] ?? 0) > 0);
  return (
    <div className="program">
      <Slider label={<>{p.name} <span className={`delta ${line.value < line.base - 0.5 ? 'pos' : line.value > line.base + 0.5 ? 'neg' : ''}`}>{fmtB(line.value)}</span></>}
        value={scn.programs[id]} base={1} min={0} max={2} step={0.01}
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
}

function PolicyList({ bucket }: { bucket: string }) {
  const on = useStore((s) => s.scn.policies);
  const set = useStore((s) => s.set);
  const list = policies.filter((p) => p.bucket === bucket);
  if (!list.length) return null;
  const replacedBy = (id: string) => policies.find((q) => on[q.id] && q.replaces?.includes(id));
  return (
    <div className="policy-list">
      <h3>Policy switches</h3>
      {list.map((p) => {
        const by = replacedBy(p.id);
        return (
          <Toggle key={p.id} checked={!!on[p.id] || !!by} disabled={!!by} onChange={(v) => set((s) => setPolicy(s, p.id, v))}
            label={<span title={p.source}>{p.label}{by && <em className="hint"> (included in the rollback)</em>}</span>}
            aside={<span className={`delta ${p.deltaB > 0 ? 'pos' : 'neg'}`}>{fmtB(p.deltaB, true)}/yr</span>} />
        );
      })}
    </div>
  );
}

function IncomeTax() {
  const { scn } = useResults();
  const set = useStore((s) => s.set);
  return (
    <Bucket id="income_tax" className="wide">
      <div className="split">
        <div>
          <h3>Brackets <RevDelta id="individualOrdinary" /></h3>
          <BracketEditor />
        </div>
        <div>
          <h3>Investment income <RevDelta id="capitalGains" /></h3>
          <Slider label="Top capital gains & dividend rate" value={scn.capGainsTopRate} base={BASE.capGainsTopRate}
            min={0} max={0.5} step={0.005} format={(v) => pct(v)} onChange={(v) => set((s) => { s.capGainsTopRate = v; })}
            hint="Plus the 3.8% net investment income tax" />
          <Toggle label="Include behavioral responses" checked={scn.behavioral} onChange={(v) => set((s) => { s.behavioral = v; })}
            aside={<span className="hint">People and companies report less income when rates rise. Applies to all taxes. Taxable income elasticity 0.25, capital gains 0.7, corporate 0.2.</span>} />
          <PolicyList bucket="income_tax" />
        </div>
      </div>
    </Bucket>
  );
}

function SocialSecurity() {
  const { scn, budget } = useResults();
  const set = useStore((s) => s.set);
  const ss = ssCashFlow(budget, scn);
  return (
    <Bucket id="social_security">
      <div className="ledger" aria-label="Social Security cash flow">
        <div><span>Payroll tax in</span><strong>{fmtB(ss.inflow)}</strong></div>
        <div><span>Benefits out</span><strong>{fmtB(ss.outflow)}</strong></div>
        <div className={ss.balance >= 0 ? 'pos' : 'neg'}><span>{ss.balance >= 0 ? 'Surplus' : 'Shortfall'}</span><strong>{fmtB(Math.abs(ss.balance))}</strong></div>
      </div>
      <p className="hint">Social Security is legally "off-budget" and paid from its own trust funds. This excludes the income tax on benefits and trust-fund interest.</p>
      <h3>Money in</h3>
      <Slider label="Payroll tax rate (employer + employee)" value={scn.ssRate} base={BASE.ssRate}
        min={0} max={0.2} step={0.001} format={(v) => pct(v)} onChange={(v) => set((s) => { s.ssRate = v; })} />
      <Slider label="Wage cap" value={capIndex(scn.ssWageBase)} base={BASE_CAP_IDX}
        min={0} max={CAP_STEPS.length - 1} step={1}
        format={(i) => (i === BASE_CAP_IDX ? fmtK(BASE.ssWageBase!) : CAP_STEPS[i] === null ? 'No cap' : fmtK(CAP_STEPS[i]!))}
        onChange={(i) => set((s) => { s.ssWageBase = i === BASE_CAP_IDX ? BASE.ssWageBase : CAP_STEPS[i]; })} />
      <h3>Money out</h3>
      <ProgramSlider id="social_security" />
      <PolicyList bucket="social_security" />
    </Bucket>
  );
}

function Health() {
  const { scn } = useResults();
  const set = useStore((s) => s.set);
  return (
    <Bucket id="health">
      <Slider label={<>Medicare payroll tax rate <RevDelta id="payrollHI" /></>} value={scn.hiRate} base={BASE.hiRate}
        min={0} max={0.08} step={0.001} format={(v) => pct(v)} onChange={(v) => set((s) => { s.hiRate = v; })} />
      {['medicare', 'medicaid', 'aca'].map((id) => <ProgramSlider key={id} id={id} />)}
      <PolicyList bucket="health" />
    </Bucket>
  );
}

function SafetyNet() {
  return (
    <Bucket id="safety_net">
      {['snap', 'eitc', 'ctc', 'ssi', 'unemployment'].map((id) => <ProgramSlider key={id} id={id} />)}
      <PolicyList bucket="safety_net" />
    </Bucket>
  );
}

function DefenseOther() {
  return (
    <Bucket id="defense_other">
      {['defense', 'nondefense', 'veterans', 'fed_retirement', 'other_mandatory'].map((id) => <ProgramSlider key={id} id={id} />)}
      <PolicyList bucket="defense_other" />
    </Bucket>
  );
}

function Business() {
  const { scn } = useResults();
  const set = useStore((s) => s.set);
  return (
    <Bucket id="business">
      <Slider label={<>Corporate tax rate <RevDelta id="corporate" /></>} value={scn.corporateRate} base={BASE.corporateRate}
        min={0} max={0.45} step={0.005} format={(v) => pct(v)} onChange={(v) => set((s) => { s.corporateRate = v; })} />
      <Slider label={<>Estate tax rate <RevDelta id="estate" /></>} value={scn.estateRate} base={BASE.estateRate}
        min={0} max={0.8} step={0.01} format={(v) => pct(v, 0)} onChange={(v) => set((s) => { s.estateRate = v; })} />
      <Slider label="Estate tax exemption" value={scn.estateExemption} base={BASE.estateExemption}
        min={1e6} max={3e7} step={5e5} format={fmtK} onChange={(v) => set((s) => { s.estateExemption = v; })} />
      <p className="hint">Customs <RevDelta id="customs" /> · Excise <RevDelta id="excise" /></p>
      <PolicyList bucket="business" />
    </Bucket>
  );
}

function Interest() {
  const { scn, budget } = useResults();
  const set = useStore((s) => s.set);
  return (
    <Bucket id="interest">
      <p className="ledger-one"><span>Net interest</span><strong>{fmtB(budget.netInterest)}</strong></p>
      <Slider label="Change in market interest rates" value={scn.rateShock} base={BASE.rateShock}
        min={-0.03} max={0.05} step={0.0025} format={(v) => `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(2)} pts`}
        onChange={(v) => set((s) => { s.rateShock = v; })}
        hint={<>10-yr Treasury yield {pct(live.yield10y.value, 2)}, average rate on all debt {pct(live.avgInterestRate.value, 2)}. In year 1 only about {pct(manual.rateRepricingShareYear1, 0)} of the debt reprices (new borrowing and rollovers).</>} />
    </Bucket>
  );
}

export function Buckets() {
  return (
    <div className="buckets">
      <IncomeTax />
      <SocialSecurity />
      <Health />
      <SafetyNet />
      <DefenseOther />
      <Business />
      <Interest />
    </div>
  );
}
