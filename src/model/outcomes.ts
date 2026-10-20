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
 * Ten-year path from end-of-FY2026 debt, with the plan in force from FY2027. The primary balance is held
 * constant as a share of GDP; interest accrues on the remaining debt at the scenario's effective rate.
 */
export function projection(b: Budget, years = 10): YearPoint[] {
  const gdp0 = manual.gdpB.value;
  const g = manual.nominalGdpGrowth;
  let d = live.debtHeldByPublicB.value, y = gdp0;
  const r = b.netInterest / d;
  const primary = b.deficit - b.netInterest;
  const pts: YearPoint[] = [{ fy: START_FY, debt: d, gdp: y, deficit: null, interest: null }];
  for (let t = 1; t <= years; t++) {
    const interest = d * r;
    const deficit = interest + primary * (y / gdp0);
    d += deficit;
    y *= 1 + g;
    pts.push({ fy: START_FY + t, debt: d, gdp: y, deficit, interest });
  }
  return pts;
}

export function computeOutcomes(b: Budget): Outcomes {
  const gdp = manual.gdpB.value;
  const g = manual.nominalGdpGrowth;
  const debt0 = live.debtHeldByPublicB.value;
  const r = b.netInterest / debt0;
  const primary = b.deficit - b.netInterest; // primary deficit (+) / surplus (−)


  let payoffYears: number | null = null;
  if (b.deficit <= 0) {
    let d = debt0, y = gdp, t = 0;
    while (d > 0 && t < 200) {
      d += d * r + primary * (y / gdp);
      y *= 1 + g;
      t++;
    }
    payoffYears = d <= 0 ? t : Infinity;
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
  const inflationToHoldRatio = (b.deficit / debt0 - g) / (1 - k);
  const inflationErosionNow = (g - manual.realGdpGrowth) * debt0;

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
