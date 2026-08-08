import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { Spinner, ErrorBox, StatusChip, EmptyState } from '../components/ui.jsx';
import { StatTile, LineChart, RiskMeter, StackedBar } from '../components/charts.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => analyticsApi.studentDashboard(), []);

  if (loading) return <Spinner label="Analysing your performance" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const { overview, upcomingSessions, insights, pendingAssignments } = data;

  if (!overview.courses.length) {
    return (
      <EmptyState icon="▤" title="You are not enrolled in any course yet"
        description="Ask your teacher for a course code, then join from the Courses page."
        action={<Link to="/courses" className="btn btn-primary">Go to Courses</Link>} />
    );
  }

  // Timeline of the course the student is most at risk in -- the one worth watching.
  const focus = overview.highestRisk;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hello, {user.name.split(' ')[0]}</h1>
        <p className="secondary-ink text-sm">Here is how you are doing across {overview.courses.length} courses.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Overall grade" value={overview.overallGrade} suffix="%"
          sub={`Letter grade ${overview.letter}`} icon="◆"
          tone={overview.overallGrade >= 75 ? 'good' : overview.overallGrade >= 60 ? 'warning' : 'critical'} />
        <StatTile label="Attendance" value={overview.overallAttendance} suffix="%"
          sub="Across all live classes" icon="◉"
          tone={overview.overallAttendance >= 85 ? 'good' : overview.overallAttendance >= 70 ? 'warning' : 'critical'} />
        <StatTile label="Pending work" value={pendingAssignments.length}
          sub={pendingAssignments[0] ? `Next: ${pendingAssignments[0].title}` : 'Nothing due'} icon="✎" />
        <StatTile label="Live soon" value={upcomingSessions.length}
          sub={upcomingSessions[0]
            ? new Date(upcomingSessions[0].scheduledStart).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
            : 'No classes scheduled'} icon="▶" />
      </div>

      {insights.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">What the AI noticed</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {insights.map((i) => (
              <article key={i._id} className="card p-4">
                <div className="flex items-start gap-3">
                  <StatusChip status={i.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-sm secondary-ink mt-0.5">{i.message}</p>
                    {i.recommendation && (
                      <p className="text-sm mt-2 pl-3 border-l-2" style={{ borderColor: 'var(--series-1)' }}>
                        {i.recommendation}
                      </p>
                    )}
                    {i.course && <p className="text-xs muted mt-2">{i.course.code} · {i.course.title}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {focus && focus.timeline.length > 1 && (
        <section className="card p-5">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="font-semibold">Score trend — {focus.course.code}</h2>
            <span className="text-sm secondary-ink">
              {focus.slope >= 0 ? 'Improving' : 'Declining'} {Math.abs(focus.slope)} pts per assignment
            </span>
          </div>
          <div className="mt-4">
            <LineChart label="Your score"
              points={focus.timeline.map((t) => ({ label: t.assignment, value: t.percent }))} />
          </div>
          <div className="mt-4 max-w-sm">
            <RiskMeter score={focus.risk.score} level={focus.risk.level} drivers={focus.risk.drivers} />
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-3">Your courses</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {overview.courses.map((c) => (
            <Link key={c.course.id} to={`/courses/${c.course.id}`} className="card p-4 hover:opacity-90 block">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.course.coverColor }} aria-hidden />
                <span className="text-xs font-semibold muted">{c.course.code}</span>
                <span className="ml-auto"><StatusChip status={c.risk.level} /></span>
              </div>
              <p className="font-medium leading-tight">{c.course.title}</p>
              <p className="text-xs muted mt-0.5">{c.course.teacher}</p>

              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div>
                  <p className="muted text-xs">Grade</p>
                  <p className="font-semibold tabular-nums">{c.grade.percent}% <span className="muted font-normal">{c.grade.letter}</span></p>
                </div>
                <div>
                  <p className="muted text-xs">Attendance</p>
                  <p className="font-semibold tabular-nums">{c.attendance.rate}%</p>
                </div>
              </div>

              <div className="mt-3">
                <StackedBar showLegend={false} segments={[
                  { label: 'Attended', value: c.attendance.attended, color: 'var(--status-good)' },
                  { label: 'Partial', value: c.attendance.partial, color: 'var(--status-serious)' },
                  { label: 'Missed', value: c.attendance.absent, color: 'var(--status-critical)' },
                ]} />
                <p className="text-xs muted mt-1">
                  {c.attendance.attended} full
                  {c.attendance.partial > 0 && `, ${c.attendance.partial} partial`}
                  {' '}of {c.attendance.total} classes
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {upcomingSessions.length > 0 && (
        <section>
          <h2 className="font-semibold mb-3">Upcoming classes</h2>
          <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {upcomingSessions.map((s) => (
              <div key={s._id} className="p-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs muted">
                    {s.course?.code} · {new Date(s.scheduledStart).toLocaleString()}
                  </p>
                </div>
                {s.status === 'live' ? (
                  <Link to={`/class/${s.roomId}`} className="btn btn-primary">
                    <span aria-hidden style={{ color: '#fff' }}>●</span> Join live
                  </Link>
                ) : (
                  <span className="text-sm muted">Scheduled</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
