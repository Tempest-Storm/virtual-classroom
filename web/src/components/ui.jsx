/** Small shared primitives used across every page. */

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-3 p-8 justify-center secondary-ink text-sm">
      <span
        className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
        aria-hidden
      />
      {label}…
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="card p-4 flex items-start gap-3" style={{ borderColor: 'var(--status-critical)' }}>
      <span aria-hidden style={{ color: 'var(--status-critical)' }}>⚠</span>
      <div className="flex-1">
        <p className="font-medium">Something went wrong</p>
        <p className="text-sm secondary-ink">{error.message}</p>
      </div>
      {onRetry && <button className="btn btn-ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function EmptyState({ icon = '—', title, description, action }) {
  return (
    <div className="card p-10 text-center">
      <div className="text-3xl mb-2 muted" aria-hidden>{icon}</div>
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm secondary-ink mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * Status chip. Colour NEVER carries the meaning on its own -- the glyph and
 * the word are always present, which is what keeps the fixed status palette
 * accessible for colour-blind readers and in forced-colors mode.
 */
const STATUS = {
  present:  { color: 'var(--status-good)',     glyph: '✓', label: 'Present' },
  late:     { color: 'var(--status-warning)',  glyph: '◐', label: 'Late' },
  partial:  { color: 'var(--status-serious)',  glyph: '◔', label: 'Partial' },
  absent:   { color: 'var(--status-critical)', glyph: '✕', label: 'Absent' },
  low:      { color: 'var(--status-good)',     glyph: '✓', label: 'Low risk' },
  medium:   { color: 'var(--status-warning)',  glyph: '!', label: 'Medium risk' },
  high:     { color: 'var(--status-critical)', glyph: '!!', label: 'High risk' },
  graded:   { color: 'var(--status-good)',     glyph: '✓', label: 'Graded' },
  submitted:{ color: 'var(--series-1)',        glyph: '↑', label: 'Submitted' },
  pending:  { color: 'var(--status-warning)',  glyph: '○', label: 'Pending' },
  missing:  { color: 'var(--status-critical)', glyph: '✕', label: 'Missing' },
  info:     { color: 'var(--series-1)',        glyph: 'i', label: 'Info' },
  warning:  { color: 'var(--status-warning)',  glyph: '!', label: 'Warning' },
  critical: { color: 'var(--status-critical)', glyph: '!!', label: 'Critical' },
};

export function StatusChip({ status, children, size = 'sm' }) {
  const s = STATUS[status] || { color: 'var(--text-muted)', glyph: '·', label: status };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'}`}
      style={{ background: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: 'var(--text-primary)' }}
    >
      <span aria-hidden style={{ color: s.color, fontWeight: 700 }}>{s.glyph}</span>
      {children || s.label}
    </span>
  );
}

export function Avatar({ user, size = 32 }) {
  const initials = (user?.name || '?')
    .split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return user?.avatarUrl ? (
    <img src={user.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover"
      style={{ width: size, height: size }} />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: 'color-mix(in srgb, var(--series-1) 16%, transparent)',
        color: 'var(--series-1)',
      }}
      aria-hidden
    >{initials}</span>
  );
}

export function Modal({ open, onClose, title, children, width = 520 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.5)' }} onClick={onClose}>
      <div className="card w-full max-h-[90vh] overflow-auto" style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="muted hover:opacity-70 text-xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
