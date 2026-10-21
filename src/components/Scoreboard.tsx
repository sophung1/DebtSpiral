import { useState } from 'react';
import { useStore } from '../state/store';
import { useResults } from '../state/results';
import { live, manual } from '../model/data';
import { Dial } from './Dial';
import { ssCashFlow } from '../model/buckets';
import { popularity } from '../model/popularity';
import { baselineInflation } from '../model/budget';
import { PRESETS, CONDITIONS, activePreset, activeConditions, applyPreset, applyConditions } from '../model/presets';
import { fmtB, pct } from '../format';

function Badge({ ok, title, hint, children }: { ok: boolean | null; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`badge ${ok === null ? '' : ok ? 'ok' : 'bad'}`} title={hint}>
      <span className="badge-title">{title}</span>
      <span className="badge-body">{children}</span>
    </div>
  );
}

export function Scoreboard() {
  const { budget, scn, outcomes: o } = useResults();
  const reset = useStore((s) => s.reset);
  const load = useStore((s) => s.load);
  const preset = activePreset(scn);
  const cond = activeConditions(scn);
  const [copied, setCopied] = useState(false);
  const deficit = budget.deficit;
  const change = budget.baseDeficit - deficit;
  const onBudget = deficit + ssCashFlow(budget, scn).balance;
  const pop = popularity(scn);
  const inflNow = baselineInflation + budget.inflationShock;

  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard unavailable */ }
  };

  const payoff = o.payoffYears === null ? null : o.payoffYears === Infinity ? 'not within 200 years' : `in ${o.payoffYears} years`;
  const ceiling = o.ceilingMonths === null ? null : o.ceilingMonths === 0 ? 'already at the limit' : o.ceilingMonths > 120 ? 'in 10+ years' : `in ${o.ceilingMonths.toFixed(0)} months`;

  return (
    <header className="scoreboard">
      <div className="brand">
        <h1>Deficit<span>Dial</span></h1>
        <p>Can you balance the federal budget?</p>
        <div className="actions">
          <label className="picker">
            <span>Policy plan</span>
            <select className="btn" value={preset ?? 'custom'} title={PRESETS.find((p) => p.id === preset)?.blurb ?? ''}
              onChange={(e) => load(applyPreset(scn, e.target.value))}>
              <option value="current">Current law</option>
              {PRESETS.filter((p) => !p.era).map((p) => <option key={p.id} value={p.id} title={p.blurb}>{p.name}</option>)}
              <optgroup label="Past eras, applied today">
                {PRESETS.filter((p) => p.era).map((p) => <option key={p.id} value={p.id} title={p.blurb}>{p.name}</option>)}
              </optgroup>
              <option value="custom" disabled>Custom</option>
            </select>
          </label>
          <label className="picker">
            <span>Economy</span>
            <select className="btn" value={cond ?? 'custom'} title={CONDITIONS.find((c) => c.id === cond)?.blurb ?? ''}
              onChange={(e) => load(applyConditions(scn, e.target.value))}>
              {CONDITIONS.map((c) => <option key={c.id} value={c.id} title={c.blurb}>{c.name}</option>)}
              <option value="custom" disabled>Custom</option>
            </select>
          </label>
          <button className="btn" onClick={reset}>Reset to current law</button>
          <button className="btn primary" onClick={share}>{copied ? 'Link copied ✓' : 'Share scenario'}</button>
        </div>
      </div>
      <Dial value={deficit} min={-1000} max={3000} pivot={0} size={230}
        label={deficit > 0 ? 'Annual deficit' : 'Annual surplus'} display={fmtB(Math.abs(deficit))}
        sub={`${pct(Math.abs(o.deficitPctGdp))} of GDP · ${Math.abs(change) < 0.5 ? 'current law' : `${change > 0 ? 'cut' : 'added'} ${fmtB(Math.abs(change))}`} · excl. SS ${onBudget > 0 ? '' : '+'}${fmtB(Math.abs(onBudget))}`} />
      <div className="badges">
        <Badge ok={o.balanced} title="Balanced budget">{o.balanced ? '✅ Yes!' : `❌ ${fmtB(deficit)} short`}</Badge>
        {payoff && <Badge ok={o.payoffYears !== Infinity} title="Debt paid off">{payoff}</Badge>}
        {ceiling && <Badge ok={(o.ceilingMonths ?? 0) > 24} title="Hits the debt ceiling">{ceiling}</Badge>}
        <Badge ok={o.debtToGdp10 <= o.debtToGdpNow} title="Debt-to-GDP in 10 yrs">{pct(o.debtToGdpNow, 0)} → {pct(o.debtToGdp10, 0)}</Badge>
        <Badge ok={o.interestShareOfRevenue < 0.15} title="Interest share of revenue">{pct(o.interestShareOfRevenue, 0)}</Badge>
        <Badge ok={o.spiral === 'falling' ? true : o.spiral === 'rising' ? null : false} title="Debt spiral?"
          hint={`Over 10 years, interest on the debt averages ${pct(o.rate10, 1)} vs ${pct(o.growth10, 1)} nominal GDP growth. When interest outgrows the economy and the budget runs a deficit even before interest, debt-to-GDP snowballs. A spiral is when bond markets join in: higher debt raises rates, which raises interest and the debt again.${o.premium10 > 0.00005 ? ` Markets add ${Math.round(o.premium10 * 1e4)} bp by year 10.` : ''}`}>
          {{ falling: 'No: debt-to-GDP falling', rising: 'Not yet: debt rising steadily', snowball: 'Snowballing', spiral: 'Yes: spiraling' }[o.spiral]}
          <small>{o.spiral === 'snowball' ? `interest (${pct(o.rate10, 1)}) outgrows the economy (${pct(o.growth10, 1)})` : o.spiral === 'spiral' ? `markets add +${Math.round(o.premium10 * 1e4)} bp; interest ${pct(o.rate10, 1)} vs growth ${pct(o.growth10, 1)}` : `interest ${pct(o.rate10, 1)} vs growth ${pct(o.growth10, 1)} in year 10`}</small>
        </Badge>
        <Badge ok={o.inflationToHoldRatio <= 0} title="Inflate it away?"
          hint={`Inflation shrinks old debt, but new deficits add debt in inflated dollars. Inflation also raises interest: short-term bills (~${pct(manual.debtComposition.billsShare, 0)} of the debt) reprice within months, TIPS are inflation-protected, and once markets expect inflation, all new borrowing costs more. That's why it only works as a surprise, and why it stops working as the debt rolls over (average maturity ~${manual.debtComposition.avgMaturityYears} years). Today's inflation already erodes ~${fmtB(o.inflationErosionNow)} of real debt a year, against a ${fmtB(Math.max(0, budget.deficit))} deficit. The U.S. has had ~2-3% inflation for 30 years, and debt-to-GDP still went from ~47% (1995) to over 100%.`}>
          {o.inflationToHoldRatio <= 0
            ? <>Not needed<small>debt-to-GDP already falling</small></>
            : <>No: needs {pct(inflNow + o.inflationToHoldRatio)}/yr<small>vs {pct(inflNow)} now (+{pct(o.inflationToHoldRatio)}), just to hold debt-to-GDP flat</small></>}
        </Badge>
        <Badge ok={pop.approval === null ? null : pop.approval >= 50} title="Popularity"
          hint={pop.least ? `Least popular change: ${pop.least.poll!.label} (${pop.least.poll!.support}% support, ${pop.least.poll!.source}). Simple average over changes that have national polling; changes without a poll aren't counted.` : 'Average public support for your changes, from national polls.'}>
          {pop.approval === null ? (pop.total ? 'no polls yet' : '—') : `${Math.round(pop.approval)}% support`}
          <small>{pop.total ? `${pop.counted} of ${pop.total} changes polled` : 'make a change to see it'}</small>
        </Badge>
        <Badge ok={null} title="National debt">{fmtB(live.totalDebtB.value)} <small>as of {live.totalDebtB.asOf}</small></Badge>
      </div>
    </header>
  );
}
