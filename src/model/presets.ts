import { currentLaw, setPolicy, type Scenario } from './scenario';

export interface Preset {
  id: string;
  name: string;
  blurb: string;
  build: () => Scenario;
}

// Presets include behavioral responses, so big rate changes aren't scored as pure static gains.
const make = (fn: (s: Scenario) => void) => () => {
  const s = currentLaw();
  s.behavioral = true;
  fn(s);
  return s;
};
const on = (s: Scenario, ...ids: string[]) => ids.forEach((id) => setPolicy(s, id, true));
const progs = (s: Scenario, f: Record<string, number>) => Object.assign(s.programs, f);

export const PRESETS: Preset[] = [
  {
    id: 'socialism',
    name: 'Total socialism',
    blurb: 'Much bigger safety net and health programs, paid for with very high top rates, a wealth tax and no Social Security cap.',
    build: make((s) => {
      on(s, 'obbba_rollback', 'wealth2', 'carbon25', 'stepup', 'carried', 'irs_enforce', 'ctc_2021', 'prek', 'enhanced_aca', 'drug_neg');
      s.brackets.rates = [0.10, 0.15, 0.25, 0.35, 0.45, 0.55, 0.70];
      s.capGainsTopRate = 0.396;
      s.ssWageBase = null;
      s.corporateRate = 0.35;
      s.estateRate = 0.65;
      s.estateExemption = 3.5e6;
      progs(s, { social_security: 1.15, medicare: 1.2, medicaid: 1.5, aca: 1.5, snap: 1.5, ssi: 1.5, unemployment: 1.5, eitc: 1.5, nondefense: 1.3, defense: 0.75 });
    }),
  },
  {
    id: 'libertarian',
    name: 'Libertarian minimal state',
    blurb: 'A low flat-ish income tax, no estate tax, no tariffs, and deep cuts to safety-net and discretionary programs.',
    build: make((s) => {
      on(s, 'tariffs_repeal', 'medicaid_caps', 'ma_bench', 'fra70', 'chained_cpi', 'farm', 'fed_pay');
      s.brackets.rates = [0.10, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
      s.capGainsTopRate = 0.15;
      s.corporateRate = 0.15;
      s.estateRate = 0;
      progs(s, { social_security: 0.9, medicaid: 0.6, aca: 0, snap: 0.5, ssi: 0.8, unemployment: 0.5, eitc: 0.5, ctc: 0.5, nondefense: 0.5, other_mandatory: 0.5, defense: 0.85 });
    }),
  },
  {
    id: 'hawk',
    name: 'Fiscal hawk: balance now',
    blurb: 'Close the whole deficit in one year on paper, with broad cuts plus a VAT and higher top rates. With economic feedback on, the slump it causes eats part of the savings (the Greece effect).',
    build: make((s) => {
      on(s, 'vat5', 'carbon25', 'medicaid_caps', 'ma_bench', 'fra70', 'chained_cpi', 'drug_neg', 'farm', 'fed_pay', 'irs_enforce', 'salt10', 'tips_ot_repeal');
      s.brackets.rates = [0.10, 0.12, 0.24, 0.26, 0.35, 0.40, 0.45];
      s.ssWageBase = 400000;
      s.corporateRate = 0.25;
      progs(s, { social_security: 0.88, medicare: 0.78, medicaid: 0.8, aca: 0.7, snap: 0.85, nondefense: 0.6, defense: 0.75, fed_retirement: 0.9, other_mandatory: 0.8 });
    }),
  },
  {
    id: 'balanced',
    name: 'Balanced plan',
    blurb: 'Roughly half new revenue, half spending restraint. Enough to put debt-to-GDP on a falling path without a shock.',
    build: make((s) => {
      on(s, 'chained_cpi', 'fra70', 'ma_bench', 'drug_neg', 'irs_enforce', 'stepup', 'carried', 'salt10', 'tips_ot_repeal', 'farm', 'carbon25', 'gas15');
      s.brackets.rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.37, 0.396];
      s.capGainsTopRate = 0.28;
      s.ssWageBase = 600000;
      s.corporateRate = 0.25;
      progs(s, { defense: 0.9, nondefense: 0.88, medicare: 0.97 });
    }),
  },
];
