import { useState, type ReactNode } from 'react';
import { useLayout } from '../state/layout';

interface SliderProps {
  label: ReactNode; value: number; min: number; max: number; step: number;
  base?: number; format: (v: number) => string; onChange: (v: number) => void; hint?: ReactNode;
}

export function Slider({ label, value, min, max, step, base, format, onChange, hint }: SliderProps) {
  const changed = base !== undefined && Math.abs(value - base) > step / 2;
  const basePct = base === undefined ? null : ((base - min) / (max - min)) * 100;
  return (
    <label className={`slider ${changed ? 'changed' : ''}`}>
      <span className="slider-head">
        <span>{label}</span>
        <output>{format(value)}</output>
      </span>
      <span className="slider-track">
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(+e.target.value)}
          onDoubleClick={() => base !== undefined && onChange(base)} />
        {basePct !== null && <span className="base-tick" style={{ left: `${basePct}%` }} title={`Current law: ${format(base!)}`} />}
      </span>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, checked, onChange, aside, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; aside?: ReactNode; disabled?: boolean }) {
  return (
    <label className={`toggle ${checked ? 'on' : ''} ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden />
      <span className="toggle-label">{label}</span>
      {aside && <span className="toggle-aside">{aside}</span>}
    </label>
  );
}

/** A card. With an `id` it can be collapsed and dragged to reorder (see state/layout.ts). */
export function Panel({ id, title, children, right, className = '' }: { id?: string; title: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  const collapsed = useLayout((s) => (id ? !!s.collapsed[id] : false));
  const toggle = useLayout((s) => s.toggle);
  const move = useLayout((s) => s.move);
  const order = useLayout((s) => s.order);
  // Pointer-based drag (works with mouse and touch): find the card under the pointer, drop before/after it.
  const startDrag = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!id) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const { setDrag } = useLayout.getState();
    const target = (ev: PointerEvent) => {
      const slot = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.card-slot');
      const tid = slot?.dataset.id;
      if (!slot || !tid || tid === id) return null;
      const r = slot.getBoundingClientRect();
      const after = slot.classList.contains('full') ? ev.clientY > r.top + r.height / 2 : ev.clientX > r.left + r.width / 2;
      return { id: tid, after };
    };
    setDrag(id, null);
    const onMove = (ev: PointerEvent) => {
      // Auto-scroll near the window edges so far-away cards are reachable.
      // The top zone starts below the sticky scoreboard, which covers the cards behind it.
      const edge = 70;
      const top = Math.max(0, document.querySelector('.scoreboard')?.getBoundingClientRect().bottom ?? 0) + edge;
      if (ev.clientY < top) window.scrollBy(0, -(top - ev.clientY) / 2);
      else if (ev.clientY > innerHeight - edge) window.scrollBy(0, (ev.clientY - (innerHeight - edge)) / 2);
      setDrag(id, target(ev));
    };
    const onUp = (ev: PointerEvent) => {
      const t = target(ev);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setDrag(null, null);
      if (!t) return;
      const rest = useLayout.getState().order.filter((x) => x !== id);
      move(id, rest.indexOf(t.id) + (t.after ? 1 : 0));
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!id || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    move(id, order.indexOf(id) + (e.key === 'ArrowUp' ? -1 : 1));
  };
  return (
    <section className={`panel ${className} ${collapsed ? 'collapsed' : ''}`}>
      <header className="panel-head">
        {id && (
          <span className="drag" role="button" tabIndex={0} title="Drag to reorder (or focus and use ↑ ↓)" aria-label="Reorder card"
            onKeyDown={onKey} onPointerDown={startDrag}>⠿</span>
        )}
        <h2>{id ? <button className="collapse" aria-expanded={!collapsed} onClick={() => toggle(id)}><span className="chev" aria-hidden>{collapsed ? '▸' : '▾'}</span>{title}</button> : title}</h2>
        {right}
      </header>
      {!collapsed && children}
    </section>
  );
}

/** Number input that only commits on blur/Enter, so clamping doesn't fight the user mid-typing. */
export function NumInput({ value, onCommit, ...rest }: { value: number; onCommit: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && !isNaN(+draft)) onCommit(+draft);
    setDraft(null);
  };
  return (
    <input type="number" {...rest} value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}
