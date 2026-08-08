import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Avatar } from './ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◧', end: true },
  { to: '/courses', label: 'Courses', icon: '▤' },
  { to: '/assignments', label: 'Assignments', icon: '✎' },
];

export default function Layout() {
  const { user, logout, isStudent } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('vc.theme') || 'system');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vc.theme', theme);
  }, [theme]);

  const needsFaceEnrolment = isStudent && !user?.faceEnrolledAt;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--plane) 88%, transparent)' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <button className="md:hidden text-xl" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>

          <NavLink to="/" className="font-semibold flex items-center gap-2 shrink-0">
            <span aria-hidden className="inline-flex items-center justify-center rounded-lg w-7 h-7 text-sm"
              style={{ background: 'var(--series-1)', color: '#fff' }}>VC</span>
            <span className="hidden sm:inline">Virtual Classroom</span>
          </NavLink>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium ${isActive ? '' : 'secondary-ink'}`}
                style={({ isActive }) => isActive
                  ? { background: 'color-mix(in srgb, var(--series-1) 12%, transparent)', color: 'var(--series-1)' }
                  : undefined}>
                <span aria-hidden className="mr-1.5">{n.icon}</span>{n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-ghost !px-2 !py-1.5" title="Toggle theme"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <button onClick={() => navigate('/profile')} className="flex items-center gap-2" title="Profile">
              <Avatar user={user} size={30} />
              <span className="hidden sm:block text-sm font-medium">{user?.name?.split(' ')[0]}</span>
            </button>
            <button className="btn btn-ghost text-sm" onClick={() => { logout(); navigate('/login'); }}>
              Sign out
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="md:hidden border-t px-4 py-2 flex flex-col" style={{ borderColor: 'var(--border)' }}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setMenuOpen(false)}
                className="py-2 text-sm font-medium">
                <span aria-hidden className="mr-2">{n.icon}</span>{n.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {needsFaceEnrolment && (
        <div className="px-4 py-2.5 text-sm flex items-center gap-3 flex-wrap"
          style={{ background: 'color-mix(in srgb, var(--status-warning) 18%, transparent)' }}>
          <span aria-hidden style={{ color: 'var(--status-warning)' }}>!</span>
          <span>Set up face recognition so your attendance is recorded automatically in live classes.</span>
          <NavLink to="/face-enrolment" className="font-semibold underline">Enrol now</NavLink>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
