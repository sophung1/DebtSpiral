import { describe, it, expect } from 'vitest';
import { parseDebtToPenny, parseAvgRate, parseDebtLimit, parseMts, parseYieldCsv } from './fetch-data';

// Fixtures mirror the documented Fiscal Data field names; they are not captured API responses.
describe('fetch-data parsers', () => {
  it('debt to the penny', () => {
    const u = parseDebtToPenny([{ record_date: '2026-10-16', tot_pub_debt_out_amt: '38000000000000.00', debt_held_public_amt: '30500000000000.00', intragov_hold_amt: '7500000000000.00' }]);
    expect(u.totalDebtB.value).toBe(38000);
    expect(u.debtHeldByPublicB.asOf).toBe('2026-10-16');
  });
  it('average interest rate picks the total row', () => {
    const u = parseAvgRate([
      { record_date: '2026-09-30', security_desc: 'Treasury Bills', avg_interest_rate_amt: '4.1' },
      { record_date: '2026-09-30', security_desc: 'Total Interest-bearing Debt', avg_interest_rate_amt: '3.412' },
    ]);
    expect(u.avgInterestRate.value).toBeCloseTo(0.03412, 8);
  });
  it('debt limit uses the latest day, millions → billions', () => {
    const u = parseDebtLimit([
      { record_date: '2026-10-16', debt_catg: 'Total Public Debt Subject to Limit', close_today_bal: '37900000' },
      { record_date: '2026-10-16', debt_catg: 'Statutory Debt Limit', close_today_bal: '41100000' },
      { record_date: '2026-10-15', debt_catg: 'Statutory Debt Limit', close_today_bal: '1' },
    ]);
    expect(u.debtSubjectToLimitB.value).toBe(37900);
    expect(u.debtLimitB.value).toBe(41100);
  });
  it('debt subject to limit matches alternate labels but not "not subject" rows', () => {
    const u = parseDebtLimit([
      { record_date: '2026-10-16', debt_catg: 'Less Debt Not Subject to Limit', close_today_bal: '50000' },
      { record_date: '2026-10-16', debt_catg: 'Total Subject to Limit', close_today_bal: '40300000' },
    ]);
    expect(u.debtSubjectToLimitB.value).toBe(40300);
  });
  it('MTS year-to-date row', () => {
    const u = parseMts([
      { record_date: '2026-09-30', classification_desc: 'September', current_month_gross_rcpt_amt: '1', current_month_gross_outly_amt: '2' },
      { record_date: '2026-09-30', classification_desc: 'Year-to-Date', current_month_gross_rcpt_amt: '5400000000000', current_month_gross_outly_amt: '7200000000000' },
    ]);
    expect(u.fytdDeficitB.value).toBe(1800);
  });
  it('yield curve CSV, newest row', () => {
    const csv = '"Date","1 Mo","2 Yr","10 Yr","30 Yr"\n10/15/2026,4.0,3.50,4.10,4.70\n10/16/2026,4.0,3.55,4.12,4.71\n';
    const u = parseYieldCsv(csv);
    expect(u.yield10y.value).toBeCloseTo(0.0412, 8);
    expect(u.yield10y.asOf).toBe('2026-10-16');
  });
});
