import { useState } from 'react';
import { useStore } from '../state/store';
import { useResults } from '../state/results';
import { live, manual } from '../model/data';
import { Dial } from './Dial';
import { ssCashFlow } from '../model/buckets';
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
  const [copied, setCopied] = useState(false);
  const deficit = budget.deficit;
  const change = budget.baseDeficit - deficit;
  const onBudget = deficit + ssCashFlow(budget, scn).balance;

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
        <Badge ok={o.inflationToHoldRatio <= 0} title="Inflate it away?"
          hint={`Inflation shrinks old debt, but new deficits add debt in inflated dollars. Inflation also raises interest: short-term bills (~${pct(manual.debtComposition.billsShare, 0)} of the debt) reprice within months, TIPS are inflation-protected, and once markets expect inflation, all new borrowing costs more. That's why it only works as a surprise, and why it stops working as the debt rolls over (average maturity ~${manual.debtComposition.avgMaturityYears} years). The U.S. has had ~2-3% inflation for 30 years, and debt-to-GDP still went from ~47% (1995) to over 100%.`}>
          {o.inflationToHoldRatio <= 0
            ? <>Not needed<small>debt-to-GDP is already falling at this deficit</small></>
            : <>No: needs +{pct(o.inflationToHoldRatio)} surprise inflation, every year
                <small>just to keep debt-to-GDP flat, and it stops working as the debt reprices (~{manual.debtComposition.avgMaturityYears} yrs). Inflation already erodes ~{fmtB(o.inflationErosionNow)}/yr; the deficit is {fmtB(budget.deficit)}.</small></>}
        </Badge>
        <Badge ok={null} title="National debt">{fmtB(live.totalDebtB.value)} <small>as of {live.totalDebtB.asOf}</small></Badge>
      </div>
    </header>
  );
}
