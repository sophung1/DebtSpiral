import { create } from 'zustand';

/** Card order and collapsed state: a per-viewer convenience kept in localStorage (safe to lose). */
export const DEFAULT_ORDER = [
  'households', 'debt', 'outlook', 'moneyflow',
  'income_tax', 'social_security', 'health', 'safety_net', 'defense_other', 'business', 'energy', 'wild',
];
/** Phones (the one-column layout) start with every card collapsed; wider screens only fold Money flow. */
const defaultCollapsed = (): Record<string, boolean> => {
  let phone = false;
  try { phone = window.matchMedia('(max-width: 860px)').matches; } catch { /* no window */ }
  return phone ? Object.fromEntries(DEFAULT_ORDER.map((id) => [id, true])) : { moneyflow: true };
};
const KEY = 'deficit-dial-layout-v2';

export interface DropTarget { id: string; after: boolean }

export type HeaderMode = 'full' | 'compact' | 'hidden';

interface Layout {
  order: string[];
  collapsed: Record<string, boolean>;
  /** scoreboard size: full, a one-line strip, or hidden behind a small button */
  header: HeaderMode;
  setHeader: (h: HeaderMode) => void;
  /** card being dragged and where it would land (not persisted) */
  dragging: string | null;
  over: DropTarget | null;
  setDrag: (dragging: string | null, over: DropTarget | null) => void;
  toggle: (id: string) => void;
  /** collapse (true) or expand (false) every card */
  setAll: (collapsed: boolean) => void;
  move: (id: string, to: number) => void;
  reset: () => void;
}

function load(): Pick<Layout, 'order' | 'collapsed' | 'header'> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Array.isArray(saved.order)) {
      // Keep the saved order for known cards, drop removed ones, and slot new cards in right after
      // their default predecessor (e.g. a new card listed after 'business' lands next to it).
      const order: string[] = saved.order.filter((id: string) => DEFAULT_ORDER.includes(id));
      DEFAULT_ORDER.forEach((id, i) => {
        if (order.includes(id)) return;
        const prev = DEFAULT_ORDER.slice(0, i).reverse().find((p) => order.includes(p));
        order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, id);
      });
      const header: HeaderMode = ['full', 'compact', 'hidden'].includes(saved.header) ? saved.header : 'full';
      return { order, collapsed: { ...defaultCollapsed(), ...saved.collapsed }, header };
    }
  } catch { /* storage unavailable or corrupt: use defaults */ }
  return { order: DEFAULT_ORDER, collapsed: defaultCollapsed(), header: 'full' };
}

const save = (s: Pick<Layout, 'order' | 'collapsed' | 'header'>) => {
  try { localStorage.setItem(KEY, JSON.stringify({ order: s.order, collapsed: s.collapsed, header: s.header })); } catch { /* ignore */ }
};

export const useLayout = create<Layout>((set, get) => ({
  ...load(),
  dragging: null,
  over: null,
  setDrag: (dragging, over) => set({ dragging, over }),
  setHeader: (header) => { set({ header }); save(get()); },
  setAll: (c) => { set({ collapsed: Object.fromEntries(DEFAULT_ORDER.map((id) => [id, c])) }); save(get()); },
  toggle: (id) => { set({ collapsed: { ...get().collapsed, [id]: !get().collapsed[id] } }); save(get()); },
  move: (id, to) => {
    const order = get().order.filter((x) => x !== id);
    order.splice(Math.max(0, Math.min(to, order.length)), 0, id);
    set({ order }); save(get());
  },
  reset: () => { set({ order: DEFAULT_ORDER, collapsed: defaultCollapsed(), header: 'full' }); try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
}));
