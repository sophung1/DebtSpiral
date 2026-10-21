/**
 * Monetary regimes: how the central bank (or its absence) shapes rates and inflation. Each regime adjusts the
 * macro channels in macro.ts; "Today's Fed" changes nothing.
 */
export interface Regime {
  id: string; name: string; blurb: string;
  /** scales the Fed's Taylor-rule response (0 = no discretionary policy) */
  taylorScale: number;
  /** persistent change in trend inflation (decimal) */
  trendPi: number;
  /** change in the inflation target: markets don't charge an inflation risk premium for hitting it */
  targetShift: number;
  /** change in real rates (decimal) */
  realShock: number;
  /** added to the fiscal multiplier (no central bank to cushion cuts) */
  multiplierAdd: number;
  /** scales inflation sensitivity and market fear */
  sensitivityScale: number;
  fearScale: number;
  /** cap on the 10-yr yield (yield-curve control), or null */
  y10Cap: number | null;
  /** shifts to bill and long yields (decimal) */
  billsShift: number;
  longShift: number;
  /** deficits above this share of GDP are financed by the central bank at no interest, or null */
  monetizeAbove: number | null;
  /** extra inflation per point of GDP monetized */
  monetizeInflation: number;
}

const base: Omit<Regime, 'id' | 'name' | 'blurb'> = {
  taylorScale: 1, trendPi: 0, targetShift: 0, realShock: 0, multiplierAdd: 0, sensitivityScale: 1, fearScale: 1,
  y10Cap: null, billsShift: 0, longShift: 0, monetizeAbove: null, monetizeInflation: 0,
};
const r = (id: string, name: string, blurb: string, v: Partial<Regime>): Regime => ({ id, name, blurb, ...base, ...v });

export const REGIMES: Regime[] = [
  r('fed', "Today's Fed (2% target)", 'An independent Fed targeting 2% inflation: it raises short rates when inflation or the economy runs hot and cuts them in a slump.', {}),
  r('gold', 'Gold standard', 'Money tied to gold (as in 1879–1913, when inflation averaged ~0%). No central bank to cut rates in a slump, so austerity hits harder; real rates ran higher; nothing inflates away, and deflation makes debt heavier. More frequent recessions and banking panics are not modeled.',
    { taylorScale: 0, trendPi: -0.022, realShock: 0.01, multiplierAdd: 0.3 }),
  r('ycc', 'Yield-curve control', 'The Fed caps the 10-yr yield at 4% by buying whatever it takes, as it pegged rates during WWII and until 1951 (and Japan did 2016–24). Interest costs stay down and markets can\'t punish deficits, but the cap loosens policy, so inflation reacts more (1.3×).',
    { y10Cap: 0.04, sensitivityScale: 1.3 }),
  r('target35', 'Higher inflation target (3.5%)', 'The Fed targets ~3.5% instead of 2% (proposed by Olivier Blanchard and others). Prices and nominal GDP grow faster, slowly eroding the debt; markets price the higher inflation into yields over time.',
    { trendPi: 0.013, targetShift: 0.013 }),
  r('mmt', 'Fed-financed deficits (MMT-style)', 'The central bank pays for deficits above 3% of GDP by creating money at no interest. Interest costs fall and bond markets stop mattering, but inflation reacts twice as strongly plus ~0.25 pts per point of GDP financed. Low confidence: small, temporary monetization (Japan) was benign; large, lasting monetization (Weimar, Zimbabwe, Argentina) ended in very high inflation.',
    { fearScale: 0, sensitivityScale: 2, monetizeAbove: 0.03, monetizeInflation: 0.25 }),
  r('reserve_loss', 'Dollar loses reserve status', 'Foreign central banks and investors (who hold ~30% of the public debt) shift away from the dollar. The "exorbitant privilege" that keeps Treasury yields low, estimated at ~0.5–1 pt (Krishnamurthy & Vissing-Jorgensen), fades; a weaker dollar adds ~0.5 pts of inflation a year; and markets get jumpier (1.5× fear). Illustrative: no major currency has lost reserve status quickly (sterling took decades).',
    { longShift: 0.0075, billsShift: 0.005, trendPi: 0.005, fearScale: 1.5 }),
];

export const regimeOf = (id: string | undefined): Regime => REGIMES.find((x) => x.id === id) ?? REGIMES[0];

const signedPts = (v: number) => `${v > 0 ? '+' : '−'}${+(Math.abs(v) * 100).toFixed(2)} pt${Math.abs(v) === 0.01 ? '' : 's'}`;
const bp = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 1e4)} bp`;

/** Plain-language list of what a regime changes, for the Debt card ("Today's Fed" changes nothing). */
export function regimeEffects(g: Regime): string[] {
  const e: string[] = [];
  if (g.trendPi) e.push(`inflation ${signedPts(g.trendPi)}/yr`);
  if (g.realShock) e.push(`real rates ${signedPts(g.realShock)}`);
  if (g.taylorScale === 0) e.push('no rate cuts in a slump');
  if (g.multiplierAdd) e.push(`cuts hit the economy harder (multiplier +${g.multiplierAdd})`);
  if (g.y10Cap !== null) e.push(`10-yr yield capped at ${+(g.y10Cap * 100).toFixed(2)}%`);
  if (g.monetizeAbove !== null) e.push(`deficits above ${+(g.monetizeAbove * 100).toFixed(1)}% of GDP paid with new money`);
  if (g.sensitivityScale !== 1) e.push(`inflation reacts ${g.sensitivityScale}×`);
  if (g.fearScale === 0) e.push("bond markets can't punish deficits");
  else if (g.fearScale !== 1) e.push(`markets ${g.fearScale}× jumpier`);
  if (g.billsShift && g.billsShift === g.longShift) e.push(`yields ${bp(g.billsShift)}`);
  else {
    if (g.billsShift) e.push(`bill yields ${bp(g.billsShift)}`);
    if (g.longShift) e.push(`long yields ${bp(g.longShift)}`);
  }
  return e;
}
