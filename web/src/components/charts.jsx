import { useId, useMemo, useState } from 'react';

/**
 * Hand-rolled SVG charts so the mark specs are exact: 2px lines, >=8px hover
 * markers, 4px rounded data-ends anchored to the baseline, a 2px surface gap
 * between adjacent fills, and recessive grid/axis ink. Every chart ships a
 * hover layer and a table view, so nothing is conveyed by colour alone.
 */

const PAD = { top: 16, right: 16, bottom: 32, left: 40 };

function useScales(values, width, height, count) {
  return useMemo(() => {
    const max = Math.max(100, ...values);
    const min = 0;
    const plotW = width - PAD.left - PAD.right;
    const plotH = height - PAD.top - PAD.bottom;
    return {
      max, min, plotW, plotH,
      x: (i) => PAD.left + (count <= 1 ? plotW / 2 : (i / (count - 1)) * plotW),
      y: (v) => PAD.top + plotH - ((v - min) / (max - min)) * plotH,
    };
  }, [values, width, height, count]);
}

function TableView({ columns, rows, caption }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer secondary-ink select-none">View as table</summary>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-left border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>{columns.map((c) => (
              <th key={c} className="py-1.5 pr-4 font-medium muted text-xs uppercase tracking-wide">{c}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                {r.map((cell, j) => <td key={j} className="py-1.5 pr-4">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs secondary-ink mb-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block rounded-sm"
            style={{ width: 10, height: 10, background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, y, width, children }) {
  const flip = x > width * 0.6;
  return (
    <foreignObject x={flip ? x - 168 : x + 10} y={Math.max(0, y - 20)} width={160} height={72}
      style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div className="card px-2.5 py-1.5 text-xs shadow-lg" style={{ background: 'var(--surface-1)' }}>
        {children}
      </div>
    </foreignObject>
  );
}

/**
 * Score-over-time. One series needs no legend -- the title names it. A second
 * series (the class average) adds a legend and is drawn recessively.
 */
export function LineChart({
  points, comparison, height = 220, label = 'Score', comparisonLabel = 'Class average', valueSuffix = '%',
}) {
  const [hover, setHover] = useState(null);
  const width = 640;
  const values = points.map((p) => p.value);
  const s = useScales([...values, ...(comparison || [])], width, height, points.length);
  const id = useId();

  if (!points.length) {
    return <p className="text-sm muted py-8 text-center">No graded work yet.</p>;
  }

  const path = points.map((p, i) => `${i ? 'L' : 'M'}${s.x(i)},${s.y(p.value)}`).join(' ');
  const comparisonPath = comparison?.length
    ? comparison.map((v, i) => `${i ? 'L' : 'M'}${s.x(i)},${s.y(v)}`).join(' ')
    : null;

  const ticks = [0, 25, 50, 75, 100];

  return (
    <figure className="m-0">
      {comparisonPath && (
        <Legend items={[
          { label, color: 'var(--series-1)' },
          { label: comparisonLabel, color: 'var(--series-2)' },
        ]} />
      )}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img"
        aria-label={`${label} over time`}
        onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--series-1)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--series-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={s.y(t)} y2={s.y(t)}
              stroke="var(--gridline)" strokeWidth="1" />
            <text x={PAD.left - 8} y={s.y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{t}</text>
          </g>
        ))}

        <path d={`${path} L${s.x(points.length - 1)},${s.y(0)} L${s.x(0)},${s.y(0)} Z`} fill={`url(#fill-${id})`} />

        {comparisonPath && (
          <path d={comparisonPath} fill="none" stroke="var(--series-2)" strokeWidth="2"
            strokeDasharray="5 4" strokeLinecap="round" />
        )}
        <path d={path} fill="none" stroke="var(--series-1)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" />

        {points.map((p, i) => (
          <circle key={i} cx={s.x(i)} cy={s.y(p.value)} r={hover === i ? 5 : 3.5}
            fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth="2" />
        ))}

        {/* Hover layer: hit targets are far wider than the marks. Clamped to the
            viewBox so the first and last bands are not clipped away. */}
        {points.map((p, i) => {
          const band = s.plotW / points.length + 4;
          const left = Math.max(0, s.x(i) - band / 2);
          return (
            <rect key={`hit-${i}`} x={left} y={PAD.top}
              width={Math.min(band, width - left)} height={s.plotH} fill="transparent"
              onMouseEnter={() => setHover(i)} />
          );
        })}

        {hover != null && (
          <>
            <line x1={s.x(hover)} x2={s.x(hover)} y1={PAD.top} y2={PAD.top + s.plotH}
              stroke="var(--baseline)" strokeWidth="1" />
            <Tooltip x={s.x(hover)} y={s.y(points[hover].value)} width={width}>
              <p className="font-medium truncate">{points[hover].label}</p>
              <p className="secondary-ink">{points[hover].value}{valueSuffix}</p>
            </Tooltip>
          </>
        )}

        <line x1={PAD.left} x2={width - PAD.right} y1={s.y(0)} y2={s.y(0)}
          stroke="var(--baseline)" strokeWidth="1" />
      </svg>
      <TableView caption={`${label} over time`} columns={['Item', label]}
        rows={points.map((p) => [p.label, `${p.value}${valueSuffix}`])} />
    </figure>
  );
}

