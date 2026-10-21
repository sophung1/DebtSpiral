import { describe, it, expect } from 'vitest';
import { archetypes, manual } from './data';
import { currentLaw, lawFor, setPolicy, enforceProgressive, sanitizeScenario } from './scenario';
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
  it('infrastructure renewal counts in the energy & infrastructure card', async () => {
    const { BUCKETS, bucketDelta } = await import('./buckets');
    const scn = currentLaw(); Object.assign(scn, { multiplier: 0, inflationSensitivity: 0, marketFear: 0 }); setPolicy(scn, 'renew_iija', true);
    const energy = BUCKETS.find((d) => d.id === 'energy')!;
    expect(bucketDelta(computeBudget(scn, base), scn, energy)).toBeCloseTo(110, 6);
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
  // Static scoring (multiplier 0) so the CBO total can be checked exactly.
  const rolled = () => { const s = currentLaw(); s.multiplier = 0; s.inflationSensitivity = 0; s.marketFear = 0; setPolicy(s, 'obbba_rollback', true); return s; };
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
    Object.assign(s, { multiplier: base.multiplier, inflationSensitivity: base.inflationSensitivity, marketFear: base.marketFear });
    expect(s).toEqual(base);
  });
});

describe('presets', () => {
  it('each preset does what its name claims', async () => {
    const { PRESETS } = await import('./presets');
    const run = (id: string) => { const b = computeBudget(PRESETS.find((p) => p.id === id)!.build(), base); return { b, o: computeOutcomes(b) }; };
    // Hawk assumes a normal economy (no severity scaling) and balances.
    expect(run('hawk').b.deficit).toBeLessThanOrEqual(0);
    expect(run('hawk').b.multiplierUsed).toBeCloseTo(0.5, 9);
    const { applyConditions } = await import('./presets');
    const runC = (id: string) => { const b = computeBudget(applyConditions(currentLaw(), id), base); return { b, o: computeOutcomes(b) }; };
    const boom = runC('boom');
    expect(boom.b.deficit).toBeLessThan(computeBudget(base, base).deficit);
    expect(boom.o.debtToGdp10).toBeLessThan(boom.o.debtToGdpNow);
    const doom = runC('doomsday');
    expect(doom.b.deficit).toBeGreaterThan(3000);
    expect(doom.o.debtToGdp10).toBeGreaterThan(1.3);
    const bal = run('balanced');
    expect(bal.o.debtToGdp10).toBeLessThan(bal.o.debtToGdpNow);
    // Sanders' biggest spending (Medicare for All) comes through switches, so count their costs too.
    const soc = run('sanders').b;
    const switchSpending = soc.policyLines.filter((l) => l.value < 0).reduce((a, l) => a - l.value, 0);
    expect(soc.totalOutlays + switchSpending).toBeGreaterThan(computeBudget(base, base).totalOutlays * 1.3);
    // Rand Paul: everything but Social Security ~26% lower.
    expect(run('rand_paul').b.totalOutlays).toBeLessThan(computeBudget(base, base).totalOutlays * 0.85);
    // "Paid for" plans end no higher than current law; the spending-cut plans shrink the debt ratio.
    const lawDeficit = computeBudget(base, base).deficit;
    for (const id of ['sanders', 'peoples_budget']) expect(run(id).b.deficit).toBeLessThanOrEqual(lawDeficit);
    expect(run('peoples_budget').b.deficit).toBeLessThan(lawDeficit - 100);
    expect(run('rand_paul').o.debtToGdp10).toBeLessThan(run('rand_paul').o.debtToGdpNow - 0.1);
    expect(run('heritage').o.debtToGdp10).toBeLessThan(run('heritage').o.debtToGdpNow);
    // The 3%-of-GDP plans.
    for (const id of ['balanced', 'simpson_bowles']) {
      const pct = run(id).o.deficitPctGdp;
      expect(pct).toBeGreaterThan(0.025);
      expect(pct).toBeLessThanOrEqual(0.0355);
    }
  });

  it('the populist preset only makes changes that poll 60%+', async () => {
    const { PRESETS } = await import('./presets');
    const { changes } = await import('./popularity');
    const items = changes(PRESETS.find((p) => p.id === 'populist')!.build());
    expect(items.length).toBeGreaterThan(5);
    for (const c of items) expect(c.poll?.support ?? 0).toBeGreaterThanOrEqual(60);
  });

  it('every preset is detected after loading it', async () => {
    const { PRESETS, activePreset } = await import('./presets');
    for (const p of PRESETS) expect(activePreset(p.build())).toBe(p.id);
  });
});

