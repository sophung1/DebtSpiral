import type { Budget } from './budget';

export interface Flow { id: string; label: string; value: number; base: number; slot: string }

const IN = [
  { id: 'individual', label: 'Individual income tax', lines: ['individualOrdinary', 'capitalGains'], slot: '1' },
  { id: 'payroll', label: 'Payroll taxes', lines: ['payrollSS', 'payrollHI', 'payrollOther'], slot: '2' },
  { id: 'corporate', label: 'Corporate tax', lines: ['corporate'], slot: '3' },
  { id: 'trade', label: 'Tariffs & excise', lines: ['customs', 'excise', 'fuelExcise'], slot: '4' },
  { id: 'other_rev', label: 'Other revenue', lines: ['estate', 'other'], slot: '5' },
];
const OUT = [
  { id: 'ss', label: 'Social Security', lines: ['social_security'], slot: '1' },
  { id: 'health', label: 'Health', lines: ['medicare', 'medicaid', 'aca'], slot: '2' },
  { id: 'defense', label: 'Defense', lines: ['defense'], slot: '3' },
  { id: 'interest', label: 'Interest', lines: ['net_interest'], slot: '4' },
  { id: 'safety', label: 'Safety net', lines: ['snap', 'eitc', 'ctc', 'ssi', 'unemployment'], slot: '5' },
  { id: 'other_out', label: 'Everything else', lines: ['veterans', 'fed_retirement', 'other_mandatory', 'nondefense', 'stimulus'], slot: '6' },
];

const group = (lines: Budget['receipts'], defs: typeof IN): Flow[] => defs.map((d) => {
  const ls = lines.filter((l) => d.lines.includes(l.id));
  return { id: d.id, label: d.label, slot: d.slot, value: ls.reduce((a, l) => a + l.value, 0), base: ls.reduce((a, l) => a + l.base, 0) };
});

/**
 * Money in (taxes, borrowing, net policy savings) and money out (spending, net policy costs, paying down debt).
 * The two sides always sum to the same total.
 */
export function budgetFlows(b: Budget) {
  const policyNet = b.policyLines.reduce((a, p) => a + p.value, 0);
  const revenue = group(b.receipts, IN);
  const spending = group(b.outlays, OUT);
  const inflows: Flow[] = [...revenue];
  const outflows: Flow[] = [...spending];
  if (policyNet > 0.5) inflows.push({ id: 'policy_in', label: 'Policy savings', value: policyNet, base: 0, slot: 'policy' });
  if (policyNet < -0.5) outflows.push({ id: 'policy_out', label: 'Policy costs', value: -policyNet, base: 0, slot: 'policy' });
  const baseDeficit = Math.max(0, b.baseDeficit);
  if (b.deficit > 0) inflows.push({ id: 'borrowing', label: 'Borrowing (deficit)', value: b.deficit, base: baseDeficit, slot: 'borrow' });
  else outflows.push({ id: 'surplus', label: 'Debt paydown', value: -b.deficit, base: 0, slot: 'surplus' });
  return { inflows, outflows, revenue, spending, borrowing: Math.max(0, b.deficit), baseBorrowing: baseDeficit };
}
