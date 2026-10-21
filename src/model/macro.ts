import { manual, live } from './data';

/**
 * Inflation and interest-rate feedback. Policy-driven demand moves inflation (a convex Phillips curve), the Fed
 * moves short rates (Taylor rule), and bond markets move long rates with expected inflation and a fiscal risk
 * premium. Settings scale each channel: inflation sensitivity (0 = static) and market fear (0 = off).
 */
const M = manual.macro;

export const YIELDS0 = { y2: live.yield2y.value, y10: live.yield10y.value, y30: live.yield30y.value };
export const BILLS = manual.debtComposition.billsShare;
export const TIPS = manual.debtComposition.tipsShare;
/** Notes and bonds that mature and roll over in year 1 (total year-1 repricing minus bills). */
export const NOTES_ROLL1 = manual.rateRepricingShareYear1 - BILLS;
/** Average rate on the debt today, and the implied average on notes and bonds (bills already pay market rates). */
export const AVG_RATE0 = manual.netInterestB.value / live.debtHeldByPublicB.value;
export const NOTES_RATE0 = (AVG_RATE0 - BILLS * YIELDS0.y2) / (1 - BILLS);

/** Extra inflation from a policy GDP gap (+ = economy running hot). */
export const policyInflation = (gap: number, sensitivity: number) =>
  sensitivity * (gap > 0 ? M.phillipsUp : M.phillipsDown) * gap;

/** Fiscal risk premium on long yields for a deficit and debt above (+) or below (−) the current-law path, as shares of GDP. */
export const fiscalPremium = (fear: number, extraDeficit: number, extraDebt: number) =>
  Math.min(M.premiumCap, Math.max(M.premiumFloor,
    fear * (M.premiumPerDeficitPt * extraDeficit * 100 + M.premiumPerDebtPt * extraDebt * 100)));

/**
 * Market yields. `trendPi` is persistent extra inflation (the economy setting), which markets price in fully;
 * `policyPi` is inflation the plan itself causes, which the Fed leans against (Taylor rule) and long yields
 * price in partly. `realShock` is the change in real rates (beyond inflation) from the economy setting.
 */
export function yields(trendPi: number, policyPi: number, gap: number, premium: number, realShock: number) {
  const long = realShock + trendPi + M.longInflationPassThrough * policyPi;
  return {
    y2: Math.max(0, YIELDS0.y2 + realShock + trendPi + M.taylorInflation * policyPi + M.taylorGap * gap),
    y10: Math.max(0, YIELDS0.y10 + long + premium),
    y30: Math.max(0, YIELDS0.y30 + long + premium * M.thirtyYearPremiumScale),
  };
}