describe('FairTax', () => {
  it('zeroes the replaced taxes, scores the sales tax, and restores current law when off', () => {
    const s = currentLaw(); s.multiplier = 0; s.inflationSensitivity = 0; s.marketFear = 0;
    setPolicy(s, 'fairtax', true);
    expect([s.ssRate, s.hiRate, s.corporateRate, s.estateRate, s.capGainsTopRate, Math.max(...s.brackets.rates)]).toEqual([0, 0, 0, 0, 0, 0]);
    const s0 = currentLaw(); s0.multiplier = 0; s0.inflationSensitivity = 0; s0.marketFear = 0;
    // Tax Policy Center: the advertised rate falls short by roughly $1T a year.
    const gap = computeBudget(s, base).deficit - computeBudget(s0, base).deficit;
    expect(gap).toBeGreaterThan(700);
    expect(gap).toBeLessThan(1100);
    setPolicy(s, 'fairtax', false);
    expect(s).toEqual(s0);
  });
});

describe('debt, inflation & headline proposals', () => {
  const b0 = computeBudget(base, base);
  it('a one-time item adds to year 1 only; a recurring one every year', () => {
    const s = currentLaw(); s.multiplier = 0; s.inflationSensitivity = 0; s.marketFear = 0; s.stimulusPerAdult = 5000;
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
    const s = currentLaw(); s.multiplier = 0; s.inflationSensitivity = 0; s.marketFear = 0; setPolicy(s, 'student_debt', true);
    const p = projection(computeBudget(s, base)), p0 = projection(b0);
    expect(p[1].deficit! - p0[1].deficit!).toBeCloseTo(400, 0);
    expect(p[3].deficit! - p0[3].deficit!).toBeLessThan(40);
  });
});

describe('economic feedback (fiscal multiplier)', () => {
  it('austerity with a high multiplier shrinks GDP, loses revenue and raises debt-to-GDP at first', async () => {
    const { PRESETS } = await import('./presets');
    const hawk = (m: number) => { const s = PRESETS.find((p) => p.id === 'hawk')!.build(); s.multiplier = m; s.inflationSensitivity = 0; s.marketFear = 0; return computeBudget(s, base); };
    const s0 = hawk(0), s15 = hawk(1.5);
    expect(s15.gdpGap).toBeLessThan(-0.05);
    expect(s15.deficit).toBeGreaterThan(s0.deficit + 300);
    expect(projection(s15)[1].debt / projection(s15)[1].gdp).toBeGreaterThan(projection(s0)[1].debt / projection(s0)[1].gdp);
  });
  it('defaults to 0.5; current law has no gap at any multiplier', () => {
    expect(currentLaw().multiplier).toBe(0.5);
    const s = currentLaw(); s.multiplier = 1.5;
    const b = computeBudget(s, base);
    expect(b.gdpGap).toBeCloseTo(0, 9);
    expect(b.deficit).toBeCloseTo(computeBudget(base, base).deficit, 6);
  });
  it('stimulus with a multiplier boosts GDP and claws back some revenue', () => {
    // Multiplier channel only: inflation and rate feedback are tested separately.
    const s = currentLaw(); s.stimulusPerAdult = 2000; s.inflationSensitivity = 0; s.marketFear = 0;
    const st = computeBudget(s, base).deficit;
    s.multiplier = 1;
    const b = computeBudget(s, base);
    expect(b.gdpGap).toBeGreaterThan(0);
    expect(b.deficit).toBeLessThan(st);
  });
});

