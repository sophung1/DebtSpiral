import { create } from 'zustand';

/** Card order and collapsed state: a per-viewer convenience kept in localStorage (safe to lose). */
export const DEFAULT_ORDER = [
  'households', 'debt', 'outlook', 'moneyflow',
  'income_tax', 'social_security', 'health', 'safety_net', 'defense_other', 'business', 'energy', 'wild',
];
const DEFAULT_COLLAPSED: Record<string, boolean> = { moneyflow: true };
const KEY = 'deficit-dial-layout-v2';

export interface DropTarget { id: string; after: boolean }

interface Layout {
  order: string[];
  collapsed: Record<string, boolean>;
  /** card being dragged and where it would land (not persisted) */
  dragging: string | null;
  over: DropTarget | null;
  setDrag: (dragging: string | null, over: DropTarget | null) => void;
  toggle: (id: string) => void;
  move: (id: string, to: number) => void;
  reset: () => void;
}

function load(): Pick<Layout, 'order' | 'collapsed'> {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && Array.isArray(saved.order)) {
      // Keep the saved order for known cards, append any new ones, drop removed ones.
      const order = [...saved.order.filter((id: string) => DEFAULT_ORDER.includes(id)), ...DEFAULT_ORDER.filter((id) => !saved.order.includes(id))];
      return { order, collapsed: { ...DEFAULT_COLLAPSED, ...saved.collapsed } };
    }
  } catch { /* storage unavailable or corrupt: use defaults */ }
  return { order: DEFAULT_ORDER, collapsed: DEFAULT_COLLAPSED };
}

const save = (s: Pick<Layout, 'order' | 'collapsed'>) => {
  try { localStorage.setItem(KEY, JSON.stringify({ order: s.order, collapsed: s.collapsed })); } catch { /* ignore */ }
};

export const useLayout = create<Layout>((set, get) => ({
  ...load(),
  dragging: null,
  over: null,
  setDrag: (dragging, over) => set({ dragging, over }),
  toggle: (id) => { set({ collapsed: { ...get().collapsed, [id]: !get().collapsed[id] } }); save(get()); },
  move: (id, to) => {
    const order = get().order.filter((x) => x !== id);
    order.splice(Math.max(0, Math.min(to, order.length)), 0, id);
    set({ order }); save(get());
  },
  reset: () => { set({ order: DEFAULT_ORDER, collapsed: DEFAULT_COLLAPSED }); try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
}));
