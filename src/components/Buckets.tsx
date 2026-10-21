import type { ReactNode } from 'react';
import { useStore, BASE } from '../state/store';
import { useResults } from '../state/results';
import { programs, policies, live, manual } from '../model/data';
import { BUCKETS, bucketDelta, ssCashFlow } from '../model/buckets';
import { baselineInflation } from '../model/budget';
import { setPolicy } from '../model/scenario';
import { polls } from '../model/popularity';
import { BracketEditor } from './BracketEditor';
import { YieldCurve } from './YieldCurve';
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
  return <Panel id={id} title={def.title} right={badge} className={`bucket bucket-${id} ${className}`}>{children}</Panel>;
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
        value={scn.programs[id]} base={1} min={0} max={Math.max(2, Math.ceil(scn.programs[id]))} step={0.01}
        format={(v) => (v === 1 ? 'current law' : `${v > 1 ? '+' : '−'}${Math.round(Math.abs(v - 1) * 100)}% benefits`)}
        onChange={(v) => set((s) => { s.programs[id] = v; })}
        hint={(() => { const f = scn.programs[id]; const pl = f === 1 ? null : polls[`program:${id}:${f > 1 ? 'up' : 'down'}`]; return pl ? <span title={pl.source}>{pl.support}% support this ({pl.source})</span> : undefined; })()} />
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
            label={<span title={p.source}>{p.label}{p.who && <em className="who"> — {p.who}</em>}{p.oneTime && <em className="tag">one-time</em>}{by && <em className="hint"> (included in the Big Beautiful Bill rollback, under Headline proposals)</em>}</span>}
            aside={<span className="aside-stack">{p.deltaB !== 0 && <span className={`delta ${p.deltaB > 0 ? 'pos' : 'neg'}`}>{fmtB(p.deltaB, true)}/yr</span>}{p.setsSliders && <span className="support">moves the sliders</span>}{polls[p.id] && <span className="support" title={`${polls[p.id].label}: ${polls[p.id].source}${polls[p.id].note ? `. ${polls[p.id].note}` : ''}`}>{polls[p.id].support}% support</span>}</span>} />
        );
      })}
    </div>
  );
}

