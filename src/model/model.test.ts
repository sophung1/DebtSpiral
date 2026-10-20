import { describe, it, expect } from 'vitest';
import { archetypes, manual } from './data';
import { currentLaw, lawFor, setPolicy } from './scenario';
import { scheduleTax, cappedWages, aggregateOrdinaryTax } from './incomeTax';
import { computeBudget } from './budget';
import { computeOutcomes, projection } from './outcomes';
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
    // FY2026 actual deficit (MTS): $1,992.5B
    expect(b.deficit).toBeCloseTo(1992.5, -1);
  });
  it('about 80-90% of wages fall under the SS cap', () => {
    const share = cappedWages(manual.tax.payroll.ssWageBase) / cappedWages(null);
    expect(share).toBeGreaterThan(0.80);
    expect(share).toBeLessThan(0.90);
  });
  it('model ordinary tax is in a plausible range before calibration', () => {
    const t = aggregateOrdinaryTax(base.brackets, base.brackets, false, lawFor(base));
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

describe('OBBBA rollback', () => {
  const d0 = computeBudget(base, base).deficit;
  const rolled = () => { const s = currentLaw(); setPolicy(s, 'obbba_rollback', true); return s; };
  it('cuts the deficit by CBO\'s FY2026 total, split between modeled taxes and a lump sum', () => {
    const s = rolled();
    expect(d0 - computeBudget(s, base).deficit).toBeCloseTo(manual.tax.preObbba.cboFy2026DeficitIncreaseB, 6);
    expect(s.brackets.rates.at(-1)).toBeCloseTo(0.396, 6);
  });
  it('supersedes the tips/overtime and SALT switches', () => {
    const s = rolled();
    const d1 = computeBudget(s, base).deficit;
    setPolicy(s, 'tips_ot_repeal', true); setPolicy(s, 'salt10', true);
    expect(computeBudget(s, base).deficit).toBeCloseTo(d1, 6);
  });
  it('raises taxes on the median family (smaller CTC) and restores 39.6% at the top', () => {
    const s = rolled();
    const med = arch('median'), top = arch('top1');
    expect(computeHousehold(med, s).net).toBeLessThan(computeHousehold(med, base).net);
    expect(computeHousehold(top, s).incomeTax).toBeGreaterThan(computeHousehold(top, base).incomeTax);
  });
  it('turning it back off restores current law exactly', () => {
    const s = rolled(); setPolicy(s, 'obbba_rollback', false);
    expect(s).toEqual(base);
  });
});

describe('presets', () => {
  it('each preset does what its name claims', async () => {
    const { PRESETS } = await import('./presets');
    const run = (id: string) => { const b = computeBudget(PRESETS.find((p) => p.id === id)!.build(), base); return { b, o: computeOutcomes(b) }; };
    expect(run('hawk').b.deficit).toBeLessThanOrEqual(0);
    const bal = run('balanced');
    expect(bal.o.debtToGdp10).toBeLessThan(bal.o.debtToGdpNow);
    expect(run('socialism').b.totalOutlays).toBeGreaterThan(computeBudget(base, base).totalOutlays * 1.1);
    expect(run('libertarian').b.totalOutlays).toBeLessThan(computeBudget(base, base).totalOutlays * 0.85);
  });
});

describe('debt, inflation & wild ideas', () => {
  const b0 = computeBudget(base, base);
  it('a one-time item adds to year 1 only; a recurring one every year', () => {
    const s = currentLaw(); s.stimulusPerAdult = 5000;
    const one = projection(computeBudget(s, base));
    s.stimulusRecurring = true;
    const rec = projection(computeBudget(s, base));
    const p0 = projection(b0);
    expect(one[1].deficit! - p0[1].deficit!).toBeCloseTo(1325, 0);
    expect(one[5].deficit! - p0[5].deficit!).toBeLessThan(200); // only the extra interest remains
    expect(rec[5].deficit! - p0[5].deficit!).toBeGreaterThan(1300);
  });
  it('inflation: debt-to-GDP dips at first, then the gain fades as interest catches up', () => {
    const s = currentLaw(); s.inflationShock = 0.03;
    const p = projection(computeBudget(s, base)), p0 = projection(b0);
    const gap = (t: number) => p0[t].debt / p0[t].gdp - p[t].debt / p[t].gdp;
    expect(gap(2)).toBeGreaterThan(0);
    expect(p[10].interest! - p0[10].interest!).toBeGreaterThan(p[1].interest! - p0[1].interest!);
  });
  it('faster real growth lowers debt-to-GDP but not this year\'s deficit', () => {
    const s = currentLaw(); s.realGrowth = 0.035;
    const b = computeBudget(s, base);
    expect(b.deficit).toBeCloseTo(b0.deficit, 6);
    expect(computeOutcomes(b).debtToGdp10).toBeLessThan(computeOutcomes(b0).debtToGdp10);
    expect(computeOutcomes(b).inflationToHoldRatio).toBeLessThan(computeOutcomes(b0).inflationToHoldRatio);
  });
  it('one-time policies are flagged and excluded from later years', () => {
    const s = currentLaw(); setPolicy(s, 'student_debt', true);
    const p = projection(computeBudget(s, base)), p0 = projection(b0);
    expect(p[1].deficit! - p0[1].deficit!).toBeCloseTo(400, 0);
    expect(p[3].deficit! - p0[3].deficit!).toBeLessThan(40);
  });
});
