import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { Spinner, ErrorBox, StatusChip, Avatar, EmptyState } from '../components/ui.jsx';
import { StatTile, BarChart, StackedBar } from '../components/charts.jsx';

export default function TeacherDashboard() {
  const { data, error, loading, reload } = useAsync(() => analyticsApi.teacherDashboard(), []);

  if (loading) return <Spinner label="Compiling class analytics" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const { summary, courses, atRiskStudents, upcomingSessions, insights } = data;

  if (!courses.length) {
    return (
      <EmptyState icon="▤" title="No courses yet"
        description="Create a course, share the code with your students, then schedule your first live class."
        action={<Link to="/courses" className="btn btn-primary">Create a course</Link>} />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Teaching overview</h1>
          <p className="secondary-ink text-sm">{summary.courses} courses · {summary.students} students</p>
        </div>
        <Link to="/courses" className="btn btn-ghost">Manage courses</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Class average" value={summary.classAverage} suffix="%" icon="◆"
          tone={summary.classAverage >= 75 ? 'good' : summary.classAverage >= 60 ? 'warning' : 'critical'}
          sub="Weighted across all courses" />
        <StatTile label="Avg attendance" value={summary.averageAttendance} suffix="%" icon="◉"
          tone={summary.averageAttendance >= 85 ? 'good' : 'warning'} sub="AI-recorded" />
        <StatTile label="Students at risk" value={summary.atRiskStudents} icon="!"
          tone={summary.atRiskStudents ? 'critical' : 'good'} sub="Flagged for intervention" />
        <StatTile label="Awaiting grading" value={summary.ungradedSubmissions} icon="✎"
          sub="Submissions in the queue" />
      </div>

      {insights.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Course insights</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <article key={i._id} className="card p-4 flex items-start gap-3">
                <StatusChip status={i.severity} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{i.title}</p>
                  <p className="text-sm secondary-ink mt-0.5">{i.message}</p>
                  {i.recommendation && (
                    <p className="text-sm mt-2 pl-3 border-l-2" style={{ borderColor: 'var(--series-1)' }}>
                      {i.recommendation}
                    </p>
                  )}
                  {i.course && <p className="text-xs muted mt-2">{i.course.code}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {atRiskStudents.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">Students needing attention</h2>
          <p className="text-sm secondary-ink mb-4">
            Ranked by a transparent risk score — attendance, grade, engagement, missing work, and trend.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wide muted">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Course</th>
                  <th className="py-2 pr-4 font-medium">Attendance</th>
                  <th className="py-2 pr-4 font-medium">Grade</th>
                  <th className="py-2 pr-4 font-medium">Risk</th>
                  <th className="py-2 font-medium">Main drivers</th>
                </tr>
              </thead>
              <tbody>
                {atRiskStudents.map((r) => (
                  <tr key={`${r.student.id}-${r.course.id}`} className="border-t" style={{ borderColor: 'var(--gridline)' }}>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2">
                        <Avatar user={r.student} size={26} />
                        <span className="font-medium">{r.student.name}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 secondary-ink">{r.course.title}</td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.attendance}%</td>
                    <td className="py-2.5 pr-4 tabular-nums">{r.grade}%</td>
                    <td className="py-2.5 pr-4"><StatusChip status={r.risk.level} /></td>
                    <td className="py-2.5 secondary-ink text-xs">{r.risk.drivers.slice(0, 3).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid gap-3 lg:grid-cols-2">
        {courses.map((c) => (
          <article key={c.courseId} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold muted">{c.code}</p>
                <h3 className="font-medium">{c.title}</h3>
                <p className="text-xs muted mt-0.5">{c.studentCount} students · {c.atRisk} at risk</p>
              </div>
              <Link to={`/courses/${c.courseId}`} className="btn btn-ghost text-xs">Open</Link>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 text-sm">
              <div><p className="muted text-xs">Average</p><p className="font-semibold tabular-nums">{c.classAverage}%</p></div>
              <div><p className="muted text-xs">Median</p><p className="font-semibold tabular-nums">{c.median}%</p></div>
              <div><p className="muted text-xs">Attendance</p><p className="font-semibold tabular-nums">{c.averageAttendance}%</p></div>
            </div>

            <div className="mt-4">
              <p className="text-xs muted mb-2">Grade distribution</p>
              <BarChart height={160} label="Students"
                data={Object.entries(c.distribution).map(([letter, count]) => ({
                  label: letter, value: count,
                  color: letter === 'F' ? 'var(--status-critical)' : 'var(--series-1)',
                }))} />
            </div>
          </article>
        ))}
      </section>

      {upcomingSessions.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Your next classes</h2>
          <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {upcomingSessions.map((s) => (
              <div key={s._id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs muted">{s.course?.code} · {new Date(s.scheduledStart).toLocaleString()}</p>
                </div>
                <Link to={`/class/${s.roomId}`} className="btn btn-primary">
                  {s.status === 'live' ? 'Rejoin' : 'Start class'}
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
