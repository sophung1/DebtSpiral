import { useStore } from '../state/store';
import { policies, policyMeta } from '../model/data';
import { Panel, Toggle } from './Controls';
import { fmtB } from '../format';

export function PolicyPanel() {
  const on = useStore((s) => s.scn.policies);
  const set = useStore((s) => s.set);
  const groups = [...new Set(policies.map((p) => p.group))];
  const total = policies.reduce((a, p) => a + (on[p.id] ? p.deltaB : 0), 0);
  return (
    <Panel title="Policy switches" className="policies" right={<span className={`panel-total ${total > 0 ? 'pos' : total < 0 ? 'neg' : ''}`}>{fmtB(total, true)} savings</span>}>
      {groups.map((g) => (
        <div key={g}>
          <h3>{g}</h3>
          {policies.filter((p) => p.group === g).map((p) => (
            <Toggle key={p.id} checked={!!on[p.id]} onChange={(v) => set((s) => { s.policies[p.id] = v; })}
              label={<span title={p.source}>{p.label}</span>}
              aside={<span className={`delta ${p.deltaB > 0 ? 'pos' : 'neg'}`}>{fmtB(p.deltaB, true)}/yr</span>} />
          ))}
        </div>
      ))}
      <p className="hint">Rough first-year scores, mostly <a href={policyMeta.cboUrl} target="_blank" rel="noreferrer">CBO's Options for Reducing the Deficit</a> divided by ten. Hover a switch to see its source. + = lowers the deficit.</p>
    </Panel>
  );
}
