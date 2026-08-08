import { useState } from 'react';
import { Link } from 'react-router-dom';
import { assignmentApi, courseApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, StatusChip, EmptyState, Modal } from '../components/ui.jsx';

export default function Assignments() {
  const { isTeacher } = useAuth();
  const { data, error, loading, reload } = useAsync(() => assignmentApi.list(), []);
  const [creating, setCreating] = useState(false);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const items = data.assignments;
  const now = Date.now();
  const groups = isTeacher
    ? [{ title: 'All assignments', items }]
    : [
        { title: 'Due soon', items: items.filter((a) => a.submissionStatus === 'pending') },
        { title: 'Needs attention', items: items.filter((a) => a.submissionStatus === 'missing') },
        { title: 'Submitted', items: items.filter((a) => ['submitted', 'graded'].includes(a.submissionStatus)) },
      ].filter((g) => g.items.length);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Assignments</h1>
        {isTeacher && <button className="btn btn-primary" onClick={() => setCreating(true)}>New assignment</button>}
      </div>

      {!items.length ? (
        <EmptyState icon="✎" title="Nothing here yet"
          description={isTeacher ? 'Create an assignment to start collecting submissions.' : 'No assignments have been published.'} />
      ) : groups.map((g) => (
        <section key={g.title}>
          <h2 className="font-semibold mb-3">{g.title} <span className="muted font-normal">({g.items.length})</span></h2>
          <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {g.items.map((a) => {
              const overdue = new Date(a.dueDate).getTime() < now;
              return (
                <Link key={a._id} to={`/assignments/${a._id}`} className="p-4 flex items-center gap-4 flex-wrap hover:opacity-90">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs muted">
                      {a.course?.code} · {a.type} · {a.maxScore} pts · weight ×{a.weight} ·
                      {' '}due {new Date(a.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </p>
                  </div>

                  {isTeacher ? (
                    <span className="text-sm secondary-ink tabular-nums">
                      {a.graded}/{a.submitted} graded
                    </span>
                  ) : (
                    <>
                      {a.submission?.score != null && (
                        <span className="text-sm font-semibold tabular-nums">
                          {a.submission.score}<span className="muted font-normal">/{a.maxScore}</span>
                        </span>
                      )}
                      <StatusChip status={a.submissionStatus} />
                    </>
                  )}
                  {!isTeacher && overdue && a.submissionStatus === 'pending' && <StatusChip status="warning">Overdue</StatusChip>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <CreateAssignmentModal open={creating} onClose={() => setCreating(false)} onDone={reload} />
    </div>
  );
}

function CreateAssignmentModal({ open, onClose, onDone }) {
  const courses = useAsync(() => (open ? courseApi.list() : Promise.resolve({ courses: [] })), [open]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await assignmentApi.create(new FormData(e.target));
      onDone(); onClose(); e.target.reset();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const defaultDue = new Date(Date.now() + 7 * 86400000);
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <Modal open={open} onClose={onClose} title="New assignment">
      <form onSubmit={submit}>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--status-critical)' }}>{error}</p>}

        <label className="block text-sm font-medium mb-1">Course</label>
        <select name="course" className="input mb-3" required>
          {(courses.data?.courses || []).map((c) => (
            <option key={c._id} value={c._id}>{c.code} — {c.title}</option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-1">Title</label>
        <input name="title" className="input mb-3" required />

        <label className="block text-sm font-medium mb-1">Instructions</label>
        <textarea name="instructions" className="input mb-3" rows={3} />

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select name="type" className="input">
              {['homework', 'quiz', 'project', 'exam'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due date</label>
            <input name="dueDate" className="input" type="datetime-local" required defaultValue={iso(defaultDue)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Max score</label>
            <input name="maxScore" className="input" type="number" min={1} defaultValue={100} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Weight</label>
            <input name="weight" className="input" type="number" min={0} step={0.5} defaultValue={1} />
          </div>
        </div>

        <label className="block text-sm font-medium mb-1">Attachments <span className="muted">(optional)</span></label>
        <input name="attachments" className="input mb-4" type="file" multiple />

        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Publishing…' : 'Publish assignment'}</button>
      </form>
    </Modal>
  );
}
