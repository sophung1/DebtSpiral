import { manual, live, programs } from './data';
import { activePolicies, policyDelta, ctcLawFactor } from './policies';
import type { Scenario } from './scenario';
import { BILLS, TIPS, NOTES_ROLL1, YIELDS0, policyInflation, fiscalPremium, yields } from './macro';
import {
  individualOrdinaryReceipts, payrollSSReceipts, capitalGainsReceipts, corporateReceipts, estateReceipts,
} from './incomeTax';

export interface Line { id: string; label: string; value: number; base: number }

export interface Budget {
  receipts: Line[];
  outlays: Line[];
  policyLines: { id: string; label: string; value: number }[];
  netInterest: number;
  /** part of net interest caused by extra inflation this year ($B) */
  inflationInterest: number;
  /** share of the debt repricing with inflation in year 1 (bills, rollovers, TIPS) */
  repricing1: number;
  /** total extra inflation this year vs the ~2.2% baseline: slider + policy-driven + price-level bump (decimal) */
  inflationShock: number;
  /** the slider's part of it (persists in the outlook) */
  inflationSlider: number;
  /** policy-driven part from the GDP gap (fades in the outlook) */
  policyInflation: number;
  /** one-time price-level jump from switches like tariffs */
  priceBump: number;
  /** fiscal risk premium on long yields this year (decimal) */
  premium: number;
  /** market yields this year under the plan */
  yields: { y2: number; y10: number; y30: number };
  /** settings and inputs the outlook reuses */
  rateShock: number;
  realGrowth: number;
  inflationSensitivity: number;
  marketFear: number;
  /** policy part of the GDP gap (the outside shock excluded) */
  policyGap: number;
  /** revenue lost to the outside GDP shock this year ($B; markets treat it as cyclical) */
  cyclicalB: number;
  /** nominal GDP growth for the outlook: real growth + baseline inflation + extra inflation */
  nominalGrowth: number;
  /** GDP gap from the multiplier this year (−0.03 = GDP 3% below trend) */
  gdpGap: number;
  /** multiplier actually applied (after severity scaling) */
  multiplierUsed: number;
  /** revenue lost (+) or gained (−) from that GDP gap ($B), already in the receipt lines */
  feedbackB: number;
  /** one-time items in this year's deficit, which the 10-year outlook doesn't repeat ($B; + = cost) */
  oneTime: number;
  totalReceipts: number;
  totalOutlays: number;
  /** positive = deficit */
  deficit: number;
  baseDeficit: number;
}

const R = manual.receipts;

export function programOutlay(id: string, factor: number): number {
  const p = programs.find((x) => x.id === id)!;
  return p.baselineB + (p.fullCostB ?? p.baselineB) * (factor - 1);
}

const debt0 = () => live.debtHeldByPublicB.value;

/** Share of the debt whose cost follows inflation in year 1: maturing/rolling debt plus TIPS. */
export const repricingShare = () => manual.rateRepricingShareYear1 + manual.debtComposition.tipsShare;

export const baselineInflation = manual.nominalGdpGrowth - manual.realGdpGrowth;

/** This year's net interest: today's cost plus bills repricing at the new short rate, maturing notes at the new
 *  long rate, and TIPS principal growing with extra inflation. */
export const netInterestAt = (y: { y2: number; y10: number }, dPi: number) =>
  manual.netInterestB.value + debt0() * (BILLS * (y.y2 - YIELDS0.y2) + NOTES_ROLL1 * (y.y10 - YIELDS0.y10) + TIPS * dPi);

export const stimulusOutlay = (scn: Scenario) => (scn.stimulusPerAdult * manual.stimulus.adultsM) / 1000;

