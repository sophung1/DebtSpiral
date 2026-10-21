import { currentLaw, setPolicy, type Scenario } from './scenario';

/** Economic conditions, separate from policy: these fields are set by the Economy picker, the rest by policy presets. */
export const CONDITION_KEYS = ['rateShock', 'inflationShock', 'realGrowth', 'gdpShock', 'multiplier', 'inflationSensitivity', 'marketFear'] as const;
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
  { id: 'nominal', name: 'Nominal (normal times)', values: ep({ rateShock: -0.008, inflationShock: -0.002 }),
    blurb: 'A calm long-run economy like CBO\'s long-term projections: 10-yr yield ~4.1% (1 pt below today), 2% inflation, 1.8% real growth, no boom or bust.' },
  { id: 'roaring20s', name: "Roaring '20s (1922–29)", values: ep({ realGrowth: 0.045, inflationShock: -0.022, rateShock: 0.012, gdpShock: 0.02 }),
    blurb: '~4.5% real growth with flat prices (no inflation), slightly lower rates, the economy 2% above normal. Flat prices mean no inflation erodes the debt.' },
  { id: 'depression', name: 'Great Depression (1930s)', values: ep({ inflationSensitivity: 0.5, realGrowth: 0.01, inflationShock: -0.042, rateShock: 0.032, gdpShock: -0.1, multiplier: 1.5 }),
    blurb: 'GDP 10% below normal this year (it actually fell ~26% by 1933, beyond this model), ~1%/yr growth over the decade, prices falling ~2%/yr on average (deflation makes the debt heavier), and high multipliers (1.5×) with rates near zero.' },
  { id: 'boom', name: 'Post-war boom (1950s–60s)', values: ep({ realGrowth: 0.04, inflationShock: 0.015, rateShock: -0.0386, gdpShock: 0.02 }),
    blurb: '4% real growth, ~3.7% inflation, interest rates held 2 pts lower (financial repression), the economy 2% above normal. After WWII this took debt from ~106% to ~25% of GDP, but back then the budget ran primary surpluses.' },
  { id: 'stagflation', name: "'70s stagflation (1973–82)", values: ep({ inflationSensitivity: 2, marketFear: 1.5, realGrowth: 0.02, inflationShock: 0.065, rateShock: -0.0529, gdpShock: -0.02, multiplier: 0.7 }),
    blurb: '~2% growth, ~8.7% average inflation, 10-yr yields ~4 pts above today, and the 1974–75 recession (GDP 2% below normal).' },
  { id: 'volcker', name: 'Volcker shock (1980–82)', values: ep({ marketFear: 2, realGrowth: 0.025, inflationShock: 0.035, rateShock: 0.0058, gdpShock: -0.03, multiplier: 0.8 }),
    blurb: 'The Fed pushed rates to ~15% to break inflation: 10-yr yields ~6 pts above today, a double-dip recession (GDP 3% below normal), then a decade of ~3% growth with inflation falling from 13% to ~4% (~5.7% average).' },
  { id: 'nineties', name: "'90s boom (1995–2000)", values: ep({ realGrowth: 0.04, inflationShock: 0.003, rateShock: 0.007, gdpShock: 0.02 }),
    blurb: '4% real growth from the tech/productivity boom, ~2.5% inflation, rates a bit above today. Booming revenue plus spending restraint produced the last balanced budgets (1998–2001).' },
  { id: 'great_recession', name: 'Great Recession (2008–09)', values: ep({ inflationSensitivity: 0.5, realGrowth: 0.014, inflationShock: -0.005, rateShock: -0.02, gdpShock: -0.06, multiplier: 1 }),
    blurb: 'GDP ~6% below normal and revenue collapsing, then a slow ~1.4%/yr recovery with ~1.7% inflation. Rates fell ~2.5 pts as the Fed cut to zero, which is also why multipliers were high (1×).' },
  { id: 'covid', name: 'COVID shock (2020)', values: ep({ realGrowth: 0.025, inflationShock: 0, rateShock: -0.02, gdpShock: -0.04, multiplier: 1 }),
    blurb: 'A sharp, short collapse (GDP ~4% below normal for the year) with rates cut to near zero, then a fast rebound (~2.5% growth).' },
  { id: 'inflation2021', name: '2021–22 inflation surge', values: ep({ inflationSensitivity: 2, realGrowth: 0.02, inflationShock: 0.025, rateShock: -0.0216, gdpShock: 0.01 }),
    blurb: 'Prices jump (inflation peaked ~9%; ~4.7% averaged over 2021–24), rates rise after them, and the economy runs a little hot.' },
  { id: 'wwii', name: 'WWII wartime economy (1942–45)', values: ep({ marketFear: 0, inflationSensitivity: 0.5, realGrowth: 0.04, inflationShock: 0.045, rateShock: -0.071, gdpShock: 0.04, multiplier: 0.7 }),
    blurb: 'The economy running flat out, ~6.7% average inflation over 1942–48 despite price controls and rationing (dampened 0.5× here), and the Fed pegging the 10-yr near 2.5%, so real rates were deeply negative and markets couldn\'t price in fear. Wartime spending itself is policy: raise the defense slider yourself (it peaked at ~37% of GDP, ~12× today). Debt rose from ~45% to ~106% of GDP, then fell through growth, inflation and the rate cap.' },
  { id: 'forced_austerity', name: 'Forced austerity (debt crisis)', values: ep({ marketFear: 3, rateShock: 0.02, gdpShock: -0.03, multiplier: 1.2 }),
    blurb: 'Bond markets force cuts in the middle of a crisis (Greece 2010, the UK in 2022): real rates already 2 pts higher with markets panicking (3× fear), the economy 3% below normal, and a high multiplier (1.2×) because the Fed can\'t offset the cuts. Pair it with Fiscal hawk to see austerity by force vs. by choice.' },
  { id: 'doomsday', name: 'Doomsday (hypothetical)', values: ep({ inflationSensitivity: 2, marketFear: 3, rateShock: -0.05, inflationShock: 0.05, realGrowth: -0.015, gdpShock: -0.06, multiplier: 1.5 }),
    blurb: 'Everything at once: 1970s-style inflation (+5 pts/yr), 10-yr yields near 8% (+3 pts), a 2009-sized crash, then a lost decade (−1.5%/yr), with Greece-level feedback (1.5×). Add your own emergency response on top.' },
];

