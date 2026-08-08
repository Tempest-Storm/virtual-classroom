import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { assignmentApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Loading, ErrorView, Button, StatusChip, useTheme, sheet } from '../components/ui';
import { spacing, radius } from '../theme';

export default function AssignmentDetailScreen({ route }) {
  const t = useTheme();
  const { isTeacher } = useAuth();
  const { id } = route.params;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await assignmentApi.get(id);
      setData(res);
      setText(res.submission?.text || '');
      setError(null);
    } catch (err) { setError(err); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const { assignment, submission } = data;
  const overdue = new Date(assignment.dueDate) < new Date();

  async function submit() {
    setBusy(true);
    try { await assignmentApi.submit(id, text); await load(); Alert.alert('Submitted', 'Your work has been submitted.'); }
    catch (err) { Alert.alert('Could not submit', err.message); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}>

      <Card style={{ gap: 6 }}>
        <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: '700' }}>
          {assignment.course?.code} · {assignment.type}
        </Text>
        <Text style={[sheet.h1, { color: t.text }]}>{assignment.title}</Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }}>{assignment.instructions}</Text>
        <Text style={{ color: t.textMuted, fontSize: 11 }}>
          {assignment.maxScore} points · weight ×{assignment.weight} · due {new Date(assignment.dueDate).toLocaleString()}
        </Text>
      </Card>

      {!isTeacher && submission?.score != null ? (
        <Card style={{ gap: spacing(2) }}>
          <Text style={[sheet.h2, { color: t.text }]}>Your grade</Text>
          <Text style={{ color: t.text, fontSize: 30, fontWeight: '700' }}>
            {submission.score}<Text style={{ fontSize: 16, color: t.textMuted }}>/{assignment.maxScore}</Text>
          </Text>
          {submission.isLate && <StatusChip status="warning" label={`Late — raw score ${submission.rawScore}`} />}
          {submission.feedback && (
            <Text style={{
              color: t.text, fontSize: 13, borderLeftWidth: 2, borderLeftColor: t.series1, paddingLeft: spacing(2),
            }}>{submission.feedback}</Text>
          )}
        </Card>
      ) : !isTeacher ? (
        <Card style={{ gap: spacing(2) }}>
          <View style={[sheet.row, { justifyContent: 'space-between' }]}>
            <Text style={[sheet.h2, { color: t.text }]}>
              {submission ? 'Update submission' : 'Submit your work'}
            </Text>
            {submission && <StatusChip status="submitted" />}
          </View>

          {overdue && (
            <Text style={{ color: t.text, backgroundColor: '#fab21924', padding: spacing(2), borderRadius: radius.sm, fontSize: 12 }}>
              !  {assignment.allowLate
                ? `Past the deadline — a ${assignment.latePenaltyPercent}% penalty applies.`
                : 'The deadline has passed.'}
            </Text>
          )}

          <TextInput multiline value={text} onChangeText={setText}
            placeholder="Type your answer" placeholderTextColor={t.textMuted}
            style={{
              backgroundColor: t.plane, borderColor: t.border, borderWidth: 1, borderRadius: radius.sm,
              padding: spacing(3), color: t.text, minHeight: 140, textAlignVertical: 'top',
            }} />

          <Text style={{ color: t.textMuted, fontSize: 11 }}>
            File attachments are supported in the web app.
          </Text>
          <Button title={busy ? 'Submitting…' : submission ? 'Resubmit' : 'Submit'}
            onPress={submit} disabled={busy || (overdue && !assignment.allowLate) || !text.trim()} />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>
            {data.submissions?.length || 0} submissions · class average {data.analytics?.average}%.
            Grading is done in the web app.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
