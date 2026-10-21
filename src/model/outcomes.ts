import { manual, live } from './data';
import { computeBudget, baselineInflation, type Budget } from './budget';
import { currentLaw } from './scenario';
import { BILLS, TIPS, NOTES_RATE0, policyInflation, fiscalPremium, yields, inflationRiskPremium, dominanceInflation } from './macro';
import { regimeOf } from './monetary';

export interface Outcomes {
  balanced: boolean;
  deficitPctGdp: number;
  primaryDeficit: number;
  /** years until public debt is paid off; null = never (deficit), Infinity = > 200 yrs */
  payoffYears: number | null;
  /** months until the statutory debt limit is hit; null = never (surplus) */
  ceilingMonths: number | null;
  debtToGdpNow: number;
  debtToGdp10: number;
  interestShareOfRevenue: number;
  /** extra surprise inflation per year needed just to hold debt-to-GDP flat (decimal; ≤ 0 = already falling) */
  inflationToHoldRatio: number;
  /** real debt value that today's baseline inflation already erodes each year ($B) */
  inflationErosionNow: number;
  /** debt dynamics over the outlook: falling, rising steadily, or a spiral (rate > growth, primary deficit, accelerating) */
  spiral: 'falling' | 'rising' | 'snowball' | 'spiral';
  /** fiscal risk premium on long yields in year 10 (decimal) */
  premium10: number;
  /** average rate on the debt vs nominal GDP growth in year 10 */
  rate10: number;
  growth10: number;
}

export interface YearPoint {
  /** fiscal year */
  fy: number;
  /** debt held by the public at year end ($B) */
  debt: number;
  gdp: number;
  /** null for the starting year (FY2026 actuals) */
  deficit: number | null;
  interest: number | null;
  /** average interest rate on the debt, new 2-yr and 10-yr yields, inflation and nominal GDP growth that year */
  rate: number | null;
  y2: number | null;
  y10: number | null;
  inflation: number | null;
  growth: number | null;
}

export const START_FY = 2026;

/**
 * Path from end-of-FY2026 debt, with the plan in force from FY2027.
 * - The recurring primary balance is held constant as a share of GDP, so it grows with prices; one-time items
 *   count in year 1 only.
 * - Inflation = baseline + the slider (persists) + policy-driven inflation (fades with the GDP gap) + any
 *   one-time price jump (year 1).
 * - Bills reprice at the 2-yr yield every year; notes and bonds roll over to the 10-yr yield across the
 *   average maturity, so the average rate drifts from today's ~3.2% toward market yields; TIPS add inflation.
 * - Long yields carry a fiscal risk premium for deficits and debt above the current-law path, set from last
 *   year's numbers. That loop is what can turn a rising debt into a spiral.
 */
export function projection(b: Budget, years = 10): YearPoint[] {
  const gdp0 = manual.gdpB.value;
  const maturity = manual.debtComposition.avgMaturityYears;
  let d = live.debtHeldByPublicB.value, y = gdp0, notes = NOTES_RATE0;
  const primary = b.deficit - b.netInterest - b.oneTime - b.feedbackB;
  const fade = (t: number) => Math.pow(manual.feedback.persistence, t - 1);
  const base = b.marketFear > 0 ? basePath(years) : null;
  let extraDeficit = 0, extraDebt = 0, prevDeficitShare = 0, monetized = 0;
  lastPremium = 0;
  const reg = regimeOf(b.monetary);
  const pts: YearPoint[] = [{ fy: START_FY, debt: d, gdp: y, deficit: null, interest: null, rate: null, y2: null, y10: null, inflation: null, growth: null }];
  for (let t = 1; t <= years; t++) {
    const gap = b.policyGap * fade(t);
    const fiscal = t === 1 ? b.fiscalPremium : fiscalPremium(b.marketFear, extraDeficit, extraDebt);
    const mon = t === 1 ? b.monetizedInflation
      : reg.monetizeAbove === null ? 0 : reg.monetizeInflation * Math.max(0, prevDeficitShare - reg.monetizeAbove);
    const endoPi = policyInflation(gap, b.inflationSensitivity) + (t === 1 ? b.priceBump : 0)
      + dominanceInflation(b.inflationSensitivity, fiscal) + mon;
    const dPi = b.inflationSlider + endoPi;
    const premium = fiscal + inflationRiskPremium(b.marketFear, baselineInflation + dPi - reg.targetShift);
    lastPremium = premium;
    const yl = yields(b.inflationSlider, endoPi, gap, premium, b.rateShock, reg);
    notes += (yl.y10 - notes) / maturity;
    const rate = BILLS * yl.y2 + (1 - BILLS) * notes + TIPS * dPi;
    // Debt the central bank financed with money carries no interest.
    const interest = Math.max(0, d - monetized) * rate;
    // The multiplier's GDP gap and its revenue loss fade over time.
    const deficit = interest + (primary + b.feedbackB * fade(t)) * (y / gdp0) + (t === 1 ? b.oneTime : 0);
    const growth = b.realGrowth + baselineInflation + dPi;
    if (reg.monetizeAbove !== null) monetized += Math.max(0, deficit - reg.monetizeAbove * y);
    prevDeficitShare = deficit / y;
    d += deficit;
    y *= 1 + growth;
    // Markets look at last year's structural deficit and debt (recession revenue losses are seen as cyclical).
    if (base) {
      extraDeficit = (deficit - b.cyclicalB * fade(t) * (y / gdp0)) / y - base[t].deficit;
      extraDebt = d / y - base[t].debt;
    }
    pts.push({ fy: START_FY + t, debt: d, gdp: y * (1 + b.gdpGap * fade(t)), deficit, interest, rate, y2: yl.y2, y10: yl.y10, inflation: baselineInflation + dPi, growth });
  }
  return pts;
}

