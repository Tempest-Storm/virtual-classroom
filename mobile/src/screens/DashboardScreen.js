import React, { useCallback, useState } from 'react';
import { ScrollView, View, Text, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { analyticsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Card, Loading, ErrorView, StatTile, StatusChip, ProgressBar, useTheme, sheet, EmptyState,
} from '../components/ui';
import { spacing, status } from '../theme';

export default function DashboardScreen({ navigation }) {
  const t = useTheme();
  const { user, isTeacher } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await (isTeacher ? analyticsApi.teacherDashboard() : analyticsApi.studentDashboard()));
      setError(null);
    } catch (err) { setError(err); }
  }, [isTeacher]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) return <ErrorView error={error} onRetry={load} />;
  if (!data) return <Loading label="Analysing performance" />;

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <ScrollView
      style={{ backgroundColor: t.plane }}
      contentContainerStyle={{ padding: spacing(4), gap: spacing(4) }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.series1} />}>

      <View>
        <Text style={[sheet.h1, { color: t.text }]}>
          Hello, {user.name.split(' ')[0]}
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }}>
          {isTeacher ? 'Your teaching overview' : 'Your progress across all courses'}
        </Text>
      </View>

      {isTeacher ? <TeacherBody data={data} navigation={navigation} /> : <StudentBody data={data} navigation={navigation} />}
    </ScrollView>
  );
}

function StudentBody({ data, navigation }) {
  const t = useTheme();
  const { overview, insights, upcomingSessions, pendingAssignments } = data;

  if (!overview.courses.length) {
    return <EmptyState title="No courses yet"
      description="Join a course from the Courses tab using the code your teacher gave you." />;
  }

  return (
    <>
      <View style={sheet.wrapRow}>
        <StatTile label="Overall grade" value={overview.overallGrade} suffix="%"
          sub={`Grade ${overview.letter}`}
          tone={overview.overallGrade >= 75 ? 'good' : overview.overallGrade >= 60 ? 'warning' : 'critical'} />
        <StatTile label="Attendance" value={overview.overallAttendance} suffix="%"
          sub="AI-recorded"
          tone={overview.overallAttendance >= 85 ? 'good' : 'warning'} />
      </View>
      <View style={sheet.wrapRow}>
        <StatTile label="Pending work" value={pendingAssignments.length}
          sub={pendingAssignments[0]?.title || 'Nothing due'} />
        <StatTile label="Classes soon" value={upcomingSessions.length}
          sub={upcomingSessions[0]
            ? new Date(upcomingSessions[0].scheduledStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : 'None scheduled'} />
      </View>

      {insights.length > 0 && (
        <View style={{ gap: spacing(3) }}>
          <Text style={[sheet.h2, { color: t.text }]}>What the AI noticed</Text>
          {insights.map((i) => (
            <Card key={i._id} style={{ gap: 6 }}>
              <StatusChip status={i.severity} />
              <Text style={{ color: t.text, fontWeight: '600' }}>{i.title}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 13 }}>{i.message}</Text>
              {i.recommendation && (
                <Text style={{
                  color: t.text, fontSize: 13, borderLeftWidth: 2, borderLeftColor: t.series1,
                  paddingLeft: spacing(2), marginTop: 2,
                }}>{i.recommendation}</Text>
              )}
            </Card>
          ))}
        </View>
      )}

      <Text style={[sheet.h2, { color: t.text }]}>Your courses</Text>
      {overview.courses.map((c) => (
        <TouchableOpacity key={c.course.id} activeOpacity={0.85}
          onPress={() => navigation.navigate('CourseDetail', { id: c.course.id, title: c.course.title })}>
          <Card style={{ gap: spacing(2) }}>
            <View style={[sheet.row, { justifyContent: 'space-between' }]}>
              <Text style={{ color: t.textMuted, fontWeight: '700', fontSize: 11 }}>{c.course.code}</Text>
              <StatusChip status={c.risk.level} />
            </View>
            <Text style={{ color: t.text, fontWeight: '600' }}>{c.course.title}</Text>
            <View style={[sheet.row, { gap: spacing(6) }]}>
              <View>
                <Text style={{ color: t.textMuted, fontSize: 11 }}>Grade</Text>
                <Text style={{ color: t.text, fontWeight: '700' }}>{c.grade.percent}% {c.grade.letter}</Text>
              </View>
              <View>
                <Text style={{ color: t.textMuted, fontSize: 11 }}>Attendance</Text>
                <Text style={{ color: t.text, fontWeight: '700' }}>{c.attendance.rate}%</Text>
              </View>
            </View>
            <ProgressBar segments={[
              { label: 'Attended', value: c.attendance.attended, color: status.good },
              { label: 'Partial', value: c.attendance.partial, color: status.serious },
              { label: 'Missed', value: c.attendance.absent, color: status.critical },
            ]} />
          </Card>
        </TouchableOpacity>
      ))}
    </>
  );
}

