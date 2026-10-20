import { manual, live, programs } from './data';
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
  /** one-time real erosion of fixed-rate debt from +1pt surprise inflation ($B) */
  inflationErosion: number;
  /** first-year added cost of that inflation: repricing interest, TIPS accrual, indexed benefits ($B) */
  inflationCost: number;
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

  // +1 point of unexpected inflation for one year.
  const dc = manual.debtComposition;
  const inflationErosion = 0.01 * debt0 * (1 - dc.billsShare - dc.tipsShare);
  const indexed = programs.filter((p) => dc.indexedPrograms.includes(p.id)).reduce((a, p) => a + p.baselineB, 0);
  const inflationCost = 0.01 * (debt0 * (manual.rateRepricingShareYear1 + dc.tipsShare) + indexed);

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
    inflationErosion,
    inflationCost,
  };
}
