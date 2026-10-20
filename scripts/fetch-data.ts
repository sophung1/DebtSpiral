/**
 * Refreshes data/live.json from public, key-free sources:
 *  - Treasury Fiscal Data API (debt to the penny, avg interest rates, debt subject to limit, MTS)
 *  - Treasury daily par yield curve CSV
 * Each field is only overwritten when its fetch succeeds and parses to a finite number.
 * Run: npm run fetch-data
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FD = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const LIVE = fileURLToPath(new URL('../data/live.json', import.meta.url));

type Field = { value: number; asOf: string; source: string };
type Row = Record<string, string>;
export type Updates = Record<string, Field>;

const num = (s: string | undefined) => (s === undefined || s === '' || s === 'null' ? NaN : Number(s.replace(/,/g, '')));

async function fdRows(path: string, params: Record<string, string>): Promise<Row[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${FD}${path}?${qs}`);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return ((await res.json()) as { data: Row[] }).data;
}

export function parseDebtToPenny(rows: Row[]): Updates {
  const r = rows[0];
  const src = 'Treasury Fiscal Data: Debt to the Penny';
  return {
    totalDebtB: { value: num(r.tot_pub_debt_out_amt) / 1e9, asOf: r.record_date, source: src },
    debtHeldByPublicB: { value: num(r.debt_held_public_amt) / 1e9, asOf: r.record_date, source: src },
    intragovDebtB: { value: num(r.intragov_hold_amt) / 1e9, asOf: r.record_date, source: src },
  };
}

export function parseAvgRate(rows: Row[]): Updates {
  const r = rows.find((x) => /total interest-bearing debt/i.test(x.security_desc ?? ''));
  if (!r) return {};
  return { avgInterestRate: { value: num(r.avg_interest_rate_amt) / 100, asOf: r.record_date, source: 'Treasury Fiscal Data: Average Interest Rates on U.S. Treasury Securities' } };
}

export function parseDebtLimit(rows: Row[]): Updates {
  if (!rows.length) return {};
  const latest = rows[0].record_date;
  const day = rows.filter((r) => r.record_date === latest);
  const label = (r: Row) => `${r.debt_catg ?? ''} ${r.debt_catg_desc ?? ''}`;
  const find = (re: RegExp) => day.find((r) => re.test(label(r)));
  const src = 'Treasury Fiscal Data: Daily Treasury Statement, Debt Subject to Limit';
  const out: Updates = {};
  const subj = find(/total.*subject to (the )?limit/i) ?? day.find((r) => /subject to (the )?limit/i.test(label(r)) && !/not subject|other/i.test(label(r)));
  const lim = find(/statutory debt limit/i);
  // DTS Table III-C has no total row: subject to limit = public + intragov − not-subject items + other subject debt.
  const sum = (re: RegExp) => day.filter((r) => re.test(label(r))).reduce((a, r) => a + Math.abs(num(r.close_today_bal)), 0);
  const parts = find(/debt held by the public/i) && find(/intragovernmental holdings/i);
  const derived = parts
    ? sum(/debt held by the public/i) + sum(/intragovernmental holdings/i) - sum(/not subject to limit/i) + sum(/^other debt subject to limit/i)
    : NaN;
  if (!subj && Number.isFinite(derived)) out.debtSubjectToLimitB = { value: derived / 1e3, asOf: latest, source: src };
  if (!subj && !parts) console.warn(`  no subject-to-limit row; categories seen: ${day.map(label).join(' | ')}`);
  // DTS amounts are in millions of dollars.
  if (subj) out.debtSubjectToLimitB = { value: num(subj.close_today_bal) / 1e3, asOf: latest, source: src };
  if (lim) out.debtLimitB = { value: num(lim.close_today_bal) / 1e3, asOf: latest, source: src };
  return out;
}

export function parseMts(rows: Row[]): Updates {
  const r = rows.find((x) => /year-to-date/i.test(x.classification_desc ?? ''));
  if (!r) return {};
  const src = 'Treasury Fiscal Data: Monthly Treasury Statement, Table 1 (fiscal year to date)';
  const rec = num(r.current_month_gross_rcpt_amt) / 1e9;
  const out = num(r.current_month_gross_outly_amt) / 1e9;
  return {
    fytdReceiptsB: { value: rec, asOf: r.record_date, source: src },
    fytdOutlaysB: { value: out, asOf: r.record_date, source: src },
    fytdDeficitB: { value: out - rec, asOf: r.record_date, source: src },
  };
}

/** Parses the Treasury daily par yield curve CSV (newest row first). */
export function parseYieldCsv(csv: string): Updates {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
  const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.replace(/"/g, '').trim()));
  rows.sort((a, b) => +new Date(b[0]) - +new Date(a[0]));
  const r = rows[0];
  if (!r) return {};
  const [m, d, y] = r[0].split('/');
  const asOf = `${y}-${m}-${d}`;
  const src = 'U.S. Treasury daily par yield curve rates';
  const col = (name: string) => num(r[head.indexOf(name)]) / 100;
  return {
    yield2y: { value: col('2 Yr'), asOf, source: src },
    yield10y: { value: col('10 Yr'), asOf, source: src },
    yield30y: { value: col('30 Yr'), asOf, source: src },
  };
}

async function yields(): Promise<Updates> {
  const y = new Date().getUTCFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${y}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${y}&page&_format=csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`yield curve: HTTP ${res.status}`);
  return parseYieldCsv(await res.text());
}

