import { activePolicies, policyDelta } from './policies';
import type { Budget } from './budget';
import type { Scenario } from './scenario';

export interface BucketDef {
  id: string;
  title: string;
  receipts: string[];
  outlays: string[];
}

/** Every receipt and outlay line belongs to exactly one bucket, so bucket changes sum to the total change. */
export const BUCKETS: BucketDef[] = [
  { id: 'income_tax', title: 'Individual income tax', receipts: ['individualOrdinary', 'capitalGains'], outlays: [] },
  { id: 'social_security', title: 'Social Security', receipts: ['payrollSS'], outlays: ['social_security'] },
  { id: 'health', title: 'Health: Medicare, Medicaid & ACA', receipts: ['payrollHI'], outlays: ['medicare', 'medicaid', 'aca'] },
  { id: 'safety_net', title: 'Safety net & family credits', receipts: [], outlays: ['snap', 'eitc', 'ctc', 'ssi', 'unemployment'] },
  { id: 'defense_other', title: 'Defense, veterans & other spending', receipts: [], outlays: ['defense', 'nondefense', 'veterans', 'fed_retirement', 'other_mandatory'] },
  { id: 'business', title: 'Business, trade & new taxes', receipts: ['corporate', 'estate', 'customs', 'excise', 'payrollOther', 'other'], outlays: [] },
  { id: 'energy', title: 'Energy & infrastructure', receipts: ['fuelExcise'], outlays: [] },
  { id: 'debt', title: 'Debt, interest & inflation', receipts: [], outlays: ['net_interest'] },
  { id: 'wild', title: 'Headline proposals', receipts: [], outlays: ['stimulus'] },
];

/** Change in the deficit attributable to a bucket ($B; negative = deficit reduced). */
export function bucketDelta(b: Budget, scn: Scenario, def: BucketDef): number {
  const d = (ls: Budget['receipts'], ids: string[]) => ls.filter((l) => ids.includes(l.id)).reduce((a, l) => a + l.value - l.base, 0);
  const pol = activePolicies(scn).filter((p) => p.bucket === def.id).reduce((a, p) => a + policyDelta(p), 0);
  return d(b.outlays, def.outlays) - d(b.receipts, def.receipts) - pol;
}

/** Social Security's own cash flow: dedicated payroll tax in vs. benefits out, net of SS policy switches ($B). */
export function ssCashFlow(b: Budget, scn: Scenario) {
  const inflow = b.receipts.find((r) => r.id === 'payrollSS')!.value;
  const switches = activePolicies(scn).filter((p) => p.bucket === 'social_security').reduce((a, p) => a + policyDelta(p), 0);
  const outflow = b.outlays.find((o) => o.id === 'social_security')!.value - switches;
  return { inflow, outflow, balance: inflow - outflow };
}
