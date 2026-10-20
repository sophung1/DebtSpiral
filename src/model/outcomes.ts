import { manual, live } from './data';
import type { Budget } from './budget';

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
}

export const START_FY = 2026;

/**
 * Path from end-of-FY2026 debt, with the plan in force from FY2027.
 * - The recurring primary balance is held constant as a share of GDP; one-time items count in year 1 only.
 * - Extra inflation raises nominal GDP growth at once, but interest catches up as the debt reprices:
 *   the repricing share starts at `repricing1` and reaches 100% over the debt's average maturity.
 */
export function projection(b: Budget, years = 10): YearPoint[] {
  const gdp0 = manual.gdpB.value;
  const g = b.nominalGrowth;
  const maturity = manual.debtComposition.avgMaturityYears;
  let d = live.debtHeldByPublicB.value, y = gdp0;
  const r0 = (b.netInterest - b.inflationInterest) / d;
  const primary = b.deficit - b.netInterest - b.oneTime - b.feedbackB;
  const fade = (t: number) => Math.pow(manual.feedback.persistence, t - 1);
  const pts: YearPoint[] = [{ fy: START_FY, debt: d, gdp: y, deficit: null, interest: null }];
  for (let t = 1; t <= years; t++) {
    const k = Math.min(1, b.repricing1 + ((t - 1) * (1 - b.repricing1)) / maturity);
    const interest = d * (r0 + b.inflationShock * k);
    // The multiplier's GDP gap and its revenue loss fade over time.
    const deficit = interest + (primary + b.feedbackB * fade(t)) * (y / gdp0) + (t === 1 ? b.oneTime : 0);
    d += deficit;
    y *= 1 + g;
    pts.push({ fy: START_FY + t, debt: d, gdp: y * (1 + b.gdpGap * fade(t)), deficit, interest });
  }
  return pts;
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

  const p10 = projection(b).at(-1)!;
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
  };
}