export function computeBudget(scn: Scenario, base: Scenario): Budget {
  const rec = (id: keyof typeof R, value: number): Line => ({ id, label: R[id].label, value, base: R[id].value });
  const receipts: Line[] = [
    rec('individualOrdinary', individualOrdinaryReceipts(scn, base)),
    rec('capitalGains', capitalGainsReceipts(scn, base)),
    rec('payrollSS', payrollSSReceipts(scn, base)),
    rec('payrollHI', R.payrollHI.value * (scn.hiRate / base.hiRate)),
    rec('payrollOther', R.payrollOther.value),
    rec('corporate', corporateReceipts(scn, base)),
    rec('customs', R.customs.value),
    rec('excise', R.excise.value),
    rec('estate', estateReceipts(scn, base)),
    rec('other', R.other.value),
  ];
  const outlays: Line[] = programs.map((p) => ({
    id: p.id, label: p.name, base: p.baselineB,
    value: programOutlay(p.id, (scn.programs[p.id] ?? 1) * (p.id === 'ctc' ? ctcLawFactor(scn) : 1)),
  }));
  outlays.push({ id: 'stimulus', label: 'Stimulus checks', value: stimulusOutlay(scn), base: 0 });

  const active = activePolicies(scn);
  const policyLines = active.map((p) => ({ id: p.id, label: p.label, value: policyDelta(p) }));
  const oneTime = (scn.stimulusRecurring ? 0 : stimulusOutlay(scn)) - active.filter((p) => p.oneTime).reduce((a, p) => a + policyDelta(p), 0);
  const policyNet = policyLines.reduce((a, p) => a + p.value, 0);

  const sum = (ls: Line[], k: 'value' | 'base') => ls.reduce((a, l) => a + l[k], 0);

  // Economic feedback: tightening the primary (non-interest) balance shrinks GDP by multiplier × tightening,
  // and every tax line falls with GDP. Static scoring when the multiplier is 0.
  const primaryChange = (sum(outlays, 'value') - sum(receipts, 'value') - policyNet)
    - (sum(outlays, 'base') - sum(receipts, 'base'));
  const fb = manual.feedback;
  const tightening = -primaryChange / manual.gdpB.value; // share of GDP; + = austerity
  const multiplierUsed = scn.multiplierScales && scn.multiplier > 0
    ? Math.min(fb.maxMultiplier, scn.multiplier + fb.severitySlope * Math.max(0, tightening - fb.severityThreshold))
    : scn.multiplier;
  const policyGap = (multiplierUsed * primaryChange) / manual.gdpB.value;
  const gdpGap = policyGap + scn.gdpShock;
  const staticReceipts = sum(receipts, 'value');
  // A crash hits revenue harder than policy-driven slowdowns (capital gains and profits collapse).
  for (const r of receipts) r.value *= Math.max(0, 1 + fb.revenueElasticity * policyGap + fb.shockRevenueElasticity * scn.gdpShock);
  const totalReceipts = sum(receipts, 'value');
  const cyclicalB = -staticReceipts * fb.shockRevenueElasticity * scn.gdpShock;

  // Inflation: the slider, plus demand from the plan (Phillips curve), plus one-time price jumps (tariffs).
  const policyPi = policyInflation(policyGap, scn.inflationSensitivity);
  const priceBump = scn.inflationSensitivity > 0 ? active.reduce((a, p) => a + (p.priceLevelPts ?? 0), 0) : 0;
  const dPi = scn.inflationShock + policyPi + priceBump;

  // Rates and the deficit feed each other through the fiscal risk premium: solve for the fixed point.
  const nonInterest = sum(outlays, 'value');
  const baseDeficit = sum(outlays, 'base') + manual.netInterestB.value - sum(receipts, 'base');
  const endoPi = policyPi + priceBump;
  let premium = 0, y = yields(scn.inflationShock, endoPi, policyGap, 0, scn.rateShock), ni = netInterestAt(y, dPi);
  for (let i = 0; i < 30; i++) {
    const deficit = nonInterest + ni - totalReceipts - policyNet;
    const next = fiscalPremium(scn.marketFear, (deficit - cyclicalB - baseDeficit) / manual.gdpB.value, 0);
    y = yields(scn.inflationShock, endoPi, policyGap, next, scn.rateShock);
    ni = netInterestAt(y, dPi);
    if (Math.abs(next - premium) < 1e-7) { premium = next; break; }
    premium = next;
  }
  outlays.splice(outlays.length - 1, 0, { id: 'net_interest', label: 'Net interest', value: ni, base: manual.netInterestB.value });
  const totalOutlays = sum(outlays, 'value');
  return {
    receipts, outlays, policyLines, netInterest: ni, totalReceipts, totalOutlays, oneTime,
    inflationInterest: netInterestAt(y, dPi) - netInterestAt(yields(0, 0, policyGap, premium, scn.rateShock), 0),
    repricing1: repricingShare(), inflationShock: dPi, inflationSlider: scn.inflationShock, policyInflation: policyPi, priceBump,
    premium, yields: y, rateShock: scn.rateShock, realGrowth: scn.realGrowth,
    inflationSensitivity: scn.inflationSensitivity, marketFear: scn.marketFear, policyGap, cyclicalB,
    nominalGrowth: scn.realGrowth + baselineInflation + dPi,
    gdpGap, multiplierUsed, feedbackB: staticReceipts - totalReceipts,
    deficit: totalOutlays - totalReceipts - policyNet,
    baseDeficit,
  };
}
