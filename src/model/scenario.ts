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

export function currentLaw(): Scenario {
  const b = tax.brackets;
  return {
    brackets: {
      rates: [...b.rates],
      single: [...b.single],
      mfjRatio: b.single.map((s, i) => (s === 0 ? 2 : b.mfj[i] / s)),
    },
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
