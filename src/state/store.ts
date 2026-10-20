import { create } from 'zustand';
import { currentLaw, type Scenario } from '../model/scenario';

export const BASE = currentLaw();

function encode(s: Scenario): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(h: string): Scenario | null {
  try {
    const json = decodeURIComponent(escape(atob(h.replace(/-/g, '+').replace(/_/g, '/'))));
    const s = JSON.parse(json) as Partial<Scenario>;
    // Merge onto current law so new programs/policies added later still get defaults.
    const base = currentLaw();
    return { ...base, ...s, programs: { ...base.programs, ...s.programs }, policies: { ...base.policies, ...s.policies } } as Scenario;
  } catch {
    return null;
  }
}

function initial(): Scenario {
  const h = typeof location !== 'undefined' ? location.hash.replace(/^#s=/, '') : '';
  return (h && decode(h)) || currentLaw();
}

interface Store {
  scn: Scenario;
  set: (fn: (s: Scenario) => void) => void;
  reset: () => void;
}

export const useStore = create<Store>((set) => ({
  scn: initial(),
  set: (fn) => set((st) => {
    const next = structuredClone(st.scn);
    fn(next);
    return { scn: next };
  }),
  reset: () => set({ scn: currentLaw() }),
}));

useStore.subscribe(({ scn }) => {
  const isBase = JSON.stringify(scn) === JSON.stringify(BASE);
  history.replaceState(null, '', isBase ? location.pathname : `#s=${encode(scn)}`);
});
