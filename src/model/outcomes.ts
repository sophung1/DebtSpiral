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

export function computeOutcomes(b: Budget): Outcomes {
  const gdp = manual.gdpB.value;
  const g = manual.nominalGdpGrowth;
  const debt0 = live.debtHeldByPublicB.value;
  const r = b.netInterest / debt0;
  const primary = b.deficit - b.netInterest; // primary deficit (+) / surplus (−)

  // Hold the primary balance constant as a share of GDP; interest accrues on the remaining debt.
  const project = (years: number) => {
    let d = debt0, y = gdp;
    for (let t = 0; t < years; t++) {
      d += d * r + primary * (y / gdp);
      y *= 1 + g;
    }
    return { d, y };
  };

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

  const p10 = project(10);
  return {
    balanced: b.deficit <= 0,
    deficitPctGdp: b.deficit / gdp,
    primaryDeficit: primary,
    payoffYears,
    ceilingMonths,
    debtToGdpNow: debt0 / gdp,
    debtToGdp10: p10.d / p10.y,
    interestShareOfRevenue: b.netInterest / b.totalReceipts,
    inflationToHoldRatio,
    inflationErosionNow,
  };
}
