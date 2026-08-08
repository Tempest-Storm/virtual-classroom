import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { courseApi, sessionApi, analyticsApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, Avatar, StatusChip, Modal, EmptyState } from '../components/ui.jsx';
import { StatTile, BarChart } from '../components/charts.jsx';

export default function CourseDetail() {
  const { id } = useParams();
  const { isTeacher } = useAuth();
  const course = useAsync(() => courseApi.get(id), [id]);
  const sessions = useAsync(() => sessionApi.list(`?courseId=${id}`), [id]);
  const analytics = useAsync(
    () => (isTeacher ? analyticsApi.course(id) : Promise.resolve(null)), [id, isTeacher]);
  const [modal, setModal] = useState(null);

  if (course.loading) return <Spinner />;
  if (course.error) return <ErrorBox error={course.error} onRetry={course.reload} />;

  const c = course.data.course;
  const a = analytics.data;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div style={{ background: c.coverColor, height: 8 }} aria-hidden />
        <div className="p-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold muted">{c.code}</p>
            <h1 className="text-2xl font-semibold">{c.title}</h1>
            <p className="secondary-ink text-sm mt-1 max-w-2xl">{c.description}</p>
            <p className="text-xs muted mt-2">{c.teacher?.name} · {c.students.length} students</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to={`/courses/${id}/scoreboard`} className="btn btn-ghost">Scoreboard</Link>
            {isTeacher && <Link to={`/courses/${id}/attendance`} className="btn btn-ghost">Attendance</Link>}
            {isTeacher && <button className="btn btn-primary" onClick={() => setModal('session')}>Schedule class</button>}
          </div>
        </div>
      </div>

      {isTeacher && a && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Class average" value={a.classAverage} suffix="%" icon="◆"
            tone={a.classAverage >= 75 ? 'good' : a.classAverage >= 60 ? 'warning' : 'critical'} />
          <StatTile label="Median" value={a.median} suffix="%" icon="◈" />
          <StatTile label="Attendance" value={a.averageAttendance} suffix="%" icon="◉" />
          <StatTile label="At risk" value={a.atRisk} icon="!" tone={a.atRisk ? 'critical' : 'good'} />
        </div>
      )}

      {isTeacher && a && (
        <section className="card p-5">
          <h2 className="font-semibold mb-1">Grade distribution</h2>
          <p className="text-sm secondary-ink mb-3">Students per letter grade.</p>
          <BarChart label="Students"
            data={Object.entries(a.distribution).map(([letter, count]) => ({
              label: letter, value: count,
              color: letter === 'F' ? 'var(--status-critical)' : 'var(--series-1)',
            }))} />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Classes</h2>
          {sessions.data?.sessions?.length > 0 && (
            <span className="text-sm muted">{sessions.data.sessions.length} total</span>
          )}
        </div>

        {sessions.loading ? <Spinner /> : !sessions.data?.sessions?.length ? (
          <EmptyState icon="▶" title="No classes scheduled"
            description={isTeacher ? 'Schedule the first class for this course.' : 'Your teacher has not scheduled a class yet.'} />
        ) : (
          <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {sessions.data.sessions.map((s) => (
              <SessionRow key={s._id} session={s} isTeacher={isTeacher} onChanged={sessions.reload} />
            ))}
          </div>
        )}
      </section>

      {isTeacher && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Students</h2>
            <button className="btn btn-ghost text-sm" onClick={() => setModal('student')}>Add student</button>
          </div>
          <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {c.students.map((s) => (
              <div key={s._id} className="p-3 flex items-center gap-3">
                <Avatar user={s} size={32} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs muted truncate">{s.studentId || s.email}</p>
                </div>
                {s.faceEnrolledAt
                  ? <StatusChip status="present">Face enrolled</StatusChip>
                  : <StatusChip status="pending">No face data</StatusChip>}
              </div>
            ))}
          </div>
        </section>
      )}

      <ScheduleModal open={modal === 'session'} courseId={id}
        onClose={() => setModal(null)} onDone={sessions.reload} />
      <AddStudentModal open={modal === 'student'} courseId={id}
        onClose={() => setModal(null)} onDone={course.reload} />
    </div>
  );
}

function SessionRow({ session, isTeacher, onChanged }) {
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try { await sessionApi.start(session._id); location.href = `/class/${session.roomId}`; }
    catch (err) { alert(err.message); setBusy(false); }
  }

  return (
    <div className="p-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-0">
        <p className="font-medium flex items-center gap-2">
          {session.title}
          {session.status === 'live' && <StatusChip status="critical">Live now</StatusChip>}
        </p>
        <p className="text-xs muted">
          {new Date(session.scheduledStart).toLocaleString()} · {session.durationMinutes} min
          {session.isRecorded && ' · recorded'}
        </p>
      </div>

      {session.recordingUrl && (
        <a className="btn btn-ghost text-sm" href={session.recordingUrl} target="_blank" rel="noreferrer">
          Watch recording
        </a>
      )}

      {session.status === 'live' && (
        <Link className="btn btn-primary" to={`/class/${session.roomId}`}>Join</Link>
      )}
      {session.status === 'scheduled' && isTeacher && (
        <button className="btn btn-primary" onClick={start} disabled={busy}>
          {busy ? 'Starting…' : 'Start class'}
        </button>
      )}
      {session.status === 'ended' && <span className="text-sm muted">Ended</span>}
    </div>
  );
}

function ScheduleModal({ open, courseId, onClose, onDone }) {
  const nextHour = new Date(Date.now() + 3600000);
  nextHour.setMinutes(0, 0, 0);
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [form, setForm] = useState({
    title: '', topic: '',
    scheduledStart: iso(nextHour),
    scheduledEnd: iso(new Date(nextHour.getTime() + 7200000)),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await sessionApi.create({ ...form, course: courseId }); onDone(); onClose(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule a class">
      <form onSubmit={submit}>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--status-critical)' }}>{error}</p>}
        <label className="block text-sm font-medium mb-1">Title</label>
        <input className="input mb-3" required value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Week 9: Model Evaluation" />

        <label className="block text-sm font-medium mb-1">Topic</label>
        <input className="input mb-3" value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })} />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Starts</label>
            <input className="input" type="datetime-local" required value={form.scheduledStart}
              onChange={(e) => setForm({ ...form, scheduledStart: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ends</label>
            <input className="input" type="datetime-local" required value={form.scheduledEnd}
              onChange={(e) => setForm({ ...form, scheduledEnd: e.target.value })} />
          </div>
        </div>

        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Scheduling…' : 'Schedule'}</button>
      </form>
    </Modal>
  );
}

function AddStudentModal({ open, courseId, onClose, onDone }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await courseApi.addStudent(courseId, email); onDone(); onClose(); setEmail(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a student" width={420}>
      <form onSubmit={submit}>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--status-critical)' }}>{error}</p>}
        <label className="block text-sm font-medium mb-1">Student email</label>
        <input className="input mb-4" type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Adding…' : 'Add to course'}</button>
      </form>
    </Modal>
  );
}
