interface Props {
  value: number; min: number; max: number; label: string; display: string;
  /** value at which the arc turns from good (green) to bad (red) */
  pivot: number; size?: number; sub?: string;
  /** milestones drawn across the arc, labeled with their short text */
  marks?: { value: number; label: string; short: string }[];
  /** color the arc as a gradient through these values (green → yellow → red) instead of a two-tone split */
  stops?: { value: number; color: string }[];
  /** tooltip for the gradient arc */
  arcTitle?: string;
  /** class for the big number (defaults to pos/neg around the pivot) */
  tone?: string;
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

const SLICES = 90;

/** Color at position t along the arc, mixing between the stops on either side. */
function colorAt(stops: { t: number; color: string }[], t: number): string {
  if (t <= stops[0].t) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1], b = stops[i];
    if (t <= b.t) return `color-mix(in oklab, ${b.color} ${Math.round(((t - a.t) / (b.t - a.t || 1)) * 100)}%, ${a.color})`;
  }
  return stops[stops.length - 1].color;
}

export function Dial({ value, min, max, label, display, pivot, size = 220, sub, marks = [], stops, tone, arcTitle, children }: Props) {
  const clamp = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const t = clamp(value);
  const tp = clamp(pivot);
  const [nx, ny] = polar(100, 100, 74, t);
  const good = value <= pivot;
  return (
    <figure className="dial" style={{ width: size }} aria-label={`${label}: ${display}`}>
      <svg viewBox={marks.length ? '0 -16 200 134' : '0 0 200 118'}>
        {stops ? (
          // SVG has no conic gradient: draw short slices, each colored by mixing the two stops around it.
          <g className="arc grad">
            {arcTitle && <title>{arcTitle}</title>}
            {Array.from({ length: SLICES }, (_, i) => (
              <path key={i} d={arc(100, 100, 82, i / SLICES, Math.min(1, (i + 1.6) / SLICES))} style={{ stroke: colorAt(stops.map((s) => ({ t: clamp(s.value), color: s.color })), (i + 0.5) / SLICES) }} />
            ))}
          </g>
        ) : (
          <>
            <path d={arc(100, 100, 82, 0, tp)} className="arc good" />
            <path d={arc(100, 100, 82, tp, 1)} className="arc bad" />
          </>
        )}
        {[0, 0.25, 0.5, 0.75, 1].map((k) => {
          const [x0, y0] = polar(100, 100, 92, k);
          const [x1, y1] = polar(100, 100, 98, k);
          return <line key={k} x1={x0} y1={y0} x2={x1} y2={y1} className="tick" />;
        })}
        {marks.map((m) => {
          const k = clamp(m.value);
          const [x0, y0] = polar(100, 100, 72, k), [x1, y1] = polar(100, 100, 93, k);
          const [tx, ty] = polar(100, 100, 104, k);
          return (
            <g key={m.label} className="mark">
              <title>{m.label}</title>
              <line x1={x0} y1={y0} x2={x1} y2={y1} />
              <text x={tx} y={ty + 3} textAnchor="middle" className="mark-num">{m.short}</text>
            </g>
          );
        })}
        <line x1={100} y1={100} x2={nx} y2={ny} className="needle" style={{ transition: 'all .35s' }} />
        <circle cx={100} cy={100} r={6} className="hub" />
      </svg>
      <figcaption>
        <span className={`dial-value ${tone ?? (good ? 'pos' : 'neg')}`}>{display}</span>
        <span className="dial-label">{label}</span>
        {sub && <span className="dial-sub">{sub}</span>}
        {children}
      </figcaption>
    </figure>
  );
}