describe('money flows', () => {
  it('money in equals money out, with and without a surplus', async () => {
    const { budgetFlows } = await import('./flows');
    const { PRESETS } = await import('./presets');
    for (const s of [base, ...PRESETS.map((p) => p.build())]) {
      const f = budgetFlows(computeBudget(s, base));
      const sum = (xs: { value: number }[]) => xs.reduce((a, x) => a + x.value, 0);
      expect(sum(f.inflows)).toBeCloseTo(sum(f.outflows), 6);
      expect(f.inflows.every((x) => x.value >= 0) && f.outflows.every((x) => x.value >= 0)).toBe(true);
    }
  });
});

describe('severity-scaled multiplier', () => {
  it('small changes use the slider value; big austerity scales up; the toggle hard-sets it', () => {
    const small = currentLaw(); small.programs.defense = 0.95;
    expect(computeBudget(small, base).multiplierUsed).toBeCloseTo(0.5, 9);
    const big = currentLaw(); for (const k of Object.keys(big.programs)) big.programs[k] = 0.6;
    const b = computeBudget(big, base);
    expect(b.multiplierUsed).toBeGreaterThan(1.0); // ~8% of GDP squeeze → ~1.1×
    expect(b.multiplierUsed).toBeLessThanOrEqual(2);
    big.multiplierScales = false;
    expect(computeBudget(big, base).multiplierUsed).toBeCloseTo(0.5, 9);
  });
});

describe('economic shock', () => {
  it('a crash cuts revenue ~2.5x as much as GDP and shows in the GDP gap', () => {
    const s = currentLaw(); s.gdpShock = -0.06;
    const b = computeBudget(s, base), b0 = computeBudget(base, base);
    expect(b.gdpGap).toBeCloseTo(-0.06, 6);
    expect(1 - b.totalReceipts / b0.totalReceipts).toBeCloseTo(0.15, 6);
  });
});

describe('households feel inflation and recessions', () => {
  it('Doomsday leaves working households worse off despite the checks', async () => {
    const { applyConditions } = await import('./presets');
    const s = applyConditions(currentLaw(), 'doomsday');
    const b = computeBudget(s, base);
    const macro = { gdpGap: b.gdpGap, inflationShock: b.inflationShock };
    for (const id of ['working_family', 'median', 'professional']) {
      const a = arch(id);
      expect(computeHousehold(a, s, macro).net).toBeLessThan(computeHousehold(a, base).net);
    }
    const ret = computeHousehold(arch('retirees'), s, macro);
    expect(-ret.inflationCost).toBeLessThan(0.05 * ret.totalIncome); // Social Security is indexed
  });
  it('current law has no inflation or recession effect', () => {
    const r = computeHousehold(arch('median'), base);
    expect(r.inflationCost).toBe(-0);
    expect(r.recessionPay).toBe(0);
  });
});

describe('policy presets vs market conditions', () => {
  it('are independent and detected from the scenario', async () => {
    const { applyPreset, applyConditions, activePreset, activeConditions } = await import('./presets');
    let s = currentLaw();
    expect([activePreset(s), activeConditions(s)]).toEqual(['current', 'today']);
    s = applyConditions(s, 'doomsday');
    s = applyPreset(s, 'balanced');
    expect([activePreset(s), activeConditions(s)]).toEqual(['balanced', 'doomsday']);
    s = applyConditions(s, 'boom');
    expect(activePreset(s)).toBe('balanced');
    s.programs.defense = 0.5;
    expect([activePreset(s), activeConditions(s)]).toEqual([null, 'boom']);
    s.rateShock = 0.011;
    expect(activeConditions(s)).toBeNull();
  });
});

