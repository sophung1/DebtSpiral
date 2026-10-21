import { currentLaw, setPolicy, type Scenario } from './scenario';

/** Economic conditions, separate from policy: these fields are set by the Economy picker, the rest by policy presets. */
export const CONDITION_KEYS = ['rateShock', 'inflationShock', 'realGrowth', 'gdpShock', 'multiplier'] as const;
type ConditionKey = (typeof CONDITION_KEYS)[number];
export type Conditions = Pick<Scenario, ConditionKey>;

export const conditionsOf = (s: Scenario): Conditions =>
  Object.fromEntries(CONDITION_KEYS.map((k) => [k, s[k]])) as Conditions;

export interface Condition { id: string; name: string; blurb: string; values: Conditions }

/** Today's conditions (the default). */
const NOMINAL = conditionsOf(currentLaw());

// Baseline inflation is ~2.2%, so an episode's inflation shock = its inflation − 2.2 pts. Growth, inflation and
// rates are decade averages (the charts apply them for 10 years); "this year" uses the episode's worst/best year.
const ep = (v: Partial<Conditions>): Conditions => ({ ...NOMINAL, ...v });

export const CONDITIONS: Condition[] = [
  { id: 'today', name: 'Current (today)', values: NOMINAL,
    blurb: 'Today\'s actual conditions: 10-yr yield ~5.1% (high by historical standards), ~1.8% real growth, ~2.2% inflation, normal feedback (0.5×).' },
  { id: 'nominal', name: 'Nominal (normal times)', values: ep({ rateShock: -0.01, inflationShock: -0.002 }),
    blurb: 'A calm long-run economy like CBO\'s long-term projections: 10-yr yield ~4.1% (1 pt below today), 2% inflation, 1.8% real growth, no boom or bust.' },
  { id: 'roaring20s', name: "Roaring '20s (1922–29)", values: ep({ realGrowth: 0.045, inflationShock: -0.022, rateShock: -0.01, gdpShock: 0.02 }),
    blurb: '~4.5% real growth with flat prices (no inflation), slightly lower rates, the economy 2% above normal. Flat prices mean no inflation erodes the debt.' },
  { id: 'depression', name: 'Great Depression (1930s)', values: ep({ realGrowth: 0.01, inflationShock: -0.042, rateShock: -0.01, gdpShock: -0.1, multiplier: 1.5 }),
    blurb: 'GDP 10% below normal this year (it actually fell ~26% by 1933, beyond this model), ~1%/yr growth over the decade, prices falling ~2%/yr on average (deflation makes the debt heavier), and high multipliers (1.5×) with rates near zero.' },
  { id: 'boom', name: 'Post-war boom (1950s–60s)', values: ep({ realGrowth: 0.04, inflationShock: 0.015, rateShock: -0.02, gdpShock: 0.02 }),
    blurb: '4% real growth, ~3.7% inflation, interest rates held 2 pts lower (financial repression), the economy 2% above normal. After WWII this took debt from ~106% to ~25% of GDP, but back then the budget ran primary surpluses.' },
  { id: 'stagflation', name: "'70s stagflation (1973–82)", values: ep({ realGrowth: 0.02, inflationShock: 0.065, rateShock: 0.04, gdpShock: -0.02, multiplier: 0.7 }),
    blurb: '~2% growth, ~8.7% average inflation, 10-yr yields ~4 pts above today, and the 1974–75 recession (GDP 2% below normal).' },
  { id: 'volcker', name: 'Volcker shock (1980–82)', values: ep({ realGrowth: 0.025, inflationShock: 0.035, rateShock: 0.06, gdpShock: -0.03, multiplier: 0.8 }),
    blurb: 'The Fed pushed rates to ~15% to break inflation: 10-yr yields ~6 pts above today, a double-dip recession (GDP 3% below normal), then a decade of ~3% growth with inflation falling from 13% to ~4% (~5.7% average).' },
  { id: 'nineties', name: "'90s boom (1995–2000)", values: ep({ realGrowth: 0.04, inflationShock: 0.003, rateShock: 0.01, gdpShock: 0.02 }),
    blurb: '4% real growth from the tech/productivity boom, ~2.5% inflation, rates a bit above today. Booming revenue plus spending restraint produced the last balanced budgets (1998–2001).' },
  { id: 'great_recession', name: 'Great Recession (2008–09)', values: ep({ realGrowth: 0.014, inflationShock: -0.005, rateShock: -0.025, gdpShock: -0.06, multiplier: 1 }),
    blurb: 'GDP ~6% below normal and revenue collapsing, then a slow ~1.4%/yr recovery with ~1.7% inflation. Rates fell ~2.5 pts as the Fed cut to zero, which is also why multipliers were high (1×).' },
  { id: 'covid', name: 'COVID shock (2020)', values: ep({ realGrowth: 0.025, inflationShock: 0, rateShock: -0.02, gdpShock: -0.04, multiplier: 1 }),
    blurb: 'A sharp, short collapse (GDP ~4% below normal for the year) with rates cut to near zero, then a fast rebound (~2.5% growth).' },
  { id: 'inflation2021', name: '2021–22 inflation surge', values: ep({ realGrowth: 0.02, inflationShock: 0.025, rateShock: 0.01, gdpShock: 0.01 }),
    blurb: 'Prices jump (inflation peaked ~9%; ~4.7% averaged over 2021–24), rates rise after them, and the economy runs a little hot.' },
  { id: 'doomsday', name: 'Doomsday (hypothetical)', values: ep({ rateShock: 0.03, inflationShock: 0.05, realGrowth: -0.015, gdpShock: -0.06, multiplier: 1.5 }),
    blurb: 'Everything at once: 1970s-style inflation (+5 pts/yr), 10-yr yields near 8% (+3 pts), a 2009-sized crash, then a lost decade (−1.5%/yr), with Greece-level feedback (1.5×). Add your own emergency response on top.' },
];

const policyOf = (s: Scenario) => { const p: Partial<Scenario> = { ...s }; for (const k of CONDITION_KEYS) delete p[k]; return p; };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Which policy preset the scenario matches ('current' = current law), or null if it's been customized. */
export function activePreset(s: Scenario): string | null {
  if (same(policyOf(s), policyOf(currentLaw()))) return 'current';
  return PRESETS.find((p) => same(policyOf(s), policyOf(p.build())))?.id ?? null;
}

/** Which economic conditions the scenario matches, or null if customized. */
export function activeConditions(s: Scenario): string | null {
  return CONDITIONS.find((c) => same(conditionsOf(s), c.values))?.id ?? null;
}

/** Load a policy preset but keep the current economic conditions. */
export function applyPreset(current: Scenario, id: string): Scenario {
  const next = id === 'current' ? currentLaw() : PRESETS.find((p) => p.id === id)!.build();
  return { ...next, ...conditionsOf(current) };
}

/** Change the economic conditions but keep the current policies. */
export function applyConditions(current: Scenario, id: string): Scenario {
  return { ...current, ...CONDITIONS.find((c) => c.id === id)!.values };
}

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
    blurb: 'Close the whole deficit in one year with broad spending cuts plus a VAT and higher top rates. Assumes a normal economy (0.5× feedback, no severity scaling).',
    build: make((s) => {
      s.multiplierScales = false;
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
