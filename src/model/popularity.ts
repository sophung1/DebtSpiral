import pollingJson from '../../data/polling.json';
import { programs } from './data';
import { currentLaw, type Scenario } from './scenario';
import { activePolicies } from './policies';

export interface Poll { support: number; label: string; source: string; url: string; note?: string }
export const polls: Record<string, Poll> = pollingJson.polls;
export const pollingNote = pollingJson.note;

export interface Change { key: string; label: string; poll: Poll | null }

const dir = (now: number, base: number, up: string, down: string) => (now > base + 1e-9 ? up : now < base - 1e-9 ? down : null);

/** Every policy change the scenario makes vs current law (economy conditions excluded), with its poll if any. */
export function changes(scn: Scenario): Change[] {
  const base = currentLaw();
  const out: Change[] = [];
  const add = (key: string | null, label: string) => { if (key) out.push({ key, label, poll: polls[key] ?? null }); };

  for (const p of activePolicies(scn)) add(p.id, p.label);
  for (const p of programs) {
    if (scn.policies.abolish_ss && p.id === 'social_security') continue;
    const f = scn.programs[p.id] ?? 1;
    add(dir(f, 1, `program:${p.id}:up`, `program:${p.id}:down`), `${p.name} ${f > 1 ? 'increased' : 'cut'}`);
  }
  // The FairTax switch replaces every rate below; count it once, as itself.
  const ft = !!scn.policies.fairtax;
  // Income tax: the top rate has a poll; other bracket changes are counted but unpolled.
  if (!scn.policies.obbba_rollback && !ft) {
    const top = (s: Scenario) => s.brackets.rates.at(-1)!;
    add(dir(top(scn), top(base), 'topRate:up', 'topRate:down'), 'Top income tax rate changed');
    const lower = (s: Scenario) => JSON.stringify([s.brackets.rates.slice(0, -1), s.brackets.single]);
    if (lower(scn) !== lower(base)) add('brackets:other', 'Other tax brackets changed');
  }
  if (!ft) add(dir(scn.corporateRate, base.corporateRate, 'corporateRate:up', 'corporateRate:down'), 'Corporate tax rate changed');
  if (!ft) add(dir(scn.capGainsTopRate, base.capGainsTopRate, 'capGains:up', 'capGains:down'), 'Capital gains rate changed');
  const cap = (c: number | null) => c ?? Infinity;
  add(dir(cap(scn.ssWageBase), cap(base.ssWageBase), 'ssCap:raise', 'ssCap:lower'), 'Social Security wage cap changed');
  if (!scn.policies.abolish_ss && !ft) add(dir(scn.ssRate, base.ssRate, 'ssRate:up', 'ssRate:down'), 'Social Security tax rate changed');
  if (!ft) add(dir(scn.hiRate, base.hiRate, 'hiRate:up', 'hiRate:down'), 'Medicare tax rate changed');
  if (!ft) add(dir(scn.estateRate, base.estateRate, 'estate:up', 'estate:down'), 'Estate tax rate changed');
  add(dir(scn.stimulusPerAdult, 0, 'stimulus:up', 'stimulus:down'), 'Stimulus checks');
  return out;
}

/** Simple average support across the changes that have polling data. */
export function popularity(scn: Scenario) {
  const items = changes(scn);
  const polled = items.filter((c) => c.poll);
  const approval = polled.length ? polled.reduce((a, c) => a + c.poll!.support, 0) / polled.length : null;
  const least = polled.reduce<Change | null>((m, c) => (!m || c.poll!.support < m.poll!.support ? c : m), null);
  return { approval, counted: polled.length, total: items.length, items, least };
}