describe('historical economies', () => {
  it('busts raise debt-to-GDP, booms lower it, relative to today', async () => {
    const { applyConditions, CONDITIONS } = await import('./presets');
    const d10 = (id: string) => computeOutcomes(computeBudget(applyConditions(currentLaw(), id), base)).debtToGdp10;
    const now = d10('today');
    for (const id of ['depression', 'volcker', 'doomsday']) expect(d10(id)).toBeGreaterThan(now);
    for (const id of ['roaring20s', 'boom', 'nineties', 'nominal']) expect(d10(id)).toBeLessThan(now);
    // Great Recession: a deep first-year hole, but a decade of near-zero rates holds interest down (as in the 2010s).
    expect(Math.abs(d10('great_recession') - now)).toBeLessThan(0.06);
    // Stagflation: big deficits, but ~8.7% inflation with negative real rates erodes the debt (as in the 1970s).
    expect(d10('stagflation')).toBeLessThan(now);
    // WWII: capped rates plus inflation shrink the debt ratio (financial repression).
    expect(d10('wwii')).toBeLessThan(now - 0.1);
    expect(CONDITIONS.length).toBe(14);
  });
});

describe('new headline switches', () => {
  it('opposites turn each other off; restore-all includes the EV credits', () => {
    const s = currentLaw(); s.multiplier = 0; s.inflationSensitivity = 0; s.marketFear = 0;
    setPolicy(s, 'repeal_clean', true);
    setPolicy(s, 'restore_clean', true);
    expect(s.policies.repeal_clean).toBe(false);
    setPolicy(s, 'carbon25', true); setPolicy(s, 'carbon_dividend', true);
    expect(s.policies.carbon25).toBe(false);
    setPolicy(s, 'ev_restore', true);
    const both = computeBudget(s, base).deficit;
    setPolicy(s, 'ev_restore', false);
    expect(computeBudget(s, base).deficit).toBeCloseTo(both, 6);
  });
  it('every switch moves the static deficit by exactly its score', async () => {
    const { policies } = await import('./data');
    const { policyDelta } = await import('./policies');
    const s0 = currentLaw(); s0.multiplier = 0; s0.inflationSensitivity = 0; s0.marketFear = 0;
    const d0 = computeBudget(s0, base).deficit;
    for (const p of policies.filter((x) => x.id !== 'obbba_rollback' && !x.setsSliders)) {
      const s = currentLaw(); s.multiplier = 0; s.inflationSensitivity = 0; s.marketFear = 0; setPolicy(s, p.id, true);
      expect(d0 - computeBudget(s, base).deficit).toBeCloseTo(policyDelta(p), 6);
    }
  });
});

describe('popularity', () => {
  it('averages support over polled changes only', async () => {
    const { popularity, polls } = await import('./popularity');
    expect(popularity(currentLaw()).approval).toBeNull();
    const s = currentLaw();
    setPolicy(s, 'drug_neg', true);
    expect(popularity(s).approval).toBe(polls.drug_neg.support);
    setPolicy(s, 'gold_card', true); // no poll
    const p = popularity(s);
    expect([p.counted, p.total]).toEqual([1, 2]);
    s.programs.social_security = 0.9;
    expect(popularity(s).approval).toBeCloseTo((polls.drug_neg.support + polls['program:social_security:down'].support) / 2, 9);
  });
  it('ignores switches folded into the Big Beautiful Bill rollback', async () => {
    const { changes } = await import('./popularity');
    const s = currentLaw();
    setPolicy(s, 'tips_ot_repeal', true); setPolicy(s, 'obbba_rollback', true);
    expect(changes(s).map((c) => c.key)).toEqual(['obbba_rollback']);
  });
});

describe('enforceProgressive', () => {
  it('raising a lower bracket lifts the higher ones', () => {
    expect(enforceProgressive([0.1, 0.5, 0.22, 0.24, 0.6], 1)).toEqual([0.1, 0.5, 0.5, 0.5, 0.6]);
  });
  it('lowering the top drops the lower ones', () => {
    expect(enforceProgressive([0.1, 0.12, 0.22, 0.24, 0.15], 4)).toEqual([0.1, 0.12, 0.15, 0.15, 0.15]);
  });
  it('leaves an already progressive schedule alone', () => {
    expect(enforceProgressive([0.1, 0.12, 0.22], 1)).toEqual([0.1, 0.12, 0.22]);
  });
});

