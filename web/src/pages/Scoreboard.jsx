import { useParams } from 'react-router-dom';
import { analyticsApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, Avatar, StatusChip } from '../components/ui.jsx';
import { BarChart, StatTile } from '../components/charts.jsx';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Scoreboard() {
  const { id } = useParams();
  const { isTeacher } = useAuth();
  const { data, error, loading, reload } = useAsync(() => analyticsApi.scoreboard(id), [id]);

  if (loading) return <Spinner label="Ranking the class" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const me = data.entries.find((e) => e.isMe);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold muted">Scoreboard</p>
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <p className="secondary-ink text-sm">
          Ranked by weighted course grade. {isTeacher ? 'Engagement and risk are visible to you only.' : 'Only names and grades are shown to classmates.'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Class average" value={data.classAverage} suffix="%" icon="◆" />
        <StatTile label="Students ranked" value={data.entries.length} icon="▤" />
        {me && <StatTile label="Your rank" value={`#${me.rank}`} icon="◈" sub={`${me.grade}% · ${me.letter}`} />}
        {me && <StatTile label="Your attendance" value={me.attendance} suffix="%" icon="◉"
          tone={me.attendance >= 85 ? 'good' : me.attendance >= 70 ? 'warning' : 'critical'} />}
      </div>

      <section className="card p-5">
        <h2 className="font-semibold mb-1">Grade distribution</h2>
        <p className="text-sm secondary-ink mb-3">How the class is spread across letter grades.</p>
        <BarChart label="Students"
          data={Object.entries(data.distribution).map(([letter, count]) => ({
            label: letter, value: count,
            color: letter === 'F' ? 'var(--status-critical)' : 'var(--series-1)',
          }))} />
      </section>

      <section className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wide muted border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="py-3 px-4 font-medium">Rank</th>
                <th className="py-3 px-4 font-medium">Student</th>
                <th className="py-3 px-4 font-medium">Grade</th>
                <th className="py-3 px-4 font-medium">Attendance</th>
                {isTeacher && <th className="py-3 px-4 font-medium">Engagement</th>}
                {isTeacher && <th className="py-3 px-4 font-medium">Risk</th>}
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.rank} className="border-b" style={{
                  borderColor: 'var(--gridline)',
                  background: e.isMe ? 'color-mix(in srgb, var(--series-1) 8%, transparent)' : undefined,
                }}>
                  <td className="py-3 px-4 font-semibold tabular-nums">
                    <span aria-hidden className="mr-1">{MEDAL[e.rank] || ''}</span>{e.rank}
                  </td>
                  <td className="py-3 px-4">
                    <span className="flex items-center gap-2">
                      <Avatar user={e} size={28} />
                      <span className="font-medium">{e.name}</span>
                      {e.isMe && <span className="text-xs" style={{ color: 'var(--series-1)' }}>you</span>}
                    </span>
                  </td>
                  <td className="py-3 px-4 tabular-nums font-semibold">
                    {e.grade}% <span className="muted font-normal">{e.letter}</span>
                  </td>
                  <td className="py-3 px-4 tabular-nums">{e.attendance}%</td>
                  {isTeacher && <td className="py-3 px-4 tabular-nums">{e.engagement}</td>}
                  {isTeacher && <td className="py-3 px-4"><StatusChip status={e.risk} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
