import { manual, live, programs } from './data';
import { activePolicies, policyDelta, ctcLawFactor } from './policies';
import type { Scenario } from './scenario';
import {
  individualOrdinaryReceipts, payrollSSReceipts, capitalGainsReceipts, corporateReceipts, estateReceipts,
} from './incomeTax';

export interface Line { id: string; label: string; value: number; base: number }

export interface Budget {
  receipts: Line[];
  outlays: Line[];
  policyLines: { id: string; label: string; value: number }[];
  netInterest: number;
  /** part of net interest caused by the inflation slider ($B) */
  inflationInterest: number;
  /** share of the debt repricing with inflation in year 1 (bills, rollovers, TIPS) */
  repricing1: number;
  inflationShock: number;
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

export const inflationInterest = (scn: Scenario) => scn.inflationShock * repricingShare() * debt0();

export function netInterest(scn: Scenario): number {
  return manual.netInterestB.value + scn.rateShock * manual.rateRepricingShareYear1 * debt0()
    + inflationInterest(scn);
}

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
  const ni = netInterest(scn);
  outlays.push({ id: 'net_interest', label: 'Net interest', value: ni, base: manual.netInterestB.value });
  outlays.push({ id: 'stimulus', label: 'Stimulus checks', value: stimulusOutlay(scn), base: 0 });

  const active = activePolicies(scn);
  const policyLines = active.map((p) => ({ id: p.id, label: p.label, value: policyDelta(p) }));
  const oneTime = (scn.stimulusRecurring ? 0 : stimulusOutlay(scn)) - active.filter((p) => p.oneTime).reduce((a, p) => a + policyDelta(p), 0);
  const policyNet = policyLines.reduce((a, p) => a + p.value, 0);

  const sum = (ls: Line[], k: 'value' | 'base') => ls.reduce((a, l) => a + l[k], 0);

  // Economic feedback: tightening the primary (non-interest) balance shrinks GDP by multiplier × tightening,
  // and every tax line falls with GDP. Static scoring when the multiplier is 0.
  const primaryChange = (sum(outlays, 'value') - ni - sum(receipts, 'value') - policyNet)
    - (sum(outlays, 'base') - manual.netInterestB.value - sum(receipts, 'base'));
  const fb = manual.feedback;
  const tightening = -primaryChange / manual.gdpB.value; // share of GDP; + = austerity
  const multiplierUsed = scn.multiplierScales && scn.multiplier > 0
    ? Math.min(fb.maxMultiplier, scn.multiplier + fb.severitySlope * Math.max(0, tightening - fb.severityThreshold))
    : scn.multiplier;
  const gdpGap = (multiplierUsed * primaryChange) / manual.gdpB.value;
  const staticReceipts = sum(receipts, 'value');
  for (const r of receipts) r.value *= 1 + manual.feedback.revenueElasticity * gdpGap;
  const totalReceipts = sum(receipts, 'value');
  const totalOutlays = sum(outlays, 'value');
  return {
    receipts, outlays, policyLines, netInterest: ni, totalReceipts, totalOutlays, oneTime,
    inflationInterest: inflationInterest(scn), repricing1: repricingShare(), inflationShock: scn.inflationShock,
    nominalGrowth: scn.realGrowth + baselineInflation + scn.inflationShock,
    gdpGap, multiplierUsed, feedbackB: staticReceipts - totalReceipts,
    deficit: totalOutlays - totalReceipts - policyNet,
    baseDeficit: sum(outlays, 'base') - sum(receipts, 'base'),
  };
}