describe('abolish Social Security', () => {
  it('zeroes benefits and the payroll tax, and restores them when excluded', async () => {
    const { popularity } = await import('./popularity');
    const scn = currentLaw();
    setPolicy(scn, 'abolish_ss', true);
    expect(scn.programs.social_security).toBe(0);
    expect(scn.ssRate).toBe(0);
    expect(popularity(scn)).toMatchObject({ approval: 6, counted: 1, total: 1 });
    const b = computeBudget(scn, base);
    expect(b.deficit).toBeLessThan(b.baseDeficit);
    setPolicy(scn, 'fra70', true);
    expect(scn.policies.abolish_ss).toBe(false);
    expect(scn.programs.social_security).toBe(1);
    expect(scn.ssRate).toBe(currentLaw().ssRate);
  });
});

describe('inflation and interest-rate feedback', () => {
  const run = (f: (s: ReturnType<typeof currentLaw>) => void) => { const s = currentLaw(); f(s); return computeBudget(s, base); };
  it('leaves current law calibrated to the FY2026 actuals', () => {
    const b = run(() => {});
    expect(b.deficit).toBeCloseTo(b.baseDeficit, 6);
    expect([b.inflationShock, b.premium]).toEqual([0, 0]);
  });
  it('loosening raises inflation, short and long rates; tightening lowers them', () => {
    const loose = run((s) => { s.stimulusPerAdult = 3000; s.stimulusRecurring = true; });
    expect(loose.inflationShock).toBeGreaterThan(0.002);
    expect(loose.yields.y2).toBeGreaterThan(computeBudget(base, base).yields.y2);
    expect(loose.premium).toBeGreaterThan(0);
    const tight = run((s) => { s.programs.nondefense = 0.6; s.programs.defense = 0.7; });
    expect(tight.premium).toBeLessThan(0);
    expect(tight.netInterest).toBeLessThan(computeBudget(base, base).netInterest);
  });
  it('keeps the risk premium inside its caps', () => {
    const huge = run((s) => { s.stimulusPerAdult = 20000; s.stimulusRecurring = true; s.marketFear = 3; });
    expect(huge.fiscalPremium).toBeLessThanOrEqual(manual.macro.premiumCap + 1e-9);
    expect(huge.inflationRiskPremium).toBeLessThanOrEqual(manual.macro.inflationRiskCap + 1e-9);
    const cuts = run((s) => { for (const k of Object.keys(s.programs)) s.programs[k] = 0.3; s.marketFear = 3; });
    expect(cuts.fiscalPremium).toBeGreaterThanOrEqual(manual.macro.premiumFloor - 1e-9);
  });
  it('Smoot-Hawley tariffs lift prices about 1% at once', () => {
    const b = run((s) => { s.multiplier = 0; setPolicy(s, 'smoot_hawley', true); });
    expect(b.priceBump).toBeCloseTo(0.011, 6);
  });
  it('turning both settings off removes the feedback', () => {
    const b = run((s) => { s.inflationSensitivity = 0; s.marketFear = 0; s.stimulusPerAdult = 3000; });
    expect([b.policyInflation, b.premium]).toEqual([0, 0]);
  });
  it('the average rate on the debt drifts up toward CBO projected yields at current law', () => {
    const p = projection(computeBudget(base, base));
    expect(p[1].rate!).toBeGreaterThan(manual.netInterestB.value / p[0].debt);
    expect(p.at(-1)!.rate!).toBeGreaterThan(0.037);
    expect(p.at(-1)!.rate!).toBeLessThan(0.045);
  });
  it('flags a spiral in doomsday with stressed markets, not for the hawk in normal times', async () => {
    const { PRESETS, applyConditions } = await import('./presets');
    const hawk = computeOutcomes(computeBudget(PRESETS.find((p) => p.id === 'hawk')!.build(), base));
    expect(hawk.spiral).toBe('falling');
    const doom = computeOutcomes(computeBudget(applyConditions(currentLaw(), 'doomsday'), base));
    expect(doom.spiral).toBe('spiral');
  });
});

