import React from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, useColorScheme,
} from 'react-native';
import { light, dark, STATUS_META, radius, spacing } from '../theme';

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}

export function Screen({ children, style }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.plane }, style]}>{children}</View>;
}

export function Card({ children, style }) {
  const t = useTheme();
  return (
    <View style={[{
      backgroundColor: t.surface, borderColor: t.border, borderWidth: 1,
      borderRadius: radius.md, padding: spacing(4),
    }, style]}>{children}</View>
  );
}

export function Loading({ label = 'Loading' }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing(3) }}>
      <ActivityIndicator color={t.series1} />
      <Text style={{ color: t.textSecondary, fontSize: 14 }}>{label}…</Text>
    </View>
  );
}

export function ErrorView({ error, onRetry }) {
  const t = useTheme();
  if (!error) return null;
  return (
    <Card style={{ margin: spacing(4) }}>
      <Text style={{ color: t.text, fontWeight: '600' }}>Something went wrong</Text>
      <Text style={{ color: t.textSecondary, marginTop: 4 }}>{error.message}</Text>
      {onRetry && <Button title="Retry" onPress={onRetry} variant="ghost" style={{ marginTop: spacing(3) }} />}
    </Card>
  );
}

export function Button({ title, onPress, variant = 'primary', disabled, style }) {
  const t = useTheme();
  const styles = {
    primary: { backgroundColor: t.series1, color: '#fff' },
    ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: t.border, color: t.text },
    danger: { backgroundColor: '#d03b3b', color: '#fff' },
  }[variant];

  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}
      style={[{
        backgroundColor: styles.backgroundColor,
        borderWidth: styles.borderWidth, borderColor: styles.borderColor,
        paddingVertical: spacing(3), paddingHorizontal: spacing(4),
        borderRadius: radius.sm, alignItems: 'center', opacity: disabled ? 0.5 : 1,
      }, style]}>
      <Text style={{ color: styles.color, fontWeight: '600', fontSize: 14 }}>{title}</Text>
    </TouchableOpacity>
  );
}

/** Colour never carries meaning alone -- the glyph and word always ship with it. */
export function StatusChip({ status, label }) {
  const t = useTheme();
  const meta = STATUS_META[status] || { color: t.textMuted, glyph: '·', label: status };
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
      backgroundColor: meta.color + '24', paddingHorizontal: spacing(2),
      paddingVertical: 3, borderRadius: radius.pill,
    }}>
      <Text style={{ color: meta.color, fontWeight: '700', fontSize: 11 }}>{meta.glyph}</Text>
      <Text style={{ color: t.text, fontSize: 11, fontWeight: '600' }}>{label || meta.label}</Text>
    </View>
  );
}

export function StatTile({ label, value, suffix = '', sub, tone }) {
  const t = useTheme();
  const toneColor = { good: '#0ca30c', warning: '#fab219', critical: '#d03b3b' }[tone] || t.series1;
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Text style={{ color: t.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ color: t.text, fontSize: 26, fontWeight: '700', marginTop: 4 }}>
        {value}<Text style={{ fontSize: 15, color: t.textMuted }}>{suffix}</Text>
      </Text>
      {sub && <Text style={{ color: t.textSecondary, fontSize: 11, marginTop: 2 }}>{sub}</Text>}
      <View style={{ height: 3, backgroundColor: toneColor, borderRadius: 2, marginTop: spacing(2), width: 28 }} />
    </Card>
  );
}

/** Horizontal proportion bar. Always accompanied by a labelled legend. */
export function ProgressBar({ segments, height = 10 }) {
  const t = useTheme();
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <View>
      <View style={{ flexDirection: 'row', height, borderRadius: height / 2, overflow: 'hidden', gap: 2 }}>
        {segments.filter((s) => s.value > 0).map((s) => (
          <View key={s.label} style={{ flex: s.value / total, backgroundColor: s.color }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(2) }}>
        {segments.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }} />
            <Text style={{ color: t.textSecondary, fontSize: 11 }}>{s.label} {s.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Avatar({ user, size = 34 }) {
  const t = useTheme();
  const initials = (user?.name || '?').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: t.series1 + '28', alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: t.series1, fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function EmptyState({ title, description, action }) {
  const t = useTheme();
  return (
    <Card style={{ margin: spacing(4), alignItems: 'center', paddingVertical: spacing(10) }}>
      <Text style={{ color: t.text, fontWeight: '600' }}>{title}</Text>
      {description && (
        <Text style={{ color: t.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
          {description}
        </Text>
      )}
      {action}
    </Card>
  );
}

export const sheet = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(3) },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3) },
  h1: { fontSize: 22, fontWeight: '700' },
  h2: { fontSize: 16, fontWeight: '600' },
});
