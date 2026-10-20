import { manual, live, programs, policies } from './data';
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

export function netInterest(scn: Scenario): number {
  return manual.netInterestB.value + scn.rateShock * manual.rateRepricingShareYear1 * live.debtHeldByPublicB.value;
}

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
    id: p.id, label: p.name, value: programOutlay(p.id, scn.programs[p.id] ?? 1), base: p.baselineB,
  }));
  const ni = netInterest(scn);
  outlays.push({ id: 'net_interest', label: 'Net interest', value: ni, base: manual.netInterestB.value });

  const policyLines = policies.filter((p) => scn.policies[p.id]).map((p) => ({ id: p.id, label: p.label, value: p.deltaB }));
  const policyNet = policyLines.reduce((a, p) => a + p.value, 0);

  const sum = (ls: Line[], k: 'value' | 'base') => ls.reduce((a, l) => a + l[k], 0);
  const totalReceipts = sum(receipts, 'value');
  const totalOutlays = sum(outlays, 'value');
  return {
    receipts, outlays, policyLines, netInterest: ni, totalReceipts, totalOutlays,
    deficit: totalOutlays - totalReceipts - policyNet,
    baseDeficit: sum(outlays, 'base') - sum(receipts, 'base'),
  };
}