describe('overlapping switches', () => {
  it('lets you pick one wealth-or-minimum tax', () => {
    const s = currentLaw();
    setPolicy(s, 'billionaire_min_tax', true); setPolicy(s, 'buffett_rule', true);
    expect([s.policies.billionaire_min_tax, s.policies.buffett_rule]).toEqual([false, true]);
    setPolicy(s, 'wealth_sanders', true);
    expect([s.policies.wealth_sanders, s.policies.buffett_rule]).toEqual([true, false]);
    setPolicy(s, 'billionaire_min_tax', true);
    expect([s.policies.wealth_sanders, s.policies.billionaire_min_tax]).toEqual([false, true]);

  });
});

describe('forced austerity', () => {
  it('hurts the same hawk plan far more than austerity by choice', async () => {
    const { PRESETS, applyConditions } = await import('./presets');
    const hawk = PRESETS.find((p) => p.id === 'hawk')!.build();
    const chosen = computeBudget(hawk, base), forced = computeBudget(applyConditions(hawk, 'forced_austerity'), base);
    expect(forced.multiplierUsed).toBeGreaterThan(1);
    expect(forced.deficit).toBeGreaterThan(chosen.deficit + 500);
    expect(computeOutcomes(forced).debtToGdp10).toBeGreaterThan(computeOutcomes(chosen).debtToGdp10 + 0.1);
  });
});

describe('fuel-tax sliders', () => {
  const at = (gas: number, diesel = manual.fuelTax.dieselCents) => {
    const s = currentLaw(); Object.assign(s, { multiplier: 0, inflationSensitivity: 0, marketFear: 0, gasTaxCents: gas, dieselTaxCents: diesel });
    return computeBudget(s, base).deficit;
  };
  const d0 = at(manual.fuelTax.gasCents);
  it('match CBO: +15 cents of gas tax raises ~$22B, +50 cents ~$65B', () => {
    expect(d0 - at(manual.fuelTax.gasCents + 15)).toBeCloseTo(21.4, 0);
    expect(d0 - at(manual.fuelTax.gasCents + 50)).toBeGreaterThan(62);
    expect(d0 - at(manual.fuelTax.gasCents + 50)).toBeLessThan(68);
  });
  it('dropping the diesel tax costs ~$11B', () => {
    expect(at(manual.fuelTax.gasCents, 0) - d0).toBeCloseTo(10.7, 0);
  });
});

describe('inflation <-> market fear links', () => {
  const run = (f: (s: ReturnType<typeof currentLaw>) => void) => { const s = currentLaw(); f(s); return computeBudget(s, base); };
  it('high inflation adds an inflation risk premium only when markets are fearful', () => {
    expect(run((s) => { s.inflationShock = 0.04; }).inflationRiskPremium).toBeGreaterThan(0.005);
    expect(run((s) => { s.inflationShock = 0.04; s.marketFear = 0; }).inflationRiskPremium).toBe(0);
  });
  it('a big fiscal premium lifts inflation (fiscal dominance) when inflation is sensitive', () => {
    const loose = (sens: number) => run((s) => { s.stimulusPerAdult = 6000; s.stimulusRecurring = true; s.marketFear = 3; s.inflationSensitivity = sens; });
    expect(loose(1).dominanceInflation).toBeGreaterThan(0.001);
    expect(loose(0).dominanceInflation).toBe(0);
  });
});

