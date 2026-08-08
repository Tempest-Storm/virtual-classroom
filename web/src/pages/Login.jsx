import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getServerBase, setServerBase } from '../api/client.js';

const DEMO = [
  { label: 'Teacher', email: 'teacher@demo.io' },
  { label: 'Student', email: 'amina@demo.io' },
];

// Native builds have no dev-server proxy, so the app needs to know where the
// backend lives. Editable here so one APK works on LAN or through a tunnel.
function ServerSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(getServerBase());
  const [saved, setSaved] = useState(false);

  function save() {
    setServerBase(value.trim());
    setSaved(true);
    // Reload so the new origin is picked up everywhere (and the socket resets).
    setTimeout(() => window.location.reload(), 400);
  }

  return (
    <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs muted underline">
        {open ? 'Hide' : 'Server settings'}
      </button>
      {open && (
        <div className="mt-2">
          <label className="block text-xs font-medium mb-1">Backend URL</label>
          <input className="input text-sm" placeholder="http://192.168.0.100:5000 or https://…loca.lt"
            value={value} onChange={(e) => setValue(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <p className="text-xs muted mt-1">
            Same WiFi: your PC's <code>http://LAN-IP:5000</code>. Off WiFi: the tunnel URL.
          </p>
          <button type="button" className="btn btn-ghost text-xs mt-2" onClick={save} disabled={saved}>
            {saved ? 'Saved — reloading…' : 'Save & reload'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-center p-12" style={{ background: 'var(--series-1)', color: '#fff' }}>
        <h1 className="text-4xl font-semibold leading-tight max-w-md">
          Teach live. Let the AI handle the register.
        </h1>
        <p className="mt-4 text-lg opacity-90 max-w-md">
          Attendance is recognised from the classroom video stream, performance is
          analysed continuously, and at-risk students surface before it is too late.
        </p>
        <ul className="mt-8 space-y-2 opacity-90">
          {[
            'Face-recognition attendance with teacher override',
            'Live and recorded classes with chat and screen share',
            'Weighted grading, scoreboards, and trend analysis',
            'Plain-language insights with recommended actions',
          ].map((f) => <li key={f} className="flex gap-2"><span aria-hidden>✓</span>{f}</li>)}
        </ul>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="secondary-ink text-sm mt-1 mb-6">Welcome back to your classroom.</p>

          {error && (
            <div className="mb-4 text-sm px-3 py-2 rounded-lg flex gap-2"
              style={{ background: 'color-mix(in srgb, var(--status-critical) 14%, transparent)' }}>
              <span aria-hidden style={{ color: 'var(--status-critical)' }}>⚠</span>{error}
            </div>
          )}

          <label className="block text-sm font-medium mb-1" htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" className="input mb-4"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />

          <label className="block text-sm font-medium mb-1" htmlFor="password">Password</label>
          <input id="password" type="password" required autoComplete="current-password" className="input mb-5"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />

          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-sm secondary-ink mt-4 text-center">
            No account? <Link to="/register" className="font-medium" style={{ color: 'var(--series-1)' }}>Create one</Link>
          </p>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs muted mb-2">Demo accounts (password: Password123)</p>
            <div className="flex gap-2">
              {DEMO.map((d) => (
                <button key={d.email} type="button" className="btn btn-ghost text-xs flex-1"
                  onClick={() => setForm({ email: d.email, password: 'Password123' })}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <ServerSettings />
        </form>
      </div>
    </div>
  );
}