/** Fiscal premium in the last year of the most recent projection (decimal). */
let lastPremium = 0;

/** Current-law deficit and debt as shares of GDP each year: the path markets already expect. */
let baseCache: { deficit: number; debt: number }[] | null = null;
function basePath(years: number) {
  if (!baseCache || baseCache.length <= years) {
    const law = currentLaw(); law.marketFear = 0;
    const pts = projection(computeBudget(law, currentLaw()), Math.max(years, 30));
    baseCache = pts.map((p) => ({ deficit: (p.deficit ?? 0) / p.gdp, debt: p.debt / p.gdp }));
  }
  return baseCache;
}

export function computeOutcomes(b: Budget): Outcomes {
  const gdp = manual.gdpB.value;
  const g = b.nominalGrowth - b.inflationShock; // growth without the surprise
  const debt0 = live.debtHeldByPublicB.value;
  const primary = b.deficit - b.netInterest; // primary deficit (+) / surplus (−)

  let payoffYears: number | null = null;
  if (b.deficit <= 0) {
    const t = projection(b, 200).findIndex((p) => p.debt <= 0);
    payoffYears = t > 0 ? t : Infinity;
  }

  let ceilingMonths: number | null = null;
  if (b.deficit > 0) {
    const headroom = live.debtLimitB.value - live.debtSubjectToLimitB.value;
    ceilingMonths = Math.max(0, headroom / (b.deficit / 12));
  }

  // Debt-to-GDP holds when deficit/debt ≤ nominal growth. Surprise inflation π adds π to nominal growth but
  // also π·debt·k to interest (k = debt repricing in year 1 + TIPS); the primary balance scales with prices.
  // k → 1 as the debt rolls over, so this year-1 figure is the best case.
  const k = manual.rateRepricingShareYear1 + manual.debtComposition.tipsShare;
  const inflationToHoldRatio = ((b.deficit - b.oneTime) / debt0 - g) / (1 - k);
  const inflationErosionNow = (manual.nominalGdpGrowth - manual.realGdpGrowth) * debt0;

  const path = projection(b);
  const premium10 = lastPremium;
  const p10 = path.at(-1)!;
  const ratio = (i: number) => path.at(i)!.debt / path.at(i)!.gdp;
  const [a, bb, c] = [ratio(-1) - ratio(-2), ratio(-2) - ratio(-3), ratio(-3) - ratio(-4)];
  const spiral: Outcomes['spiral'] = a <= 0 ? 'falling'
    : !(p10.rate! > p10.growth! && primary > 0 && a > bb && bb > c) ? 'rising'
    : premium10 >= 0.01 ? 'spiral' : 'snowball';
  return {
    balanced: b.deficit <= 0,
    deficitPctGdp: b.deficit / gdp,
    primaryDeficit: primary,
    payoffYears,
    ceilingMonths,
    debtToGdpNow: debt0 / gdp,
    debtToGdp10: p10.debt / p10.gdp,
    interestShareOfRevenue: b.netInterest / b.totalReceipts,
    inflationToHoldRatio,
    inflationErosionNow,
    spiral,
    rate10: p10.rate!,
    premium10,
    growth10: p10.growth!,
  };
}