describe('monetary regimes', () => {
  const run = (id: string, f: (s: ReturnType<typeof currentLaw>) => void = () => {}) => { const s = currentLaw(); s.monetary = id; f(s); const b = computeBudget(s, base); return { b, o: computeOutcomes(b) }; };
  const fed = run('fed');
  it("today's Fed leaves current law calibrated", () => {
    expect(fed.b.deficit).toBeCloseTo(fed.b.baseDeficit, 6);
  });
  it('gold standard: no inflation to erode the debt, so debt-to-GDP ends higher', () => {
    const g = run('gold');
    expect(g.b.inflationShock).toBeLessThan(-0.02);
    expect(g.o.debtToGdp10).toBeGreaterThan(fed.o.debtToGdp10);
  });
  it('yield-curve control caps the 10-yr', () => {
    expect(run('ycc', (s) => { s.inflationShock = 0.05; }).b.yields.y10).toBeLessThanOrEqual(0.04 + 1e-12);
  });
  it('Fed-financed deficits cut interest but raise inflation', () => {
    const big = (id: string) => run(id, (s) => { s.stimulusPerAdult = 6000; s.stimulusRecurring = true; });
    const m = big('mmt'), f = big('fed');
    expect(m.b.inflationShock).toBeGreaterThan(f.b.inflationShock);
    expect(projection(m.b).at(-1)!.interest!).toBeLessThan(projection(f.b).at(-1)!.interest!);
  });
  it('a stablecoin boom barely moves the budget', () => {
    expect(Math.abs(run('stablecoin').b.deficit - fed.b.deficit)).toBeLessThan(15);
  });
  it('losing reserve status raises yields and interest', () => {
    const r = run('reserve_loss');
    expect(r.b.yields.y10).toBeGreaterThan(fed.b.yields.y10 + 0.005);
    expect(r.o.debtToGdp10).toBeGreaterThan(fed.o.debtToGdp10);
  });
});

describe('CBO calibration', () => {
  it("current law's 10-year outlook lands near CBO's February 2026 baseline (120% of GDP, ~$2.1T interest)", () => {
    const p = projection(computeBudget(base, base)).at(-1)!;
    expect(p.debt / p.gdp).toBeGreaterThan(1.15);
    expect(p.debt / p.gdp).toBeLessThan(1.28);
    expect(p.interest!).toBeGreaterThan(1900);
    expect(p.interest!).toBeLessThan(2400);
  });
});

describe('share-link sanitizing', () => {
  it('round-trips every preset and economy unchanged, so real shared links keep working', async () => {
    const { PRESETS, CONDITIONS, applyConditions } = await import('./presets');
    for (const p of PRESETS) {
      const s = p.build();
      expect(sanitizeScenario(JSON.parse(JSON.stringify(s)))).toEqual(s);
    }
    for (const c of CONDITIONS) {
      const s = applyConditions(currentLaw(), c.id);
      expect(sanitizeScenario(JSON.parse(JSON.stringify(s)))).toEqual(s);
    }
  });
  it('clamps absurd values and drops junk', () => {
    const s = sanitizeScenario({
      corporateRate: 5, ssRate: 'lots', multiplier: NaN, programs: { defense: -3, made_up: 9 }, policies: { m4a: 'yes', fake: true, vat5: true },
      monetary: 'bitcoin', brackets: { rates: [0.1, 7], single: [0, -5], mfjRatio: [2, 2] }, __proto__: { polluted: true },
    })!;
    expect(s.corporateRate).toBe(0.6);
    expect(s.ssRate).toBe(currentLaw().ssRate);
    expect(s.multiplier).toBe(currentLaw().multiplier);
    expect(s.programs.defense).toBe(0);
    expect('made_up' in s.programs).toBe(false);
    expect([s.policies.m4a, s.policies.vat5, 'fake' in s.policies]).toEqual([false, true, false]);
    expect(s.monetary).toBe('fed');
    expect(s.brackets).toEqual(currentLaw().brackets);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('rejects non-objects', () => {
    for (const v of [null, 3, 'x', [1, 2]]) expect(sanitizeScenario(v)).toBeNull();
  });
});
