import { policies, programs, tax, manual, type Policy } from './data';
import { currentLaw, setPolicy, lawFor, type Scenario } from './scenario';
import { individualOrdinaryReceipts } from './incomeTax';

/** Switches that are on and not superseded by another switch that's on. */
export function activePolicies(scn: Scenario): Policy[] {
  const replaced = new Set(policies.filter((p) => scn.policies[p.id]).flatMap((p) => p.replaces ?? []));
  return policies.filter((p) => scn.policies[p.id] && !replaced.has(p.id));
}

/** Child Tax Credit outlay multiplier from the law in force (credit size relative to current law). */
export const ctcLawFactor = (scn: Scenario) => lawFor(scn).ctc.perChild / tax.ctc.perChild;

const ctcOutlay = (factor: number) => {
  const p = programs.find((x) => x.id === 'ctc')!;
  return p.baselineB + (p.fullCostB ?? p.baselineB) * (factor - 1);
};

let obbbaLump: number | undefined;
/**
 * The OBBBA rollback's tax changes (brackets, deductions, exemptions, CTC) are scored by the model;
 * the rest of CBO's FY2026 total (business provisions, Medicaid/SNAP, spending) is this lump sum.
 */
function obbbaRemainder(): number {
  const base = currentLaw();
  const r = currentLaw();
  setPolicy(r, 'obbba_rollback', true);
  const modeled = individualOrdinaryReceipts(r, base) - manual.receipts.individualOrdinary.value
    + ctcOutlay(1) - ctcOutlay(ctcLawFactor(r));
  return tax.preObbba.cboFy2026DeficitIncreaseB - modeled;
}

/** A switch's direct deficit effect ($B; + = lowers the deficit), excluding parts the model scores itself. */
export function policyDelta(p: Policy): number {
  if (p.id !== 'obbba_rollback') return p.deltaB;
  return (obbbaLump ??= obbbaRemainder());
}
