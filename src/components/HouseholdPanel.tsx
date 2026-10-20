import { Fragment } from 'react';
import { useResults } from '../state/results';
import { programs } from '../model/data';
import { Panel } from './Controls';
import { fmt$, pct } from '../format';

const name = (id: string) => programs.find((p) => p.id === id)?.name ?? id;

export function HouseholdPanel() {
  const { households } = useResults();
  return (
    <Panel title="What it means for households" className="households">
      <div className="hh-grid">
        {households.map(({ a, now, base }) => {
          const change = now.net - base.net;
          const taxes = now.incomeTaxOwed + now.payrollTax;
          return (
            <article key={a.id} className="hh">
              <header>
                <span className="hh-icon" aria-hidden>{a.icon}</span>
                <div><h3>{a.name}</h3><small>{fmt$(now.totalIncome)} income · {a.filing === 'mfj' ? 'married' : 'single'}{a.kids ? ` · ${a.kids} kids` : ''}{a.over65 ? ' · 65+' : ''}</small></div>
              </header>
              <dl>
                <dt>Income tax</dt><dd>{fmt$(now.incomeTaxOwed)}</dd>
                <dt>Payroll tax (employee)</dt><dd>{fmt$(now.payrollTax)}</dd>
                <dt>Effective tax rate</dt><dd>{pct(taxes / Math.max(1, now.totalIncome))}</dd>
                {Object.entries(now.benefits)
                  .map(([id, v]) => [id, id === 'ctc' ? v - now.ctcNonrefundable : v] as const)
                  .filter(([, v]) => v >= 1)
                  .map(([id, v]) => (
                    <Fragment key={id}><dt>{id === 'ctc' ? 'Child Tax Credit refund' : name(id)}</dt><dd className="pos">{fmt$(v)}</dd></Fragment>
                  ))}
                {now.policyEffect !== 0 && <><dt>Policy switches</dt><dd className={now.policyEffect > 0 ? 'pos' : 'neg'}>{fmt$(now.policyEffect, true)}</dd></>}
              </dl>
              <footer className={Math.abs(change) < 1 ? '' : change > 0 ? 'pos' : 'neg'}>
                {Math.abs(change) < 1 ? 'No change vs current law' : <>{fmt$(change, true)}/yr vs current law</>}
              </footer>
            </article>
          );
        })}
      </div>
      <p className="hint">Illustrative households. Income tax is after the Child Tax Credit. Benefits show cash refunds and the typical federal value of coverage, such as Medicare or Medicaid spending per enrollee. The employer's half of payroll tax isn't shown.</p>
    </Panel>
  );
}
