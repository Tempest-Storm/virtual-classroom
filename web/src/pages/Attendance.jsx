import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { analyticsApi, sessionApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { Spinner, ErrorBox, Avatar, StatusChip, EmptyState } from '../components/ui.jsx';
import { StackedBar, ATTENDANCE_SEGMENTS } from '../components/charts.jsx';

const STATUSES = ['present', 'late', 'partial', 'absent'];

export default function Attendance() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => analyticsApi.attendanceReport(id), [id]);
  const [expanded, setExpanded] = useState(null);

  if (loading) return <Spinner label="Loading attendance records" />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  if (!data.sessions.length) {
    return <EmptyState icon="◉" title="No attendance recorded yet"
      description="Attendance appears here once you have run a live class." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Attendance report</h1>
        <p className="secondary-ink text-sm">
          Recorded automatically by face recognition. Anything the AI got wrong can be corrected here —
          overrides are kept and never recalculated.
        </p>
      </div>

      {data.sessions.map((s) => {
        const segments = ATTENDANCE_SEGMENTS(s);
        const isOpen = expanded === s.session?._id;

        return (
          <section key={s.session?._id} className="card p-5">
            <button className="w-full text-left" onClick={() => setExpanded(isOpen ? null : s.session?._id)}>
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-medium">{s.session?.title}</p>
                  <p className="text-xs muted">{new Date(s.session?.scheduledStart).toLocaleString()}</p>
                </div>
                <span className="text-sm secondary-ink">
                  {s.present + s.late} of {s.records.length} attended · {isOpen ? 'Hide' : 'Show'} students
                </span>
              </div>
              <div className="mt-3">
                <StackedBar segments={segments} />
              </div>
            </button>

            {isOpen && (
              <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide muted">
                      <th className="py-2 pr-4 font-medium">Student</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Minutes</th>
                      <th className="py-2 pr-4 font-medium">Engagement</th>
                      <th className="py-2 font-medium">Correct</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.records.map((r) => (
                      <Row key={r.student?._id} record={r} sessionId={s.session?._id} onDone={reload} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({ record, sessionId, onDone }) {
  const [busy, setBusy] = useState(false);

  async function override(status) {
    setBusy(true);
    try { await sessionApi.override(sessionId, record.student._id, status, 'Corrected by teacher'); onDone(); }
    catch (err) { alert(err.message); } finally { setBusy(false); }
  }

  return (
    <tr className="border-t" style={{ borderColor: 'var(--gridline)' }}>
      <td className="py-2.5 pr-4">
        <span className="flex items-center gap-2">
          <Avatar user={record.student} size={26} />
          <span>
            <span className="font-medium">{record.student?.name}</span>
            <span className="block text-xs muted">{record.student?.studentId}</span>
          </span>
        </span>
      </td>
      <td className="py-2.5 pr-4"><StatusChip status={record.status} /></td>
      <td className="py-2.5 pr-4 tabular-nums">{record.minutes || 0}</td>
      <td className="py-2.5 pr-4 tabular-nums">{record.engagement ? Math.round(record.engagement) : '—'}</td>
      <td className="py-2.5">
        <select className="input !py-1 !text-xs" style={{ width: 110 }} disabled={busy}
          value={record.status} onChange={(e) => override(e.target.value)} aria-label="Correct attendance status">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>
    </tr>
  );
}