function IncomeTax() {
  const { scn, behavioralEffect } = useResults();
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
            aside={<span className="hint">
              <strong className={Math.abs(behavioralEffect) < 0.5 ? '' : behavioralEffect > 0 ? 'neg' : 'pos'}>
                {Math.abs(behavioralEffect) < 0.5 ? 'No effect at current-law tax rates.' : `${behavioralEffect > 0 ? 'Costs' : 'Saves'} ${fmtB(Math.abs(behavioralEffect))} at your rates${scn.behavioral ? '' : ' (if turned on)'}.`}
              </strong>{' '}
              People and companies report less income when rates rise (and more when they fall). It only matters once you change a tax rate. Applies to all taxes. Taxable income elasticity 0.25, capital gains 0.7, corporate 0.2.</span>} />
          <p className="hint">Taxes on the very rich come in layers, and you can pick one in each: a wealth tax, a minimum tax on top incomes, and taxing gains at death. Their estimates each assume the others don't exist.</p>
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

const pts = (v: number) => `${v >= 0 ? '+' : '−'}${(Math.abs(v) * 100).toFixed(2)} pts`;

function DebtInflation() {
  const { scn, budget, outcomes: o } = useResults();
  const set = useStore((s) => s.set);
  const debt = live.debtHeldByPublicB.value;
  const baseInfl = baselineInflation;
  return (
    <Bucket id="debt">
      <div className="ledger">
        <div><span>Net interest</span><strong>{fmtB(budget.netInterest)}</strong></div>
        <div><span>Debt held by public</span><strong>{fmtB(debt)}</strong></div>
        <div className={o.inflationToHoldRatio <= 0 ? 'pos' : 'neg'}><span>Inflation to stand still</span><strong>{o.inflationToHoldRatio <= 0 ? 'none' : `${pct(baselineInflation + budget.inflationShock + o.inflationToHoldRatio)}/yr (+${pct(o.inflationToHoldRatio)} over now)`}</strong></div>
        <div className={budget.inflationShock > 0.0005 ? 'neg' : ''}><span>Inflation this year</span><strong>{pct(baseInfl + budget.inflationShock, 1)}{Math.abs(budget.policyInflation + budget.priceBump) >= 0.0005 && <small> ({budget.policyInflation + budget.priceBump > 0 ? '+' : '−'}{pct(Math.abs(budget.policyInflation + budget.priceBump), 1)} from your plan{budget.priceBump ? `, incl. ${pct(budget.priceBump, 1)} tariff price jump` : ''})</small>}</strong></div>
        <div className={budget.premium > 0.00005 ? 'neg' : budget.premium < -0.00005 ? 'pos' : ''}><span>Market risk premium</span><strong>{Math.abs(budget.premium) < 0.00005 ? 'none' : `${budget.premium > 0 ? '+' : '−'}${Math.round(Math.abs(budget.premium) * 1e4)} bp on long yields`}</strong></div>
      </div>
      <YieldCurve plan={budget.yields} />
      <p className="hint">Yields: 2-yr {pct(live.yield2y.value, 2)} · 10-yr {pct(live.yield10y.value, 2)} · 30-yr {pct(live.yield30y.value, 2)} · average on all debt {pct(live.avgInterestRate.value, 2)}</p>
      <div className="debt-cols">
      <Slider label="Change in real interest rates (beyond inflation)" value={scn.rateShock} base={BASE.rateShock}
        min={-0.04} max={0.06} step={0.0025} format={pts} onChange={(v) => set((s) => { s.rateShock = v; })}
        hint={`Market yields already rise one-for-one with the inflation slider below; this moves them on top of that (Volcker-era real rates were high, the 1950s and 1970s negative). In year 1 only about ${pct(manual.rateRepricingShareYear1, 0)} of the debt reprices; the rest rolls over across ~${manual.debtComposition.avgMaturityYears} years.`} />
      <Slider label="Extra inflation (or deflation), every year" value={scn.inflationShock} base={BASE.inflationShock}
        min={-0.05} max={0.1} step={0.0025} format={pts} onChange={(v) => set((s) => { s.inflationShock = v; })}
        hint={<>On top of ~{pct(baseInfl, 1)} normal inflation, which already erodes ~{fmtB(baseInfl * debt)} of real debt a year. {scn.inflationShock > 0 && <>This year it adds {fmtB(budget.inflationInterest)} of interest ({pct(budget.repricing1, 0)} of the debt reprices or is inflation-indexed). </>} Watch the 10-year charts: debt-to-GDP dips, then climbs again as the rest of the debt reprices (average maturity ~{manual.debtComposition.avgMaturityYears} yrs).</>} />
      <Slider label="This year's economy (crash or boom)" value={scn.gdpShock} base={BASE.gdpShock}
        min={-0.1} max={0.05} step={0.005} format={(v) => (Math.abs(v) < 0.0005 ? 'normal' : `GDP ${v > 0 ? '+' : '−'}${pct(Math.abs(v))}`)} onChange={(v) => set((s) => { s.gdpShock = v; })}
        hint={<>A recession or boom that isn't caused by your policies. Revenue swings ~{manual.feedback.shockRevenueElasticity}× as much as GDP, because capital gains and corporate profits collapse in a crash; in 2009 revenue fell 17% with GDP ~6% below normal. Fades ~30%/yr in the charts.</>} />
      <Slider label="Real GDP growth" value={scn.realGrowth} base={BASE.realGrowth}
        min={-0.02} max={0.05} step={0.001} format={(v) => `${pct(v)}/yr`} onChange={(v) => set((s) => { s.realGrowth = v; })}
        hint={<>Affects the 10-year charts, not this year's deficit. CBO's long-run estimate is ~{pct(manual.realGdpGrowth)}; the 1990s averaged ~3.5%, and 2009 was −2.5%. Faster growth shrinks debt-to-GDP because GDP grows faster than the debt. Revenue and spending grow with the economy here.</>} />
      <Slider label="Economic feedback (fiscal multiplier)" value={scn.multiplier} base={BASE.multiplier}
        min={0} max={2} step={0.1} format={(v) => (v ? `${v.toFixed(1)}×` : 'off')} onChange={(v) => set((s) => { s.multiplier = v; })}
        hint={<>{scn.multiplier > 0 && <strong className={budget.gdpGap < -0.0005 ? 'neg' : budget.gdpGap > 0.0005 ? 'pos' : ''}>{Math.abs(budget.gdpGap) < 0.0005 ? 'No effect: your plan doesn\'t change the deficit before interest. ' : `At ${budget.multiplierUsed.toFixed(2)}×: GDP ${budget.gdpGap > 0 ? '+' : '−'}${pct(Math.abs(budget.gdpGap))} this year; revenue ${budget.feedbackB > 0 ? '−' : '+'}${fmtB(Math.abs(budget.feedbackB))}. `}</strong>}
          How much each $1 of spending cuts or tax hikes shrinks the economy (and each $1 of stimulus grows it). Smaller GDP means less revenue and a bigger debt-to-GDP. About 0.5 in normal times; 0.9–1.7 in Europe's 2010–13 austerity, when Greece cut its deficit and its debt-to-GDP still rose (Blanchard &amp; Leigh, IMF). The effect fades ~30%/yr. Starts at 0.5, the normal-times estimate. Set it to 0 for static scoring, like CBO's conventional scores.</>} />
      <Slider label="Inflation sensitivity" value={scn.inflationSensitivity} base={BASE.inflationSensitivity}
        min={0} max={2} step={0.1} format={(v) => (v ? `${v.toFixed(1)}×` : 'off')} onChange={(v) => set((s) => { s.inflationSensitivity = v; })}
        hint={<>{Math.abs(budget.policyInflation) >= 0.0005 && <strong className={budget.policyInflation > 0 ? 'neg' : 'pos'}>Your plan {budget.policyInflation > 0 ? 'adds' : 'takes off'} {pct(Math.abs(budget.policyInflation), 1)} of inflation this year. </strong>}
          How much your plan's boost (or drag) to the economy shows up as inflation: ~{manual.macro.phillipsUp} pts per 1% of GDP the economy runs hot, ~{manual.macro.phillipsDown} when it runs cold. 2× is a tight economy like 2021, when stimulus met supply shortages. The Fed answers with higher short rates (Taylor rule), and inflation erodes paychecks in the household cards. 0 = static.</>} />
      <Slider label="Bond market fear" value={scn.marketFear} base={BASE.marketFear}
        min={0} max={3} step={0.1} format={(v) => (v ? `${v.toFixed(1)}×` : 'off')} onChange={(v) => set((s) => { s.marketFear = v; })}
        hint={<>Investors demand higher long yields when deficits and debt run above the current-law path: ~{Math.round(manual.macro.premiumPerDeficitPt * 1e4)} bp per point of GDP of extra deficit and ~{Math.round(manual.macro.premiumPerDebtPt * 1e4)} bp per point of debt (Laubach 2009). Cutting the deficit lowers rates the same way. Higher rates raise interest, which raises the deficit, which raises rates: that loop is how a debt spiral starts. 3× is stressed markets (the UK's 2022 gilt crisis); capped at +{manual.macro.premiumCap * 100} pts since the U.S. borrows in its own reserve currency. 0 = off.</>} />
      <Toggle label="Scale with severity (Greece effect)" checked={scn.multiplierScales} onChange={(v) => set((s) => { s.multiplierScales = v; })}
        aside={<span className="hint">{scn.multiplierScales && budget.multiplierUsed > scn.multiplier + 0.005 && <strong className="neg">Your plan's austerity raises it to {budget.multiplierUsed.toFixed(2)}×. </strong>}
          Big, fast austerity hits harder than small changes. Above a {pct(manual.feedback.severityThreshold, 0)}-of-GDP squeeze, the multiplier rises 0.1 per extra point of GDP (max {manual.feedback.maxMultiplier}×). A Greece-sized 13% squeeze gets ~1.6×. Turn off to use the slider value as-is.</span>} />
      </div>
    </Bucket>
  );
}

function WildIdeas() {
  const { scn, budget } = useResults();
  const set = useStore((s) => s.set);
  const cost = budget.outlays.find((x) => x.id === 'stimulus')!.value;
  return (
    <Bucket id="wild" className="wide">
      <div className="split">
        <div>
          <h3>Checks for everyone</h3>
          <Slider label={<>Stimulus check per adult <span className="delta">{fmtB(cost)}</span></>} value={scn.stimulusPerAdult} base={0}
            min={0} max={12000} step={250} format={(v) => (v ? fmt$(v) : 'none')} onChange={(v) => set((s) => { s.stimulusPerAdult = v; })}
            hint={`~${manual.stimulus.adultsM}M adults. For scale: 2008 rebates were $600, 2021 checks $1,400, and $12,000/yr is Andrew Yang's $1,000/month "Freedom Dividend".`} />
          <Toggle label="Pay it every year (universal basic income)" checked={scn.stimulusRecurring}
            onChange={(v) => set((s) => { s.stimulusRecurring = v; })}
            aside={<span className="hint">Off = a one-time check, so the 10-year charts count it in year 1 only.</span>} />
        </div>
        <div>
          <PolicyList bucket="wild" />
        </div>
      </div>
      <p className="hint">Campaign promises and news-cycle fights from both parties, scored as written. Some are huge, some barely move the dial. "One-time" items count only in the first year of the 10-year outlook.</p>
    </Bucket>
  );
}

function Energy() {
  return (
    <Bucket id="energy">
      <p className="hint">Energy tax credits, carbon pricing, fuel taxes, clean-energy spending, and roads, bridges and transit. Opposite or overlapping switches (restore vs. repeal credits, carbon tax vs. carbon dividend, 15¢ vs. 50¢ gas tax) turn each other off.</p>
      <PolicyList bucket="energy" />
    </Bucket>
  );
}

/** Area cards by bucket id, for the sortable layout. */
export const BUCKET_CARDS: Record<string, () => JSX.Element> = {
  income_tax: IncomeTax,
  social_security: SocialSecurity,
  health: Health,
  safety_net: SafetyNet,
  defense_other: DefenseOther,
  business: Business,
  energy: Energy,
  debt: DebtInflation,
  wild: WildIdeas,
};
