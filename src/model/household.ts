import { tax, manual, type Archetype } from './data';
import { thresholds, lawFor, type Scenario } from './scenario';
import { activePolicies } from './policies';
import { scheduleTax } from './incomeTax';

export interface HouseholdResult {
  /** income tax before the Child Tax Credit */
  incomeTax: number;
  /** income tax after the nonrefundable CTC (what's actually owed) */
  incomeTaxOwed: number;
  /** part of the CTC that offsets income tax (rest is a refund) */
  ctcNonrefundable: number;
  payrollTax: number;
  benefits: Record<string, number>;
  policyEffect: number;
  /** real purchasing power lost to extra inflation this year (−) */
  inflationCost: number;
  /** average pay lost (−) or gained (+) from the GDP gap */
  recessionPay: number;
  totalIncome: number;
  /** benefits + policy effects − taxes */
  net: number;
}

function taxableSS(ss: number, otherIncome: number, filing: 'single' | 'mfj'): number {
  if (ss <= 0) return 0;
  const [b1, b2] = filing === 'mfj' ? [32000, 44000] : [25000, 34000];
  const pi = otherIncome + ss / 2;
  if (pi <= b1) return 0;
  if (pi <= b2) return Math.min(ss / 2, (pi - b1) / 2);
  return Math.min(0.85 * ss, 0.85 * (pi - b2) + Math.min((b2 - b1) / 2, ss / 2));
}

export function eitc(h: Archetype, agi: number, factor: number): number {
  const p = tax.eitc.byKids[Math.min(h.kids, 3)];
  const start = tax.eitc.phaseoutStart[h.filing][Math.min(h.kids, 3)];
  const earned = h.wages;
  if (h.kids === 0 && h.over65 > 0) return 0;
  const credit = Math.min(earned, p.earnedAmount) * p.rate - p.phaseoutRate * Math.max(0, Math.max(agi, earned) - start);
  return Math.max(0, credit) * factor;
}

export interface Macro { gdpGap: number; inflationShock: number }

export function computeHousehold(h: Archetype, scn: Scenario, macro: Macro = { gdpGap: 0, inflationShock: 0 }): HouseholdResult {
  const f = h.filing;
  const other = h.wages + h.pension + h.capitalGains;
  const ssTaxable = taxableSS(h.socialSecurity, other, f);
  const ordinary = h.wages + h.pension + ssTaxable;
  const agi = ordinary + h.capitalGains;

  const law = lawFor(scn);
  const sb = tax.seniorBonus;
  const senior = law.seniorBonus ? h.over65 * Math.max(0, sb.perPerson - sb.phaseoutRate * Math.max(0, agi - sb.phaseoutStart[f])) : 0;
  const exemptions = law.personalExemption * ((f === 'mfj' ? 2 : 1) + h.kids);
  const deduction = law.std[f] + h.over65 * tax.over65Extra[f] + senior + exemptions;
  const tiOrd = Math.max(0, ordinary - deduction);
  const tiCg = Math.max(0, h.capitalGains - Math.max(0, deduction - ordinary));

  let incomeTax = scheduleTax(tiOrd, thresholds(scn.brackets, f), scn.brackets.rates);
  // Capital gains stack on top of ordinary income.
  const cg = tax.capitalGains;
  const cgRates = [cg.rates[0], cg.rates[1], scn.capGainsTopRate];
  incomeTax += scheduleTax(tiOrd + tiCg, cg[f], cgRates) - scheduleTax(tiOrd, cg[f], cgRates);
  incomeTax += cg.niitRate * Math.min(h.capitalGains, Math.max(0, agi - cg.niitThreshold[f]));

  // Child Tax Credit
  const c = law.ctc;
  const ctcFactor = scn.programs.ctc ?? 1;
  const ctcTotal = Math.max(0, h.kids * c.perChild * ctcFactor - c.phaseoutPer1000 * Math.ceil(Math.max(0, agi - c.phaseoutStart[f]) / 1000));
  const nonref = Math.min(ctcTotal, incomeTax);
  const refundable = Math.min(ctcTotal - nonref, h.kids * c.refundableMax * ctcFactor, c.refundableRate * Math.max(0, h.wages - c.earnedFloor));

  // Employee share of payroll taxes.
  const p = tax.payroll;
  const earners = f === 'mfj' && h.wages > 0 ? 2 : 1;
  const perEarner = h.wages / earners;
  const cap = scn.ssWageBase ?? Infinity;
  const payrollTax = earners * Math.min(perEarner, cap) * (scn.ssRate / 2)
    + h.wages * (scn.hiRate / 2)
    + p.addlHiRate * Math.max(0, h.wages - p.addlHiThreshold[f]);

  const benefits: Record<string, number> = {};
  for (const [id, amt] of Object.entries(h.benefits)) benefits[id] = amt * (scn.programs[id] ?? 1);
  const e = eitc(h, agi, scn.programs.eitc ?? 1);
  if (e > 0) benefits.eitc = e;
  if (nonref + refundable > 0) benefits.ctc = nonref + refundable;
  if (scn.stimulusPerAdult > 0) benefits.stimulus = scn.stimulusPerAdult * (f === 'mfj' ? 2 : 1);

  const fuelCost = (manual.fuelTax.gasHouseholdPerCent as Record<string, number>)[h.id] ?? 0;
  const policyEffect = activePolicies(scn).reduce((a, pol) => a + (pol.households[h.id] ?? 0), 0)
    + fuelCost * (scn.gasTaxCents - manual.fuelTax.gasCents);
  const benefitTotal = Object.values(benefits).reduce((a, b) => a + b, 0);
  // Macro effects: extra inflation erodes spendable cash income (Social Security is COLA-indexed and health
  // coverage isn't cash, so both are excluded); a GDP gap moves average pay.
  const spendable = Math.max(0, h.wages + h.pension + h.capitalGains - (incomeTax - nonref) - payrollTax);
  const inflationCost = -macro.inflationShock * spendable;
  const recessionPay = macro.gdpGap * manual.feedback.wageLossPerGdpGap * h.wages;
  const net = benefitTotal + policyEffect - incomeTax - payrollTax + inflationCost + recessionPay;
  return { incomeTax, incomeTaxOwed: incomeTax - nonref, ctcNonrefundable: nonref, payrollTax, benefits, policyEffect, inflationCost, recessionPay, totalIncome: agi + h.socialSecurity - ssTaxable, net };
}
