import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_LABEL = { STAFF: 'Staff', LEAD: 'Lead', ADMIN: 'Admin' };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navItems = [
    { to: '/', label: 'Dashboard', exact: true },
    { to: '/my-tasks', label: 'My Tasks' },
    { to: '/tasks', label: user.role === 'STAFF' ? 'Team Tasks' : 'All Tasks' },
    { to: '/leave', label: 'Leave' },
    { to: '/holidays', label: 'Holidays' },
  ];
  if (user.role === 'LEAD' || user.role === 'ADMIN') {
    navItems.push({ to: '/reviews', label: 'Reviews' });
    navItems.push({ to: '/team', label: 'Team' });
    navItems.push({ to: '/templates', label: 'Recurring Tasks' });
  }
  if (user.role === 'ADMIN') {
    navItems.push({ to: '/users', label: 'Users' });
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--ink)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '24px 20px 20px' }}>
          <div style={{ width: 32, height: 3, background: 'var(--accent)', marginBottom: 12, borderRadius: 2 }} />
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600 }}>TaskFlow</div>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              style={({ isActive }) => ({
                display: 'block',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 13.5,
                fontWeight: 500,
                color: isActive ? 'var(--ink)' : 'rgba(255,255,255,0.85)',
                background: isActive ? 'var(--accent)' : 'transparent',
                marginBottom: 2,
                transition: 'background 0.12s',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>
            {ROLE_LABEL[user.role]}
            {user.team?.name ? ` · ${user.team.name}` : ''}
          </div>
          <button
            onClick={handleLogout}
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', color: 'white', borderColor: 'rgba(255,255,255,0.15)' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1200 }}>
        <Outlet />
      </main>
    </div>
  );
}
