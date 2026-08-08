import React, { useCallback, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, RefreshControl, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { assignmentApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Loading, ErrorView, StatusChip, useTheme, sheet, EmptyState } from '../components/ui';
import { spacing } from '../theme';

export default function AssignmentsScreen({ navigation }) {
  const t = useTheme();
  const { isTeacher } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await assignmentApi.list()); setError(null); }
    catch (err) { setError(err); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.series1} />}>

      {data.assignments.length === 0 ? (
        <EmptyState title="No assignments" description="Nothing has been published yet." />
      ) : data.assignments.map((a) => (
        <TouchableOpacity key={a._id} activeOpacity={0.85}
          onPress={() => navigation.navigate('AssignmentDetail', { id: a._id, title: a.title })}>
          <Card style={{ gap: 6 }}>
            <View style={[sheet.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: t.text, fontWeight: '600', flex: 1 }}>{a.title}</Text>
              {isTeacher
                ? <Text style={{ color: t.textSecondary, fontSize: 12 }}>{a.graded}/{a.submitted} graded</Text>
                : <StatusChip status={a.submissionStatus} />}
            </View>
            <Text style={{ color: t.textMuted, fontSize: 11 }}>
              {a.course?.code} · {a.maxScore} pts · due {new Date(a.dueDate).toLocaleDateString()}
            </Text>
            {!isTeacher && a.submission?.score != null && (
              <Text style={{ color: t.text, fontWeight: '700' }}>
                {a.submission.score}/{a.maxScore}
              </Text>
            )}
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