const policyOf = (s: Scenario) => { const p: Partial<Scenario> = { ...s }; for (const k of CONDITION_KEYS) delete p[k]; delete p.monetary; return p; };
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
  return { ...next, ...conditionsOf(current), monetary: current.monetary };
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
  /** a past era's policies applied to today's economy (grouped separately in the picker) */
  era?: boolean;
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

// Rates as a list, lowest bracket first (7 brackets).
const rates = (s: Scenario, r: number[]) => { s.brackets.rates = r; };
/** A whole bracket schedule: [single-filer threshold in today's dollars, rate] rows, plus the married/single threshold ratio. */
const sched = (s: Scenario, rows: [number, number][], mfj: number | number[]) => {
  s.brackets = { single: rows.map((r) => r[0]), rates: rows.map((r) => r[1]), mfjRatio: rows.map((_, i) => (Array.isArray(mfj) ? mfj[i] : mfj)) };
};
// Era presets: that era's tax code (thresholds inflation-adjusted to 2026 dollars) and discretionary spending at its share
// of GDP, applied to today's economy. Social Security, Medicare and Medicaid stay as they are today.
// Today: defense ≈ 3.0% of GDP, non-defense discretionary ≈ 2.8%.

export const PRESETS: Preset[] = [
  {
    id: 'era_hoover',
    era: true,
    name: 'Hoover, 1930–32',
    blurb: "Smoot-Hawley tariffs (~20% on all imports) plus the 1932 Revenue Act, which raised the top rate from 25% to 63% to balance the budget in a depression, applied to today. A 13.75% corporate rate and 12.5% on long-held capital gains. Economists' consensus: the tariffs deepened the Depression through retaliation (not modeled here) but the Fed and the gold standard caused most of it; the 1932 tax hike was austerity in a slump. Then only ~5% of households paid income tax; here today's deductions apply.",
    build: make((s) => {
      on(s, 'smoot_hawley');
      sched(s, [[0, 0.04], [92000, 0.08], [230000, 0.13], [460000, 0.20], [1150000, 0.39], [2300000, 0.56], [23000000, 0.63]], 1);
      s.corporateRate = 0.1375;
      s.capGainsTopRate = 0.125;
      s.estateRate = 0.45;
      s.estateExemption = 1150000;
    }),
  },
  {
    id: 'era_eisenhower',
    era: true,
    name: 'Eisenhower, 1953–60',
    blurb: "The 1950s tax code applied to today: 20% bottom rate, 91% over ~$2.3M (married couples split income, so their brackets were double), 52% corporate, 25% capital gains, 77% estate tax over ~$690K. Defense at its 1950s level of ~9.6% of GDP (Korea and the Cold War), lean domestic spending, and an Interstate-Highway-style infrastructure push. Reality check: almost nobody paid 91% (the top 1% paid ~42% effective), and the 1950s debt drop came mostly from growth, inflation and capped interest rates.",
    build: make((s) => {
      on(s, 'renew_iija');
      sched(s, [[0, 0.20], [46000, 0.26], [92000, 0.34], [161000, 0.47], [253000, 0.59], [690000, 0.75], [2300000, 0.91]], 2);
      s.corporateRate = 0.52;
      s.capGainsTopRate = 0.25;
      s.estateRate = 0.77;
      s.estateExemption = 690000;
      progs(s, { defense: 3.2, nondefense: 0.72 });
    }),
  },
  {
    id: 'era_reagan',
    era: true,
    name: 'Reagan, 1981–88',
    blurb: "The 1988 tax code (after the 1981 cuts and the 1986 reform) applied to today: 15% and 28% brackets with a 33% 'bubble' in between, capital gains taxed like wages (28%), a 34% corporate rate, 55% estate tax over ~$1.6M. Defense at the buildup's ~5.8% of GDP. Domestic discretionary spending was cut, but even after the cuts it was ~4% of GDP, more than today's 2.8%. Reality check: deficits widened and debt-to-GDP rose from ~25% to ~40%; Volcker's rates, not the budget, broke inflation.",
    build: make((s) => {
      sched(s, [[0, 0.15], [48000, 0.28], [117000, 0.33], [243000, 0.28]], 1.67);
      s.corporateRate = 0.34;
      s.capGainsTopRate = 0.28;
      s.estateRate = 0.55;
      s.estateExemption = 1650000;
      progs(s, { defense: 1.93, nondefense: 1.4 });
    }),
  },
  {
    id: 'era_clinton',
    era: true,
    name: 'Clinton, 1993–2000',
    blurb: "The 1993 tax code applied to today: 15/28/31/36% brackets and 39.6% over ~$556K, a 35% corporate rate, 20% capital gains (after 1997), 55% estate tax over ~$1.3M. Defense at the post-Cold War ~3.4% of GDP, domestic spending ~3.3%, the 1997 Medicare payment cuts and 1996 welfare reform. Reality check: the 1998–2001 surpluses were roughly half policy and half the dot-com boom's capital-gains windfall.",
    build: make((s) => {
      sched(s, [[0, 0.15], [49000, 0.28], [119000, 0.31], [256000, 0.36], [556000, 0.396]], [1, 1.67, 1.67, 1.22, 1]);
      s.corporateRate = 0.35;
      s.capGainsTopRate = 0.20;
      s.estateRate = 0.55;
      s.estateExemption = 1300000;
      progs(s, { defense: 1.13, nondefense: 1.19, medicare: 0.95, snap: 0.88 });
    }),
  },
  {
    id: 'populist',
    name: 'Populist: only what polls 60%+',
    blurb: 'Every change here has majority support of 60% or more in national polls. It shows the catch: the popular menu tilts toward spending, so it does little for the deficit.',
    build: make((s) => {
      on(s, 'drug_neg', 'ss_means_test', 'enhanced_aca', 'renew_iija', 'childcare', 'wealth_sanders', 'carbon25', 'tariffs_repeal', 'immigration_reform', 'free_college');
      s.capGainsTopRate = 0.28;
      s.ssWageBase = 400000;
      s.corporateRate = 0.28;
      progs(s, { social_security: 1.1 });
    }),
  },
  {
    id: 'trump',
    name: 'Trump agenda',
    blurb: 'Tariffs stay, mass deportation, no tax on Social Security benefits, a $1.5T defense budget, abolish the Education Department, Gold Card visas, end foreign aid, Trump Accounts, no diesel tax, a $2,000 "tariff dividend" check, selling the Fannie/Freddie stakes, ending CHIPS subsidies, and the FY2026 budget request\'s ~23% cut to non-defense spending. No deficit target was claimed beyond "tariffs and growth".',
    build: make((s) => {
      on(s, 'mass_deportation', 'no_tax_ss', 'defense_15t', 'abolish_ed', 'gold_card', 'end_foreign_aid', 'trump_accounts', 'repeal_clean', 'gse_sale', 'chips_repeal');
      s.dieselTaxCents = 0;
      s.stimulusPerAdult = 2000; // the proposed $2,000 "tariff dividend" check
      progs(s, { nondefense: 0.77 });
    }),
  },
  {
    id: 'sanders',
    name: 'Progressive (Sanders)',
    blurb: 'Medicare for All, free public college, universal childcare, paid leave, a Green New Deal, infrastructure, housing, a $15 minimum wage and bigger Social Security checks, plus ending military aid to Israel and overseas bases. Paid for with Medicare for All premiums (an income-based payroll tax), a wealth tax, a billionaire minimum tax, a carbon tax, a financial transactions tax, no Social Security cap, higher top and corporate rates, and taxing capital gains like wages at the top. Claims to be paid for.',
    build: make((s) => {
      on(s, 'm4a', 'free_college', 'childcare', 'paid_leave', 'wealth_sanders', 'ftt', 'stepup', 'carried', 'obbba_rollback', 'drug_neg', 'irs_enforce', 'buyback_tax4', 'end_iorb', 'gnd_climate', 'renew_iija', 'housing_supply', 'min_wage15', 'end_israel_aid', 'fossil_breaks', 'close_bases', 'carbon25');
      rates(s, [0.10, 0.12, 0.22, 0.24, 0.37, 0.45, 0.52]);
      s.capGainsTopRate = 0.396;
      s.ssWageBase = null;
      // Medicare for All premiums: 7.5% employer + 4% household on income (wider than wages, so slightly more than 11.5 pts here)
      s.hiRate = 0.2;
      s.corporateRate = 0.35;
      s.estateRate = 0.65;
      s.estateExemption = 3.5e6;
      progs(s, { social_security: 1.1 });
    }),
  },
  {
    id: 'peoples_budget',
    name: "Progressive Caucus 'People's Budget'",
    blurb: "The House Progressive Caucus's recurring alternative budget (no 2025–26 edition yet; this follows its usual themes): higher rates above ~$250K, capital gains taxed like wages at the top, a 28% corporate rate, a carbon tax, a financial transactions tax and closing investor loopholes, paying for infrastructure, childcare, paid leave, the 2021 child credit, enhanced ACA subsidies and free public college, with a 10% smaller military. No Medicare for All, unlike the Sanders platform. Its scored editions cut deficits modestly (CRFB: ~$2.3T over 10 years); here it lands modestly below current law.",
    build: make((s) => {
      on(s, 'renew_iija', 'childcare', 'paid_leave', 'ctc_2021', 'enhanced_aca', 'drug_neg', 'free_college', 'carbon25', 'ftt', 'buyback_tax4', 'stepup', 'carried', 'irs_enforce');
      rates(s, [0.10, 0.12, 0.22, 0.24, 0.32, 0.39, 0.43]);
      s.capGainsTopRate = 0.396;
      s.corporateRate = 0.28;
      progs(s, { defense: 0.9 });
    }),
  },
  {
    id: 'rand_paul',
    name: "Rand Paul 'Six Penny Plan'",
    blurb: "Sen. Rand Paul's plan (reintroduced Sept 2025; rejected in the Senate with 35 Republicans in favor): cut 6 cents from every federal dollar each year for five years, sparing Social Security, with no tax changes. Shown fully phased in: everything except Social Security ~26% below today. Its goal is to balance the budget excluding Social Security (the dial's \"excl. SS\" figure). Here it falls short: cuts this big shrink the economy and with it tax revenue (the multiplier), which the plan's arithmetic leaves out.",
    build: make((s) => {
      const cut = 0.74;
      progs(s, { medicare: cut, medicaid: cut, aca: cut, snap: cut, eitc: cut, ssi: cut, unemployment: cut, veterans: cut, fed_retirement: cut, other_mandatory: cut, defense: cut, nondefense: cut });
    }),
  },
  {
    id: 'heritage',
    name: "Heritage 'Blueprint for Balance'",
    blurb: "The Heritage Foundation's annual plan (core of recent editions): Medicare premium support, an eligibility age of 67 and higher premiums for upper-income seniors, a Medicaid block grant and an end to the ACA expansion match, smaller ACA subsidies, retirement age 70 and chained-CPI COLAs, deep non-defense cuts (abolish the Education Department, end foreign aid, clean-energy credits and farm subsidies), slightly more defense, the 2025 tax cuts kept and the estate tax repealed. Heritage says it balances within ~10 years, partly through faster growth it expects from the plan; this model doesn't assume that growth.",
    build: make((s) => {
      on(s, 'medicare_premium_support', 'medicare67', 'medicaid_caps', 'fra70', 'chained_cpi', 'abolish_ed', 'end_foreign_aid', 'repeal_clean', 'farm', 'fed_pay');
      s.estateRate = 0;
      // Plus higher premiums for upper-income seniors and a unified Medicare deductible.
      progs(s, { medicare: 0.95, medicaid: 0.85, aca: 0.5, nondefense: 0.65, defense: 1.05 });
    }),
  },
  {
    id: 'simpson_bowles',
    name: 'Simpson-Bowles (2010)',
    blurb: "The bipartisan deficit commission's mix, scaled to today: about 3 dollars of cuts per 1 of revenue. Chained-CPI COLAs, a slowly rising retirement age, a higher Social Security cap, a 15¢ gas tax, trimmed tax breaks, and caps on defense and non-defense spending. Its target was a ~2.5–3% of GDP deficit.",
    build: make((s) => {
      on(s, 'chained_cpi', 'fra70', 'ma_bench', 'site_neutral', 'farm', 'fed_pay', 'salt10', 'stepup', 'carried', 'tips_ot_repeal', 'irs_enforce');
      s.gasTaxCents += 15;
      s.ssWageBase = 400000;
      progs(s, { defense: 0.8, nondefense: 0.7, medicare: 0.9, medicaid: 0.9, fed_retirement: 0.9, other_mandatory: 0.8 });
    }),
  },
  {
    id: 'balanced',
    name: 'Stabilize the debt',
    blurb: 'Get debt-to-GDP falling (~3% of GDP deficit) mostly through health reforms, a Social Security fix (no wage cap, +1 pt payroll tax, means-testing, retirement age 70), immigration reform and broadening the tax base, while still renewing infrastructure funding, with a modestly higher top rate and corporate rate. About half new revenue, half spending.',
    build: make((s) => {
      on(s, 'chained_cpi', 'fra70', 'ma_bench', 'site_neutral', 'drug_neg', 'irs_enforce', 'stepup', 'carried', 'salt10', 'tips_ot_repeal', 'farm', 'carbon25', 'ss_means_test', 'immigration_reform', 'end_iorb', 'buyback_tax4', 'renew_iija', 'billionaire_min_tax');
      s.gasTaxCents += 15;
      rates(s, [0.10, 0.12, 0.22, 0.24, 0.33, 0.39, 0.44]);
      s.capGainsTopRate = 0.28;
      s.ssWageBase = null; // no Social Security wage cap
      s.ssRate = 0.134; // +1 pt, split between worker and employer
      s.corporateRate = 0.25;
      progs(s, { defense: 0.95, nondefense: 0.92, medicare: 0.96 });
    }),
  },
  {
    id: 'hawk',
    name: 'Fiscal hawk: balance now',
    blurb: 'Close the whole deficit in one year: every targeted saving on the menu (means-tested Social Security, health payment reform, no overseas bases or foreign aid, no CHIPS or fossil breaks, a billionaire minimum tax), then broad spending cuts plus a VAT and higher top rates to finish the job. Assumes a normal economy (0.5× feedback, no severity scaling).',
    build: make((s) => {
      s.multiplierScales = false;
      on(s, 'vat5', 'carbon25', 'medicaid_caps', 'ma_bench', 'fra70', 'chained_cpi', 'drug_neg', 'farm', 'fed_pay', 'irs_enforce', 'salt10', 'tips_ot_repeal', 'ss_means_test', 'site_neutral', 'end_iorb', 'chips_repeal', 'close_bases', 'end_foreign_aid', 'fossil_breaks', 'buyback_tax4', 'stepup', 'carried', 'immigration_reform', 'gse_sale', 'billionaire_min_tax');
      s.brackets.rates = [0.10, 0.12, 0.24, 0.26, 0.35, 0.40, 0.45];
      s.ssWageBase = 400000;
      s.corporateRate = 0.25;
      progs(s, { medicare: 0.88, medicaid: 0.9, aca: 0.8, snap: 0.95, nondefense: 0.75, defense: 0.75, fed_retirement: 0.9, other_mandatory: 0.8 });
    }),
  },
];
