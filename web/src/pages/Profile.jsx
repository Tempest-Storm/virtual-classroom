import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar, StatusChip } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser, isStudent } = useAuth();
  const [form, setForm] = useState({
    name: user.name, department: user.department || '', studentId: user.studentId || '',
  });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await authApi.updateProfile(form);
      setUser(res.user);
      setMsg({ tone: 'good', text: 'Profile updated.' });
    } catch (err) { setMsg({ tone: 'critical', text: err.message }); }
    finally { setBusy(false); }
  }

  async function savePassword(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await authApi.changePassword(pw.currentPassword, pw.newPassword);
      setPw({ currentPassword: '', newPassword: '' });
      setMsg({ tone: 'good', text: 'Password changed.' });
    } catch (err) { setMsg({ tone: 'critical', text: err.message }); }
    finally { setBusy(false); }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={56} />
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="secondary-ink text-sm capitalize">{user.role} · {user.email}</p>
        </div>
      </div>

      {msg && (
        <p className="text-sm px-3 py-2 rounded-lg"
          style={{ background: `color-mix(in srgb, var(--status-${msg.tone}) 14%, transparent)` }}>
          {msg.text}
        </p>
      )}

      {isStudent && (
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <span className="flex-1 text-sm">
            <span className="font-medium block">Face recognition</span>
            <span className="secondary-ink">Used to record your attendance automatically.</span>
          </span>
          {user.faceEnrolledAt ? <StatusChip status="present">Enrolled</StatusChip> : <StatusChip status="missing">Not enrolled</StatusChip>}
          <Link to="/face-enrolment" className="btn btn-ghost text-sm">Manage</Link>
        </div>
      )}

      <form onSubmit={saveProfile} className="card p-5">
        <h2 className="font-semibold mb-4">Profile details</h2>

        <label className="block text-sm font-medium mb-1">Full name</label>
        <input className="input mb-3" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />

        <label className="block text-sm font-medium mb-1">Department</label>
        <input className="input mb-3" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />

        {isStudent && (
          <>
            <label className="block text-sm font-medium mb-1">Student ID</label>
            <input className="input mb-3" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
          </>
        )}

        <button className="btn btn-primary mt-2" disabled={busy}>Save changes</button>
      </form>

      <form onSubmit={savePassword} className="card p-5">
        <h2 className="font-semibold mb-4">Change password</h2>

        <label className="block text-sm font-medium mb-1">Current password</label>
        <input className="input mb-3" type="password" required value={pw.currentPassword}
          onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />

        <label className="block text-sm font-medium mb-1">New password</label>
        <input className="input mb-1" type="password" required minLength={8} value={pw.newPassword}
          onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        <p className="text-xs muted mb-3">At least 8 characters.</p>

        <button className="btn btn-primary" disabled={busy}>Update password</button>
      </form>
    </div>
  );
}
