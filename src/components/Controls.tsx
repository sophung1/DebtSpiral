import { useState, type ReactNode } from 'react';

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

export function Panel({ title, children, right, className = '' }: { title: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head"><h2>{title}</h2>{right}</header>
      {children}
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
