import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', studentId: '', department: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setBusy(true);
    setError(null);
    try {
      const user = await register(form);
      navigate(user.role === 'student' ? '/face-enrolment' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="card p-6 w-full max-w-md">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="secondary-ink text-sm mt-1 mb-6">Students continue to face enrolment after signing up.</p>

        {error && (
          <div className="mb-4 text-sm px-3 py-2 rounded-lg flex gap-2"
            style={{ background: 'color-mix(in srgb, var(--status-critical) 14%, transparent)' }}>
            <span aria-hidden style={{ color: 'var(--status-critical)' }}>⚠</span>{error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-4">
          {['student', 'teacher'].map((r) => (
            <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
              className="btn capitalize"
              style={form.role === r
                ? { background: 'color-mix(in srgb, var(--series-1) 14%, transparent)', color: 'var(--series-1)', border: '1px solid var(--series-1)' }
                : { border: '1px solid var(--border)' }}>
              {r}
            </button>
          ))}
        </div>

        <label className="block text-sm font-medium mb-1">Full name</label>
        <input className="input mb-3" required value={form.name} onChange={set('name')} />

        <label className="block text-sm font-medium mb-1">Email</label>
        <input className="input mb-3" type="email" required value={form.email} onChange={set('email')} />

        <label className="block text-sm font-medium mb-1">Password</label>
        <input className="input mb-3" type="password" required minLength={8} value={form.password} onChange={set('password')} />
        <p className="text-xs muted -mt-2 mb-3">At least 8 characters.</p>

        {form.role === 'student' && (
          <>
            <label className="block text-sm font-medium mb-1">Student ID <span className="muted">(optional)</span></label>
            <input className="input mb-3" value={form.studentId} onChange={set('studentId')} placeholder="CS/2024/0101" />
          </>
        )}

        <label className="block text-sm font-medium mb-1">Department <span className="muted">(optional)</span></label>
        <input className="input mb-5" value={form.department} onChange={set('department')} />

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-sm secondary-ink mt-4 text-center">
          Already registered? <Link to="/login" className="font-medium" style={{ color: 'var(--series-1)' }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}
