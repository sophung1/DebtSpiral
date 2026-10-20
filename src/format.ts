export const fmtB = (b: number, sign = false): string => {
  const s = sign && b > 0 ? '+' : b < 0 ? '−' : '';
  const a = Math.abs(b);
  return a >= 1000 ? `${s}$${(a / 1000).toFixed(2)}T` : `${s}$${a.toFixed(a < 10 ? 1 : 0)}B`;
};
export const fmt$ = (d: number, sign = false): string =>
  `${sign && d > 0 ? '+' : d < 0 ? '−' : ''}$${Math.round(Math.abs(d)).toLocaleString('en-US')}`;
export const fmtK = (d: number): string =>
  d >= 1e6 ? `$${+(d / 1e6).toFixed(2)}M` : d >= 1e3 ? `$${+(d / 1e3).toFixed(1)}k` : `$${Math.round(d)}`;
export const pct = (r: number, dp = 1): string => `${(r * 100).toFixed(dp)}%`;
