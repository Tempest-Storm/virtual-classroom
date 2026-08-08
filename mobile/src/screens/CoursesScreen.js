import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { courseApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Card, Loading, ErrorView, Button, useTheme, sheet, EmptyState } from '../components/ui';
import { spacing, radius } from '../theme';

export default function CoursesScreen({ navigation }) {
  const t = useTheme();
  const { isTeacher } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [code, setCode] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await courseApi.list()); setError(null); }
    catch (err) { setError(err); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function join() {
    try {
      await courseApi.enrolByCode(code.trim().toUpperCase());
      setCode('');
      load();
    } catch (err) { Alert.alert('Could not join', err.message); }
  }

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!data) return <Loading />;

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(3) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.series1} />}>

      {!isTeacher && (
        <Card style={{ gap: spacing(2) }}>
          <Text style={{ color: t.text, fontWeight: '600' }}>Join a course</Text>
          <View style={[sheet.row]}>
            <TextInput
              style={{
                flex: 1, backgroundColor: t.plane, borderColor: t.border, borderWidth: 1,
                borderRadius: radius.sm, padding: spacing(3), color: t.text,
              }}
              value={code} onChangeText={setCode} autoCapitalize="characters"
              placeholder="Course code" placeholderTextColor={t.textMuted} />
            <Button title="Join" onPress={join} disabled={!code.trim()} />
          </View>
        </Card>
      )}

      {data.courses.length === 0 ? (
        <EmptyState title="No courses yet"
          description={isTeacher ? 'Create courses from the web app.' : 'Enter a course code above to enrol.'} />
      ) : data.courses.map((c) => (
        <TouchableOpacity key={c._id} activeOpacity={0.85}
          onPress={() => navigation.navigate('CourseDetail', { id: c._id, title: c.title })}>
          <Card style={{ gap: 4 }}>
            <View style={[sheet.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: t.textMuted, fontWeight: '700', fontSize: 11 }}>{c.code}</Text>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.coverColor }} />
            </View>
            <Text style={{ color: t.text, fontWeight: '600' }}>{c.title}</Text>
            <Text style={{ color: t.textSecondary, fontSize: 12 }} numberOfLines={2}>{c.description}</Text>
            <Text style={{ color: t.textMuted, fontSize: 11 }}>
              {c.teacher?.name} · {c.studentCount} students
            </Text>
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
