import { useState } from 'react';
import { Link } from 'react-router-dom';
import { courseApi } from '../api/client.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner, ErrorBox, EmptyState, Modal } from '../components/ui.jsx';

export default function Courses() {
  const { isTeacher } = useAuth();
  const { data, error, loading, reload } = useAsync(() => courseApi.list(), []);
  const [modal, setModal] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Courses</h1>
        <button className="btn btn-primary" onClick={() => setModal(isTeacher ? 'create' : 'join')}>
          {isTeacher ? 'New course' : 'Join a course'}
        </button>
      </div>

      {data.courses.length === 0 ? (
        <EmptyState icon="▤"
          title={isTeacher ? 'No courses yet' : 'You have not joined a course'}
          description={isTeacher
            ? 'Create a course and share its code with your students.'
            : 'Enter the course code your teacher gave you.'}
          action={<button className="btn btn-primary" onClick={() => setModal(isTeacher ? 'create' : 'join')}>
            {isTeacher ? 'Create a course' : 'Join a course'}
          </button>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.courses.map((c) => (
            <Link key={c._id} to={`/courses/${c._id}`} className="card overflow-hidden hover:opacity-90">
              <div style={{ background: c.coverColor, height: 6 }} aria-hidden />
              <div className="p-4">
                <p className="text-xs font-semibold muted">{c.code}</p>
                <p className="font-medium leading-tight mt-0.5">{c.title}</p>
                <p className="text-sm secondary-ink mt-2 line-clamp-2">{c.description}</p>
                <p className="text-xs muted mt-3">
                  {c.teacher?.name} · {c.studentCount} students · {c.credits} credits
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateCourseModal open={modal === 'create'} onClose={() => setModal(null)} onDone={reload} />
      <JoinCourseModal open={modal === 'join'} onClose={() => setModal(null)} onDone={reload} />
    </div>
  );
}

function CreateCourseModal({ open, onClose, onDone }) {
  const [form, setForm] = useState({ title: '', code: '', description: '', credits: 3, coverColor: '#2a78d6' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await courseApi.create(form);
      onDone(); onClose();
      setForm({ title: '', code: '', description: '', credits: 3, coverColor: '#2a78d6' });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a course">
      <form onSubmit={submit}>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--status-critical)' }}>{error}</p>}
        <label className="block text-sm font-medium mb-1">Title</label>
        <input className="input mb-3" required value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />

        <label className="block text-sm font-medium mb-1">Course code</label>
        <input className="input mb-3" required placeholder="CSC401" value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />

        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea className="input mb-3" rows={3} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Credits</label>
            <input className="input" type="number" min={1} max={10} value={form.credits}
              onChange={(e) => setForm({ ...form, credits: Number(e.target.value) })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Colour</label>
            <input className="input h-[42px] p-1" type="color" value={form.coverColor}
              onChange={(e) => setForm({ ...form, coverColor: e.target.value })} />
          </div>
        </div>

        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Creating…' : 'Create course'}</button>
      </form>
    </Modal>
  );
}

function JoinCourseModal({ open, onClose, onDone }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await courseApi.enrolByCode(code); onDone(); onClose(); setCode(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Join a course" width={420}>
      <form onSubmit={submit}>
        {error && <p className="text-sm mb-3" style={{ color: 'var(--status-critical)' }}>{error}</p>}
        <label className="block text-sm font-medium mb-1">Course code</label>
        <input className="input mb-4" required placeholder="CSC401" value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Joining…' : 'Join'}</button>
      </form>
    </Modal>
  );
}
