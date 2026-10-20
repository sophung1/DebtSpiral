import { describe, it, expect } from 'vitest';
import { archetypes, manual } from './data';
import { currentLaw } from './scenario';
import { scheduleTax, cappedWages, aggregateOrdinaryTax } from './incomeTax';
import { computeBudget } from './budget';
import { computeOutcomes } from './outcomes';
import { computeHousehold } from './household';

const base = currentLaw();
const arch = (id: string) => archetypes.find((a) => a.id === id)!;

describe('income tax schedule', () => {
  it('computes progressive tax', () => {
    const b = manual.tax.brackets;
    expect(scheduleTax(51800, b.mfj, b.rates)).toBeCloseTo(2480 + 27000 * 0.12, 6);
    expect(scheduleTax(0, b.single, b.rates)).toBe(0);
  });
});

describe('households (hand-computed, TY2026 law)', () => {
  it('median family of 4 at $84k', () => {
    const r = computeHousehold(arch('median'), base);
    expect(r.incomeTax).toBeCloseTo(5720, 0);
    expect(r.incomeTaxOwed).toBeCloseTo(1320, 0);
    expect(r.benefits.ctc).toBeCloseTo(4400, 0);
    expect(r.payrollTax).toBeCloseTo(84000 * 0.0765, 0);
  });
  it('single min-wage worker', () => {
    const r = computeHousehold(arch('min_wage'), base);
    expect(r.incomeTax).toBe(0);
    expect(r.benefits.eitc).toBeCloseTo(8490 * 0.0765 - 0.0765 * (15080 - 10620), 0);
  });
  it('raising the top rate hits the top 1% but not the median family', () => {
    const scn = currentLaw();
    scn.brackets.rates[6] = 0.5;
    expect(computeHousehold(arch('top1'), scn).incomeTax).toBeGreaterThan(computeHousehold(arch('top1'), base).incomeTax);
    expect(computeHousehold(arch('median'), scn).incomeTax).toBeCloseTo(computeHousehold(arch('median'), base).incomeTax, 6);
  });
});

describe('budget calibration', () => {
  it('current law reproduces the baseline deficit', () => {
    const b = computeBudget(base, base);
    expect(b.deficit).toBeCloseTo(b.baseDeficit, 6);
    expect(b.deficit).toBeGreaterThan(1700);
    expect(b.deficit).toBeLessThan(1900);
  });
  it('about 80-90% of wages fall under the SS cap', () => {
    const share = cappedWages(manual.tax.payroll.ssWageBase) / cappedWages(null);
    expect(share).toBeGreaterThan(0.80);
    expect(share).toBeLessThan(0.90);
  });
  it('model ordinary tax is in a plausible range before calibration', () => {
    const t = aggregateOrdinaryTax(base.brackets, base.brackets, false);
    expect(t).toBeGreaterThan(1200);
    expect(t).toBeLessThan(3500);
  });
  it('raising rates raises revenue; behavioral response dampens it', () => {
    const scn = currentLaw();
    scn.brackets.rates = scn.brackets.rates.map((r) => r + 0.05);
    const static_ = computeBudget(scn, base).deficit;
    scn.behavioral = true;
    const dyn = computeBudget(scn, base).deficit;
    expect(static_).toBeLessThan(base && computeBudget(base, base).deficit);
    expect(dyn).toBeGreaterThan(static_);
  });
});

describe('outcomes', () => {
  const withDeficit = (d: number) => ({ ...computeBudget(base, base), deficit: d });
  it('deficit: debt ceiling months, no payoff', () => {
    const o = computeOutcomes(withDeficit(1200));
    expect(o.balanced).toBe(false);
    expect(o.payoffYears).toBeNull();
    expect(o.ceilingMonths).toBeGreaterThan(0);
  });
  it('exactly balanced still pays off eventually (growing primary surplus)', () => {
    const o = computeOutcomes(withDeficit(0));
    expect(o.balanced).toBe(true);
    expect(o.ceilingMonths).toBeNull();
    expect(o.payoffYears).toBeGreaterThan(10);
  });
  it('big surplus pays off faster than tiny surplus', () => {
    const big = computeOutcomes(withDeficit(-1500)).payoffYears!;
    const tiny = computeOutcomes(withDeficit(-1)).payoffYears!;
    expect(big).toBeLessThan(tiny);
  });
});

describe('inflation card', () => {
  const b0 = computeBudget(base, base);
  it('current law needs a few points of surprise inflation every year just to stand still', () => {
    const o = computeOutcomes(b0);
    expect(o.inflationToHoldRatio).toBeGreaterThan(0.015);
    expect(o.inflationToHoldRatio).toBeLessThan(0.035);
  });
  it('a balanced budget needs none; a bigger deficit needs more', () => {
    expect(computeOutcomes({ ...b0, deficit: 0 }).inflationToHoldRatio).toBeLessThanOrEqual(0);
    expect(computeOutcomes({ ...b0, deficit: 2500 }).inflationToHoldRatio).toBeGreaterThan(computeOutcomes(b0).inflationToHoldRatio);
  });
  it('baseline inflation already erodes about 2.2% of public debt a year', async () => {
    const { live } = await import('./data');
    expect(computeOutcomes(b0).inflationErosionNow).toBeCloseTo(0.022 * live.debtHeldByPublicB.value, 6);
  });
});

describe('buckets', () => {
  it('bucket deltas sum to the total deficit change and cover every line once', async () => {
    const { BUCKETS, bucketDelta } = await import('./buckets');
    const { policies } = await import('./data');
    const scn = currentLaw();
    scn.brackets.rates[6] = 0.45; scn.ssWageBase = null; scn.programs.defense = 0.8; scn.rateShock = 0.01; scn.corporateRate = 0.28;
    for (const p of policies) scn.policies[p.id] = true;
    const b = computeBudget(scn, base);
    const sum = BUCKETS.reduce((a, d) => a + bucketDelta(b, scn, d), 0);
    expect(sum).toBeCloseTo(b.deficit - b.baseDeficit, 6);
    const ids = BUCKETS.flatMap((d) => [...d.receipts, ...d.outlays]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(b.receipts.length + b.outlays.length);
    expect(policies.every((p) => BUCKETS.some((d) => d.id === p.bucket))).toBe(true);
  });
});

describe('Social Security cash flow', () => {
  it('SS policy switches reduce benefits out', async () => {
    const { ssCashFlow } = await import('./buckets');
    const scn = currentLaw();
    const before = ssCashFlow(computeBudget(scn, base), scn).outflow;
    scn.policies.chained_cpi = true;
    expect(ssCashFlow(computeBudget(scn, base), scn).outflow).toBeCloseTo(before - 20, 6);
  });
});
