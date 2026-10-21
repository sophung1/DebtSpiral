import { tax, programs, policies, manual } from './data';

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
  /** persistent inflation above the baseline, decimal per year */
  inflationShock: number;
  /** real GDP growth per year for the 10-year outlook, decimal */
  realGrowth: number;
  /** fiscal multiplier: GDP change per $1 of primary-deficit change (0 = static scoring) */
  multiplier: number;
  /** raise the multiplier for large austerity (Greece effect) instead of using it as-is */
  multiplierScales: boolean;
  /** this year's GDP vs normal from outside events (crash/boom), decimal; fades like the multiplier gap */
  gdpShock: number;
  /** scales how much policy-driven demand raises inflation (0 = static, 1 = normal, 2 = tight economy) */
  inflationSensitivity: number;
  /** scales the bond market's fiscal risk premium (0 = off, 1 = normal, 3 = stressed) */
  marketFear: number;
  /** stimulus check per adult ($) */
  stimulusPerAdult: number;
  /** repeat the check every year (UBI-style) instead of once */
  stimulusRecurring: boolean;
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
  const abolished = !!s.policies.abolish_ss, fair = !!s.policies.fairtax;
  s.policies[id] = on;
  if (on) {
    // Opposites can't both be on: turn off anything this excludes, or that excludes this.
    const self = policies.find((p) => p.id === id);
    for (const p of policies) if (self?.excludes?.includes(p.id) || p.excludes?.includes(id)) s.policies[p.id] = false;
  }
  if (id === 'obbba_rollback') s.brackets = schedule(on ? pre.brackets : tax.brackets);
  // Abolishing Social Security zeroes its benefits and payroll tax; switching it off (directly or via an exclusion) restores them.
  if (abolished !== !!s.policies.abolish_ss) {
    s.programs.social_security = s.policies.abolish_ss ? 0 : 1;
    s.ssRate = s.policies.abolish_ss ? 0 : tax.payroll.ssRate;
  }
  // The FairTax zeroes every income, payroll, corporate and estate tax (its sales tax is the switch's score).
  if (fair !== !!s.policies.fairtax) {
    const law = currentLaw(), off = !s.policies.fairtax;
    s.brackets.rates = off ? law.brackets.rates : s.brackets.rates.map(() => 0);
    s.capGainsTopRate = off ? law.capGainsTopRate : 0;
    s.ssRate = off ? law.ssRate : 0;
    s.hiRate = off ? law.hiRate : 0;
    s.corporateRate = off ? law.corporateRate : 0;
    s.estateRate = off ? law.estateRate : 0;
  }
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
    inflationShock: 0,
    realGrowth: manual.realGdpGrowth,
    multiplier: manual.feedback.defaultMultiplier,
    multiplierScales: true,
    gdpShock: 0,
    inflationSensitivity: 1,
    marketFear: 1,
    stimulusPerAdult: 0,
    stimulusRecurring: false,
    behavioral: false,
  };
}

export function thresholds(s: BracketSchedule, filing: 'single' | 'mfj'): number[] {
  return filing === 'single' ? s.single : s.single.map((t, i) => Math.round(t * s.mfjRatio[i]));
}

/** After bracket `i` changes, push neighbors so rates never fall as income rises (higher brackets up, lower ones down). */
export function enforceProgressive(rates: number[], i: number): number[] {
  return rates.map((r, j) => (j > i ? Math.max(r, rates[i]) : j < i ? Math.min(r, rates[i]) : r));
}