function TeacherBody({ data, navigation }) {
  const t = useTheme();
  const { summary, courses, atRiskStudents, insights } = data;

  return (
    <>
      <View style={sheet.wrapRow}>
        <StatTile label="Class average" value={summary.classAverage} suffix="%"
          tone={summary.classAverage >= 75 ? 'good' : 'warning'} sub={`${summary.courses} courses`} />
        <StatTile label="Attendance" value={summary.averageAttendance} suffix="%"
          tone={summary.averageAttendance >= 85 ? 'good' : 'warning'} sub={`${summary.students} students`} />
      </View>
      <View style={sheet.wrapRow}>
        <StatTile label="At risk" value={summary.atRiskStudents}
          tone={summary.atRiskStudents ? 'critical' : 'good'} sub="Need intervention" />
        <StatTile label="To grade" value={summary.ungradedSubmissions} sub="Submissions" />
      </View>

      {insights.length > 0 && (
        <View style={{ gap: spacing(3) }}>
          <Text style={[sheet.h2, { color: t.text }]}>Course insights</Text>
          {insights.map((i) => (
            <Card key={i._id} style={{ gap: 6 }}>
              <StatusChip status={i.severity} />
              <Text style={{ color: t.text, fontWeight: '600' }}>{i.title}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 13 }}>{i.message}</Text>
            </Card>
          ))}
        </View>
      )}

      {atRiskStudents.length > 0 && (
        <View style={{ gap: spacing(3) }}>
          <Text style={[sheet.h2, { color: t.text }]}>Students needing attention</Text>
          {atRiskStudents.map((r) => (
            <Card key={`${r.student.id}-${r.course.id}`} style={{ gap: 4 }}>
              <View style={[sheet.row, { justifyContent: 'space-between' }]}>
                <Text style={{ color: t.text, fontWeight: '600' }}>{r.student.name}</Text>
                <StatusChip status={r.risk.level} />
              </View>
              <Text style={{ color: t.textSecondary, fontSize: 12 }}>
                {r.course.title} · attendance {r.attendance}% · grade {r.grade}%
              </Text>
              <Text style={{ color: t.textMuted, fontSize: 11 }}>
                Drivers: {r.risk.drivers.slice(0, 3).join(', ')}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <Text style={[sheet.h2, { color: t.text }]}>Courses</Text>
      {courses.map((c) => (
        <TouchableOpacity key={c.courseId} activeOpacity={0.85}
          onPress={() => navigation.navigate('CourseDetail', { id: c.courseId, title: c.title })}>
          <Card style={{ gap: 6 }}>
            <Text style={{ color: t.textMuted, fontWeight: '700', fontSize: 11 }}>{c.code}</Text>
            <Text style={{ color: t.text, fontWeight: '600' }}>{c.title}</Text>
            <Text style={{ color: t.textSecondary, fontSize: 12 }}>
              {c.studentCount} students · average {c.classAverage}% · {c.atRisk} at risk
            </Text>
          </Card>
        </TouchableOpacity>
      ))}
    </>
  );
}
