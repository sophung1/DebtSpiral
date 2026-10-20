import { tax, programs, policies } from './data';

export interface BracketSchedule {
  rates: number[];
  /** Single-filer thresholds; MFJ thresholds = single × mfjRatio. */
  single: number[];
  mfjRatio: number[];
}

export interface Scenario {
  brackets: BracketSchedule;
  capGainsTopRate: number;
  ssRate: number;
  /** null = no cap */
  ssWageBase: number | null;
  hiRate: number;
  corporateRate: number;
  estateRate: number;
  estateExemption: number;
  /** multiplier on each program's benefit level (1 = current law) */
  programs: Record<string, number>;
  policies: Record<string, boolean>;
  /** change in market interest rates, decimal (0.01 = +1pp) */
  rateShock: number;
  behavioral: boolean;
}

const schedule = (b: { rates: number[]; single: number[]; mfj: number[] }): BracketSchedule => ({
  rates: [...b.rates],
  single: [...b.single],
  mfjRatio: b.single.map((s, i) => (s === 0 ? 2 : b.mfj[i] / s)),
});

type Filing = 'single' | 'mfj';
export interface TaxLaw {
  std: Record<Filing, number>;
  personalExemption: number;
  /** average exemptions claimed per return, for the aggregate model */
  avgExemptions: Record<Filing, number>;
  ctc: typeof tax.ctc;
  seniorBonus: boolean;
}

const CURRENT_LAW: TaxLaw = {
  std: tax.stdDeduction, personalExemption: 0, avgExemptions: { single: 0, mfj: 0 }, ctc: tax.ctc, seniorBonus: true,
};
const pre = tax.preObbba;
const PRE_OBBBA_LAW: TaxLaw = {
  std: pre.stdDeduction, personalExemption: pre.personalExemption, avgExemptions: pre.avgExemptionsPerReturn, ctc: pre.ctc, seniorBonus: pre.seniorBonus,
};

/** Tax law in force for a scenario: the 2025 law, or pre-2025 law if the rollback switch is on. */
export const lawFor = (scn: Scenario): TaxLaw => (scn.policies.obbba_rollback ? PRE_OBBBA_LAW : CURRENT_LAW);

/** Flip a policy switch. The OBBBA rollback also swaps the bracket schedule to that law's. */
export function setPolicy(s: Scenario, id: string, on: boolean) {
  s.policies[id] = on;
  if (id === 'obbba_rollback') s.brackets = schedule(on ? pre.brackets : tax.brackets);
}

export function currentLaw(): Scenario {
  return {
    brackets: schedule(tax.brackets),
    capGainsTopRate: tax.capitalGains.rates[2],
    ssRate: tax.payroll.ssRate,
    ssWageBase: tax.payroll.ssWageBase,
    hiRate: tax.payroll.hiRate,
    corporateRate: tax.corporateRate,
    estateRate: tax.estate.rate,
    estateExemption: tax.estate.exemption,
    programs: Object.fromEntries(programs.map((p) => [p.id, 1])),
    policies: Object.fromEntries(policies.map((p) => [p.id, false])),
    rateShock: 0,
    behavioral: false,
  };
}

export function thresholds(s: BracketSchedule, filing: 'single' | 'mfj'): number[] {
  return filing === 'single' ? s.single : s.single.map((t, i) => Math.round(t * s.mfjRatio[i]));
}
