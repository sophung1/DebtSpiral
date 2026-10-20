import { soiBins, tax, manual, type SoiBin } from './data';
import { thresholds, type BracketSchedule, type Scenario } from './scenario';

/** Tax on taxable income `ti` under a progressive schedule. */
export function scheduleTax(ti: number, th: number[], rates: number[]): number {
  let t = 0;
  for (let i = 0; i < rates.length; i++) {
    const top = i + 1 < th.length ? th[i + 1] : Infinity;
    if (ti <= th[i]) break;
    t += (Math.min(ti, top) - th[i]) * rates[i];
  }
  return t;
}

export function marginalRate(ti: number, th: number[], rates: number[]): number {
  let r = rates[0];
  for (let i = 0; i < rates.length; i++) if (ti > th[i]) r = rates[i];
  return r;
}

const K = 24;

/** Representative AGI points per bin (uniform within bin, Pareto for the open top bin), rescaled to match the bin mean. */
export function binSamples(bin: SoiBin): number[] {
  const mean = (bin.agiB * 1e9) / (bin.returnsM * 1e6);
  let pts: number[];
  if (bin.hi === null) {
    const alpha = mean / (mean - bin.lo);
    pts = Array.from({ length: K }, (_, k) => bin.lo * Math.pow(1 - (k + 0.5) / K, -1 / alpha));
  } else {
    pts = Array.from({ length: K }, (_, k) => bin.lo + ((k + 0.5) / K) * (bin.hi! - bin.lo));
  }
  const m = pts.reduce((a, b) => a + b, 0) / K;
  return pts.map((p) => (p * mean) / m);
}

const samples = soiBins.map(binSamples);

/** Un-calibrated aggregate ordinary income tax ($B) for a bracket schedule. */
export function aggregateOrdinaryTax(s: BracketSchedule, base: BracketSchedule, behavioral: boolean): number {
  const eti = tax.elasticities.taxableIncome;
  let total = 0;
  soiBins.forEach((bin, bi) => {
    const perSample = (bin.returnsM * 1e6) / K;
    for (const agi of samples[bi]) {
      for (const [filing, w] of [['mfj', bin.marriedShare], ['single', 1 - bin.marriedShare]] as const) {
        if (w <= 0) continue;
        let ti = Math.max(0, agi * bin.ordinaryShare - tax.stdDeduction[filing]);
        const th = thresholds(s, filing);
        if (behavioral && ti > 0) {
          const m0 = marginalRate(ti, thresholds(base, filing), base.rates);
          const m1 = marginalRate(ti, th, s.rates);
          ti *= Math.pow((1 - m1) / (1 - m0), eti);
        }
        total += scheduleTax(ti, th, s.rates) * w * perSample;
      }
    }
  });
  return total / 1e9;
}

/** Ordinary individual income tax receipts ($B), calibrated so current law reproduces actual receipts. */
export function individualOrdinaryReceipts(scn: Scenario, base: Scenario): number {
  const b = manual.receipts.individualOrdinary.value;
  return (b * aggregateOrdinaryTax(scn.brackets, base.brackets, scn.behavioral)) / aggregateOrdinaryTax(base.brackets, base.brackets, false);
}

/** Total wages ($B) subject to a per-earner wage cap. */
export function cappedWages(cap: number | null): number {
  const epm = manual.soi.earnersPerMarriedReturn;
  let total = 0;
  soiBins.forEach((bin, bi) => {
    const perSample = (bin.returnsM * 1e6) / K;
    const meanAgi = (bin.agiB * 1e9) / (bin.returnsM * 1e6);
    const meanWage = (bin.wagesB * 1e9) / (bin.returnsM * 1e6);
    for (const agi of samples[bi]) {
      const w = (meanWage * agi) / meanAgi;
      const cappedMarried = cap === null ? w : Math.min(w / epm, cap) * epm;
      const cappedSingle = cap === null ? w : Math.min(w, cap);
      total += (bin.marriedShare * cappedMarried + (1 - bin.marriedShare) * cappedSingle) * perSample;
    }
  });
  return total / 1e9;
}

export function payrollSSReceipts(scn: Scenario, base: Scenario): number {
  const b = manual.receipts.payrollSS.value;
  return b * (scn.ssRate / base.ssRate) * (cappedWages(scn.ssWageBase) / cappedWages(base.ssWageBase));
}

export function capitalGainsReceipts(scn: Scenario, base: Scenario): number {
  const b = manual.receipts.capitalGains.value;
  const niit = tax.capitalGains.niitRate;
  const r0 = base.capGainsTopRate + niit;
  const r1 = scn.capGainsTopRate + niit;
  // ~80% of capital gains revenue comes from the top-rate bracket.
  let top = 0.8 * (r1 / r0);
  if (scn.behavioral) top *= Math.pow((1 - r1) / (1 - r0), tax.elasticities.capitalGains);
  return b * (0.2 + top);
}

export function corporateReceipts(scn: Scenario, base: Scenario): number {
  const b = manual.receipts.corporate.value;
  let v = b * (scn.corporateRate / base.corporateRate);
  if (scn.behavioral) v *= Math.pow((1 - scn.corporateRate) / (1 - base.corporateRate), tax.elasticities.corporate);
  return v;
}

export function estateReceipts(scn: Scenario, base: Scenario): number {
  const b = manual.receipts.estate.value;
  return b * (scn.estateRate / base.estateRate) * Math.pow(base.estateExemption / scn.estateExemption, tax.elasticities.estateExemption);
}
