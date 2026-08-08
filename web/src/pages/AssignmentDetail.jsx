import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { assignmentApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, Avatar, StatusChip } from '../components/ui.jsx';
import { StatTile, BarChart } from '../components/charts.jsx';

export default function AssignmentDetail() {
  const { id } = useParams();
  const { isTeacher } = useAuth();
  const { data, error, loading, reload } = useAsync(() => assignmentApi.get(id), [id]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const { assignment, submission, submissions, analytics } = data;
  const overdue = new Date(assignment.dueDate) < new Date();

  return (
    <div className="space-y-6">
      <header className="card p-5">
        <p className="text-xs font-semibold muted">{assignment.course?.code} · {assignment.type}</p>
        <h1 className="text-2xl font-semibold">{assignment.title}</h1>
        <p className="secondary-ink text-sm mt-2 whitespace-pre-wrap">{assignment.instructions}</p>
        <p className="text-xs muted mt-3">
          {assignment.maxScore} points · weight ×{assignment.weight} ·
          {' '}due {new Date(assignment.dueDate).toLocaleString()}
          {assignment.allowLate && ` · late submissions lose ${assignment.latePenaltyPercent}%`}
        </p>
        {assignment.attachments?.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {assignment.attachments.map((f) => (
              <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs">
                <span aria-hidden>📎</span> {f.name}
              </a>
            ))}
          </div>
        )}
      </header>

      {!isTeacher && <StudentSubmission assignment={assignment} submission={submission} overdue={overdue} onDone={reload} />}

      {isTeacher && analytics && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Submitted" value={analytics.submitted}
              sub={`${analytics.notSubmitted} missing`} icon="↑" />
            <StatTile label="Average" value={analytics.average} suffix="%" icon="◆"
              tone={analytics.average >= 75 ? 'good' : analytics.average >= 60 ? 'warning' : 'critical'} />
            <StatTile label="Median" value={analytics.median} suffix="%" icon="◈" />
            <StatTile label="Difficulty" value={analytics.difficulty} icon="!"
              tone={analytics.difficulty === 'hard' ? 'critical' : analytics.difficulty === 'moderate' ? 'warning' : 'good'}
              sub={`${analytics.lateCount} late`} />
          </div>

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Score distribution</h2>
            <BarChart label="Students"
              data={Object.entries(analytics.distribution).map(([letter, count]) => ({
                label: letter, value: count,
                color: letter === 'F' ? 'var(--status-critical)' : 'var(--series-1)',
              }))} />
          </section>

          <section>
            <h2 className="font-semibold mb-3">Submissions</h2>
            <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
              {submissions.length === 0 && <p className="p-6 text-center text-sm muted">No submissions yet.</p>}
              {submissions.map((s) => (
                <GradeRow key={s._id} submission={s} maxScore={assignment.maxScore} onDone={reload} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StudentSubmission({ assignment, submission, overdue, onDone }) {
  const [text, setText] = useState(submission?.text || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await assignmentApi.submit(assignment._id, new FormData(e.target)); onDone(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (submission?.score != null) {
    const pct = Math.round((submission.score / assignment.maxScore) * 100);
    return (
      <section className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold">Your grade</h2>
            <p className="text-sm secondary-ink">
              Graded {new Date(submission.gradedAt).toLocaleDateString()}
              {submission.isLate && ` · late penalty applied (raw ${submission.rawScore})`}
            </p>
          </div>
          <p className="text-3xl font-semibold tabular-nums">
            {submission.score}<span className="text-base muted">/{assignment.maxScore}</span>
            <span className="text-base muted ml-2">{pct}%</span>
          </p>
        </div>
        {submission.feedback && (
          <p className="mt-4 pl-3 border-l-2 text-sm" style={{ borderColor: 'var(--series-1)' }}>
            {submission.feedback}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{submission ? 'Update your submission' : 'Submit your work'}</h2>
        {submission && <StatusChip status="submitted" />}
      </div>

      {overdue && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg flex gap-2"
          style={{ background: 'color-mix(in srgb, var(--status-warning) 16%, transparent)' }}>
          <span aria-hidden style={{ color: 'var(--status-warning)' }}>!</span>
          {assignment.allowLate
            ? `This is past the deadline — a ${assignment.latePenaltyPercent}% penalty will apply.`
            : 'The deadline has passed and late submissions are closed.'}
        </p>
      )}

      <form onSubmit={submit}>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--status-critical)' }}>{error}</p>}
        <label className="block text-sm font-medium mb-1">Answer</label>
        <textarea name="text" className="input mb-3" rows={6} value={text}
          onChange={(e) => setText(e.target.value)} placeholder="Type your answer, or attach files below." />

        <label className="block text-sm font-medium mb-1">Files</label>
        <input name="files" type="file" multiple className="input mb-4" />

        <button className="btn btn-primary" disabled={busy || (overdue && !assignment.allowLate)}>
          {busy ? 'Submitting…' : submission ? 'Resubmit' : 'Submit'}
        </button>
      </form>
    </section>
  );
}

function GradeRow({ submission, maxScore, onDone }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(submission.rawScore ?? '');
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try { await assignmentApi.grade(submission._id, Number(score), feedback); onDone(); setOpen(false); }
    catch (err) { alert(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Avatar user={submission.student} size={32} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{submission.student.name}</p>
          <p className="text-xs muted">
            {new Date(submission.submittedAt).toLocaleString()}
            {submission.isLate && ' · late'}
          </p>
        </div>
        {submission.score != null
          ? <span className="text-sm font-semibold tabular-nums">{submission.score}<span className="muted font-normal">/{maxScore}</span></span>
          : <StatusChip status="pending">Ungraded</StatusChip>}
        <button className="btn btn-ghost text-sm" onClick={() => setOpen((v) => !v)}>
          {open ? 'Close' : submission.score != null ? 'Edit grade' : 'Grade'}
        </button>
      </div>

      {open && (
        <div className="mt-4 pl-11 space-y-3">
          {submission.text && (
            <div className="text-sm p-3 rounded-lg whitespace-pre-wrap"
              style={{ background: 'color-mix(in srgb, var(--text-primary) 4%, transparent)' }}>
              {submission.text}
            </div>
          )}
          {submission.files?.map((f) => (
            <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="btn btn-ghost text-xs mr-2">
              <span aria-hidden>📎</span> {f.name}
            </a>
          ))}

          <div className="flex gap-3 items-end flex-wrap">
            <div style={{ width: 120 }}>
              <label className="block text-xs font-medium mb-1">Score /{maxScore}</label>
              <input className="input" type="number" min={0} max={maxScore} value={score}
                onChange={(e) => setScore(e.target.value)} />
            </div>
            <div className="flex-1 min-w-48">
              <label className="block text-xs font-medium mb-1">Feedback</label>
              <input className="input" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={save} disabled={busy || score === ''}>
              {busy ? 'Saving…' : 'Save grade'}
            </button>
          </div>
          {submission.isLate && (
            <p className="text-xs muted">A late penalty is applied automatically to the score you enter.</p>
          )}
        </div>
      )}
    </div>
  );
}
