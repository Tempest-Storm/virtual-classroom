/**
 * Same token values as the web client, so a chart or status chip means the
 * same thing on both platforms.
 */
export const light = {
  surface: '#fcfcfb',
  plane: '#f9f9f7',
  text: '#0b0b0b',
  textSecondary: '#52514e',
  textMuted: '#898781',
  grid: '#e1e0d9',
  border: '#e1e0d9',
  series1: '#2a78d6',
  series2: '#eb6834',
};

export const dark = {
  surface: '#1a1a19',
  plane: '#0d0d0d',
  text: '#ffffff',
  textSecondary: '#c3c2b7',
  textMuted: '#898781',
  grid: '#2c2c2a',
  border: '#2c2c2a',
  series1: '#3987e5',
  series2: '#d95926',
};

// Status colours are fixed across modes and never used alone -- every usage
// pairs them with a glyph and a label.
export const status = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};

export const STATUS_META = {
  present:   { color: status.good,     glyph: '✓',  label: 'Present' },
  late:      { color: status.warning,  glyph: '◐',  label: 'Late' },
  partial:   { color: status.serious,  glyph: '◔',  label: 'Partial' },
  absent:    { color: status.critical, glyph: '✕',  label: 'Absent' },
  low:       { color: status.good,     glyph: '✓',  label: 'Low risk' },
  medium:    { color: status.warning,  glyph: '!',  label: 'Medium risk' },
  high:      { color: status.critical, glyph: '!!', label: 'High risk' },
  graded:    { color: status.good,     glyph: '✓',  label: 'Graded' },
  submitted: { color: '#2a78d6',       glyph: '↑',  label: 'Submitted' },
  pending:   { color: status.warning,  glyph: '○',  label: 'Pending' },
  missing:   { color: status.critical, glyph: '✕',  label: 'Missing' },
  info:      { color: '#2a78d6',       glyph: 'i',  label: 'Info' },
  warning:   { color: status.warning,  glyph: '!',  label: 'Warning' },
  critical:  { color: status.critical, glyph: '!!', label: 'Critical' },
};

export const spacing = (n) => n * 4;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
