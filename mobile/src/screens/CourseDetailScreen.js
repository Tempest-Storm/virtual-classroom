import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { courseApi, sessionApi } from '../api/client';
import { Card, Loading, ErrorView, Button, StatusChip, useTheme, sheet } from '../components/ui';
import { spacing } from '../theme';

export default function CourseDetailScreen({ route, navigation }) {
  const t = useTheme();
  const { id } = route.params;
  const [course, setCourse] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([courseApi.get(id), sessionApi.list(id)]);
      setCourse(c.course);
      setSessions(s.sessions);
      setError(null);
    } catch (err) { setError(err); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!course) return <Loading />;

  const live = sessions.filter((s) => s.status === 'live');
  const upcoming = sessions.filter((s) => s.status === 'scheduled');
  const past = sessions.filter((s) => s.status === 'ended');

  return (
    <ScrollView style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>

      <Card style={{ gap: 6 }}>
        <Text style={{ color: t.textMuted, fontWeight: '700', fontSize: 11 }}>{course.code}</Text>
        <Text style={[sheet.h1, { color: t.text }]}>{course.title}</Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }}>{course.description}</Text>
        <Text style={{ color: t.textMuted, fontSize: 11 }}>
          {course.teacher?.name} · {course.students.length} students
        </Text>
        <Button title="View scoreboard" variant="ghost" style={{ marginTop: spacing(2) }}
          onPress={() => navigation.navigate('Scoreboard', { id, title: course.title })} />
      </Card>

      {live.length > 0 && (
        <View style={{ gap: spacing(2) }}>
          <Text style={[sheet.h2, { color: t.text }]}>Live now</Text>
          {live.map((s) => (
            <Card key={s._id} style={{ gap: spacing(2) }}>
              <View style={[sheet.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{s.title}</Text>
                <StatusChip status="critical" label="Live" />
              </View>
              <Button title="Join class"
                onPress={() => navigation.navigate('Classroom', { roomId: s.roomId, title: s.title })} />
            </Card>
          ))}
        </View>
      )}

      {upcoming.length > 0 && (
        <View style={{ gap: spacing(2) }}>
          <Text style={[sheet.h2, { color: t.text }]}>Upcoming</Text>
          {upcoming.map((s) => (
            <Card key={s._id} style={{ gap: 4 }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{s.title}</Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>
                {new Date(s.scheduledStart).toLocaleString()}
              </Text>
            </Card>
          ))}
        </View>
      )}

      {past.length > 0 && (
        <View style={{ gap: spacing(2) }}>
          <Text style={[sheet.h2, { color: t.text }]}>Past classes</Text>
          {past.map((s) => (
            <Card key={s._id} style={{ gap: 4 }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{s.title}</Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>
                {new Date(s.scheduledStart).toLocaleDateString()} · {s.durationMinutes} min
              </Text>
              {s.recordingUrl ? (
                <TouchableOpacity onPress={() => navigation.navigate('Recording', { url: s.recordingUrl, title: s.title })}>
                  <Text style={{ color: t.series1, fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                    ▶  Watch recording
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: t.textMuted, fontSize: 11 }}>No recording</Text>
              )}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
