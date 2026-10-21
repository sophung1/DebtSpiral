import { live, manual, policyMeta } from '../model/data';
import { fmtB, pct } from '../format';
import { polls, pollingNote } from '../model/popularity';

const liveRows: [keyof typeof live, string, (v: number) => string][] = [
  ['totalDebtB', 'Total public debt', fmtB],
  ['debtHeldByPublicB', 'Debt held by the public', fmtB],
  ['debtSubjectToLimitB', 'Debt subject to limit', fmtB],
  ['debtLimitB', 'Statutory debt limit', fmtB],
  ['avgInterestRate', 'Average interest rate on debt', (v) => pct(v, 2)],
  ['yield2y', '2-yr Treasury yield', (v) => pct(v, 2)],
  ['yield10y', '10-yr Treasury yield', (v) => pct(v, 2)],
  ['yield30y', '30-yr Treasury yield', (v) => pct(v, 2)],
  ['fytdReceiptsB', 'Receipts, fiscal year to date', fmtB],
  ['fytdOutlaysB', 'Outlays, fiscal year to date', fmtB],
  ['fytdDeficitB', 'Deficit, fiscal year to date', fmtB],
];

export function SourcesDrawer() {
  return (
    <details className="panel sources">
      <summary><h2>Data & sources</h2><span className="hint">Live data updated {live.updatedAt.slice(0, 10)}</span></summary>
      {live.seed && <p className="warn">These are seed values from the end of FY2025. They'll be replaced on the first automated data refresh.</p>}
      <table>
        <thead><tr><th>Figure</th><th>Value</th><th>As of</th><th>Source</th></tr></thead>
        <tbody>
          {liveRows.map(([k, label, f]) => {
            const v = live[k] as { value: number; asOf: string; source: string };
            return <tr key={k}><td>{label}</td><td>{f(v.value)}</td><td>{v.asOf}</td><td>{v.source}</td></tr>;
          })}
        </tbody>
      </table>
      <h3>Polls behind the popularity meter</h3>
      <p>{pollingNote}</p>
      <ul>
        {Object.entries(polls).map(([k, p]) => <li key={k}>{p.label}: {p.support}% support.{p.note && ` ${p.note}`} <a href={p.url} target="_blank" rel="noreferrer">{p.source}</a></li>)}
      </ul>
      <h3>Model baseline</h3>
      <p>{manual.meta.baseline}. {manual.meta.note}</p>
      <ul>
        {Object.values(manual.receipts).map((r) => <li key={r.label}>{r.label}: {fmtB(r.value)}. {r.source}</li>)}
        <li>Net interest: {fmtB(manual.netInterestB.value)}. {manual.netInterestB.source}</li>
        <li>GDP: {fmtB(manual.gdpB.value)}. {manual.gdpB.source}</li>
        <li>Tax law: <a href={manual.tax.url} target="_blank" rel="noreferrer">{manual.tax.source}</a></li>
        <li>Income distribution: <a href={manual.soi.url} target="_blank" rel="noreferrer">IRS Statistics of Income</a>. {manual.soi.source}</li>
        <li>Policy scores: {policyMeta.note}</li>
      </ul>
      <h3>How the math works</h3>
      <ul>
        <li>This is a one-year, static score. Changes are measured against FY2026 actual receipts and outlays. The 10-year charts apply your plan from FY2027 on.</li>
        <li>Income tax: your brackets are applied to about 160M tax returns, using IRS income bins. The result is scaled so current law matches actual receipts.</li>
        <li>Outcomes: the primary balance stays fixed as a share of GDP. Interest accrues on the remaining debt, and nominal GDP grows {pct(manual.nominalGdpGrowth, 0)}/yr by default ({pct(manual.realGdpGrowth)} real + inflation) in nominal terms. The debt-ceiling clock is the room left under the limit ÷ the monthly deficit.</li>
      </ul>
    </details>
  );
}