const jobs: [string, () => Promise<Updates>][] = [
  ['debt to the penny', async () => parseDebtToPenny(await fdRows('/v2/accounting/od/debt_to_penny', { sort: '-record_date', 'page[size]': '1' }))],
  ['average interest rates', async () => parseAvgRate(await fdRows('/v2/accounting/od/avg_interest_rates', { sort: '-record_date', 'page[size]': '30' }))],
  ['debt subject to limit', async () => parseDebtLimit(await fdRows('/v1/accounting/dts/debt_subject_to_limit', { sort: '-record_date', 'page[size]': '30' }))],
  ['monthly treasury statement', async () => parseMts(await fdRows('/v1/accounting/mts/mts_table_1', { sort: '-record_date', 'page[size]': '40' }))],
  ['yield curve', yields],
];

async function main() {
  const live = JSON.parse(readFileSync(LIVE, 'utf8'));
  let updated = 0, failed = 0;
  for (const [name, job] of jobs) {
    try {
      const u = await job();
      for (const [k, f] of Object.entries(u)) {
        if (!Number.isFinite(f.value)) { console.warn(`  ${k}: not a number, keeping previous value`); continue; }
        live[k] = f;
        updated++;
      }
      console.log(`ok   ${name} (${Object.keys(u).join(', ') || 'no fields'})`);
    } catch (e) {
      failed++;
      console.warn(`FAIL ${name}: ${(e as Error).message} (keeping previous values)`);
    }
  }
  // Debt subject to limit is within ~0.1% of total debt; if the DTS row wasn't found, approximate it
  // rather than leave a stale value that would badly skew the debt-ceiling clock.
  if (live.debtSubjectToLimitB.asOf < live.totalDebtB.asOf) {
    live.debtSubjectToLimitB = { ...live.totalDebtB, source: 'Approximated by total public debt (DTS subject-to-limit row not found)' };
    console.warn('  debtSubjectToLimitB approximated from total debt');
    updated++;
  }
  if (updated) {
    live.updatedAt = new Date().toISOString();
    live.seed = false;
    writeFileSync(LIVE, JSON.stringify(live, null, 2) + '\n');
  }
  console.log(`${updated} fields updated, ${failed}/${jobs.length} sources failed`);
  if (failed === jobs.length) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
