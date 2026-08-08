import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { analyticsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Loading, ErrorView, StatTile, StatusChip, Avatar, useTheme, sheet } from '../components/ui';
import { spacing } from '../theme';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function ScoreboardScreen({ route }) {
  const t = useTheme();
  const { isTeacher } = useAuth();
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try { setData(await analyticsApi.scoreboard(id)); setError(null); }
    catch (err) { setError(err); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!data) return <Loading label="Ranking the class" />;

  const me = data.entries.find((e) => e.isMe);

  return (
    <ScrollView style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}>

      <View style={sheet.wrapRow}>
        <StatTile label="Class average" value={data.classAverage} suffix="%" />
        {me
          ? <StatTile label="Your rank" value={`#${me.rank}`} sub={`${me.grade}% · ${me.letter}`} />
          : <StatTile label="Students" value={data.entries.length} />}
      </View>

      {data.entries.map((e) => (
        <Card key={e.rank} style={[
          { gap: 4 },
          e.isMe && { borderColor: t.series1, borderWidth: 1.5 },
        ]}>
          <View style={[sheet.row, { justifyContent: 'space-between' }]}>
            <View style={[sheet.row, { flex: 1 }]}>
              <Text style={{ color: t.text, fontWeight: '700', width: 34 }}>
                {MEDAL[e.rank] || `#${e.rank}`}
              </Text>
              <Avatar user={e} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '600' }} numberOfLines={1}>
                  {e.name}{e.isMe ? '  (you)' : ''}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: 11 }}>
                  Attendance {e.attendance}%
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: t.text, fontWeight: '700' }}>{e.grade}% {e.letter}</Text>
              {isTeacher && e.risk && <StatusChip status={e.risk} />}
            </View>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
