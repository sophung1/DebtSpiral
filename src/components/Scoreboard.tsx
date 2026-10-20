import { useState } from 'react';
import { useStore } from '../state/store';
import { useResults } from '../state/results';
import { live } from '../model/data';
import { Dial } from './Dial';
import { fmtB, pct } from '../format';

function Badge({ ok, title, children }: { ok: boolean | null; title: string; children: React.ReactNode }) {
  return (
    <div className={`badge ${ok === null ? '' : ok ? 'ok' : 'bad'}`}>
      <span className="badge-title">{title}</span>
      <span className="badge-body">{children}</span>
    </div>
  );
}

export function Scoreboard() {
  const { budget, outcomes: o } = useResults();
  const reset = useStore((s) => s.reset);
  const [copied, setCopied] = useState(false);
  const deficit = budget.deficit;
  const change = budget.baseDeficit - deficit;

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
        sub={`${pct(Math.abs(o.deficitPctGdp))} of GDP · ${change >= 0 ? 'cut' : 'added'} ${fmtB(Math.abs(change))}`} />
      <div className="badges">
        <Badge ok={o.balanced} title="Balanced budget">{o.balanced ? '✅ Yes!' : `❌ ${fmtB(deficit)} short`}</Badge>
        {payoff && <Badge ok={o.payoffYears !== Infinity} title="Debt paid off">{payoff}</Badge>}
        {ceiling && <Badge ok={(o.ceilingMonths ?? 0) > 24} title="Hits the debt ceiling">{ceiling}</Badge>}
        <Badge ok={o.debtToGdp10 <= o.debtToGdpNow} title="Debt-to-GDP in 10 yrs">{pct(o.debtToGdpNow, 0)} → {pct(o.debtToGdp10, 0)}</Badge>
        <Badge ok={o.interestShareOfRevenue < 0.15} title="Interest share of revenue">{pct(o.interestShareOfRevenue, 0)}</Badge>
        <Badge ok={null} title="National debt">{fmtB(live.totalDebtB.value)} <small>as of {live.totalDebtB.asOf}</small></Badge>
      </div>
    </header>
  );
}