/** Vertical bars with 4px rounded tops anchored to the baseline. */
export function BarChart({ data, height = 200, valueSuffix = '', label = 'Value' }) {
  const [hover, setHover] = useState(null);
  const width = 640;
  const max = Math.max(1, ...data.map((d) => d.value));
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const gap = 2; // 2px surface gap between adjacent fills
  const barW = Math.max(6, plotW / data.length - gap * 2 - 6);

  if (!data.length) return <p className="text-sm muted py-8 text-center">No data yet.</p>;

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={label}
        onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={PAD.left} x2={width - PAD.right}
            y1={PAD.top + plotH * (1 - f)} y2={PAD.top + plotH * (1 - f)}
            stroke="var(--gridline)" strokeWidth="1" />
        ))}

        {data.map((d, i) => {
          const h = (d.value / max) * plotH;
          const x = PAD.left + (i + 0.5) * (plotW / data.length) - barW / 2;
          const y = PAD.top + plotH - h;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={PAD.top} width={barW} height={plotH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={Math.max(2, h)} rx="4"
                fill={d.color || 'var(--series-1)'} opacity={hover == null || hover === i ? 1 : 0.55} />
              <text x={x + barW / 2} y={height - 12} textAnchor="middle" fontSize="11"
                fill="var(--text-muted)">{d.label}</text>
              {/* Selective direct labels: only the value, only when it fits. */}
              {h > 24 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="11"
                  fill="var(--text-secondary)">{d.value}{valueSuffix}</text>
              )}
            </g>
          );
        })}

        <line x1={PAD.left} x2={width - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH}
          stroke="var(--baseline)" strokeWidth="1" />
      </svg>
      <TableView caption={label} columns={['Category', label]}
        rows={data.map((d) => [d.label, `${d.value}${valueSuffix}`])} />
    </figure>
  );
}

/**
 * Attendance composition. Uses the fixed status palette, so each segment is
 * labelled in the legend and the table -- colour never stands alone.
 */
export function StackedBar({ segments, height = 14, showLegend = true }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex w-full rounded-full overflow-hidden" style={{ height, gap: 2 }} role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <div key={s.label} title={`${s.label}: ${s.value}`}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, minWidth: 3 }} />
        ))}
      </div>
      {showLegend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs secondary-ink mt-2">
          {segments.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block rounded-sm" style={{ width: 10, height: 10, background: s.color }} />
              <span aria-hidden>{s.glyph}</span>
              {s.label} <span className="muted">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Hero number for a single headline metric -- not a chart, by design. */
export function StatTile({ label, value, suffix = '', sub, tone, icon }) {
  const toneColor = {
    good: 'var(--status-good)', warning: 'var(--status-warning)',
    critical: 'var(--status-critical)', default: 'var(--series-1)',
  }[tone || 'default'];

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide muted">
        {icon && <span aria-hidden style={{ color: toneColor }}>{icon}</span>}
        {label}
      </div>
      <p className="mt-1.5 font-semibold tabular-nums" style={{ fontSize: '1.75rem', lineHeight: 1.1 }}>
        {value}<span className="text-base muted">{suffix}</span>
      </p>
      {sub && <p className="text-xs secondary-ink mt-1">{sub}</p>}
    </div>
  );
}

/** Risk meter: an ordered 0-100 track, always paired with its level label. */
export function RiskMeter({ score, level, drivers = [] }) {
  const color = { low: 'var(--status-good)', medium: 'var(--status-warning)', high: 'var(--status-critical)' }[level];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm secondary-ink">Risk score</span>
        <span className="text-sm font-semibold tabular-nums">{score}<span className="muted">/100</span></span>
      </div>
      <div className="w-full rounded-full overflow-hidden" style={{ height: 8, background: 'var(--gridline)' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      {drivers.length > 0 && (
        <p className="text-xs secondary-ink mt-2">
          Main drivers: {drivers.slice(0, 3).join(', ')}
        </p>
      )}
    </div>
  );
}

export const ATTENDANCE_SEGMENTS = (summary) => [
  { label: 'Present', glyph: '✓', value: summary.present || 0, color: 'var(--status-good)' },
  { label: 'Late', glyph: '◐', value: summary.late || 0, color: 'var(--status-warning)' },
  { label: 'Partial', glyph: '◔', value: summary.partial || 0, color: 'var(--status-serious)' },
  { label: 'Absent', glyph: '✕', value: summary.absent || 0, color: 'var(--status-critical)' },
];
