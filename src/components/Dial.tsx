interface Props {
  value: number; min: number; max: number; label: string; display: string;
  /** value at which the arc turns from good (green) to bad (red) */
  pivot: number; size?: number; sub?: string;
  /** milestones drawn across the arc, numbered 1, 2, 3… in the order given */
  marks?: { value: number; label: string }[];
  /** extra content under the caption (e.g. a milestone legend) */
  children?: React.ReactNode;
}

const polar = (cx: number, cy: number, r: number, t: number) => {
  const a = Math.PI * (1 - t);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
};

const arc = (cx: number, cy: number, r: number, t0: number, t1: number) => {
  const [x0, y0] = polar(cx, cy, r, t0);
  const [x1, y1] = polar(cx, cy, r, t1);
  return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
};

export function Dial({ value, min, max, label, display, pivot, size = 220, sub, marks = [], children }: Props) {
  const clamp = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const t = clamp(value);
  const tp = clamp(pivot);
  const [nx, ny] = polar(100, 100, 74, t);
  const good = value <= pivot;
  return (
    <figure className="dial" style={{ width: size }} aria-label={`${label}: ${display}`}>
      <svg viewBox={marks.length ? '0 -16 200 134' : '0 0 200 118'}>
        <path d={arc(100, 100, 82, 0, tp)} className="arc good" />
        <path d={arc(100, 100, 82, tp, 1)} className="arc bad" />
        {[0, 0.25, 0.5, 0.75, 1].map((k) => {
          const [x0, y0] = polar(100, 100, 92, k);
          const [x1, y1] = polar(100, 100, 98, k);
          return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} className="tick" />;
        })}
        {marks.map((m, i) => {
          const k = clamp(m.value);
          const [x0, y0] = polar(100, 100, 72, k), [x1, y1] = polar(100, 100, 93, k);
          // Neighbouring numbers alternate between two radii so close milestones don't overlap.
          const order = [...marks].sort((a, b) => a.value - b.value).indexOf(m);
          const [tx, ty] = polar(100, 100, 102 + (order % 2) * 9, k);
          return (
            <g key={m.label} className="mark">
              <title>{m.label}</title>
              <line x1={x0} y1={y0} x2={x1} y2={y1} />
              <text x={tx} y={ty + 3} textAnchor="middle" className="mark-num">{i + 1}</text>
            </g>
          );
        })}
        <line x1={100} y1={100} x2={nx} y2={ny} className="needle" style={{ transition: 'all .35s' }} />
        <circle cx={100} cy={100} r={6} className="hub" />
      </svg>
      <figcaption>
        <span className={`dial-value ${good ? 'pos' : 'neg'}`}>{display}</span>
        <span className="dial-label">{label}</span>
        {sub && <span className="dial-sub">{sub}</span>}
        {children}
      </figcaption>
    </figure>
  );
}
