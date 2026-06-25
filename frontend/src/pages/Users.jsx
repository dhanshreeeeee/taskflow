import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('STAFF');
  const [teamId, setTeamId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.get('/auth/users'), api.get('/teams')])
      .then(([u, t]) => {
        setUsers(u.data);
        setTeams(t.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/users', {
        name,
        email,
        password,
        role,
        teamId: role === 'STAFF' ? teamId || null : null,
      });
      setName('');
      setEmail('');
      setPassword('');
      setRole('STAFF');
      setTeamId('');
      load();
    } catch (err) {
      setError(err.response?.data?.error === 'EmailTaken' ? 'That email is already in use.' : 'Could not create user.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user) {
    setBusy(true);
    try {
      await api.patch(`/auth/users/${user.id}`, { isActive: !user.isActive });
      load();
    } catch {
      setError('Could not update user.');
    } finally {
      setBusy(false);
    }
  }

  async function changeTeam(user, newTeamId) {
    setBusy(true);
    try {
      await api.patch(`/auth/users/${user.id}`, { teamId: newTeamId || null });
      load();
    } catch {
      setError('Could not update team.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Users</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Manage who has access and what they can do.</p>

      <div className="card" style={{ padding: 20, marginBottom: 28, maxWidth: 540 }}>
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Add a user</h2>
        <form onSubmit={createUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1 }} />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="password"
              placeholder="Temporary password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ flex: 1 }}
            />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ flex: 1 }}>
              <option value="STAFF">Staff</option>
              <option value="LEAD">Lead</option>
              <option value="ADMIN">Admin</option>
            </select>
            {role === 'STAFF' && (
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} style={{ flex: 1 }}>
                <option value="">No team yet</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
          {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13 }}>{error}</div>}
          <button type="submit" className="btn btn-accent" disabled={busy} style={{ alignSelf: 'flex-start' }}>
            Create user
          </button>
        </form>
        <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 10 }}>
          To make someone a Lead of a specific team, create them as Lead here, then set them as that team's lead from the Team page (or update via API).
        </p>
      </div>

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 10px' }}>Name</th>
              <th style={{ padding: '8px 10px' }}>Email</th>
              <th style={{ padding: '8px 10px' }}>Role</th>
              <th style={{ padding: '8px 10px' }}>Team</th>
              <th style={{ padding: '8px 10px' }}>Status</th>
              <th style={{ padding: '8px 10px' }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px' }}>{u.name}</td>
                <td style={{ padding: '10px', color: 'var(--text-secondary)' }}>{u.email}</td>
                <td style={{ padding: '10px' }}>{u.role}</td>
                <td style={{ padding: '10px' }}>
                  {u.role === 'STAFF' ? (
                    <select value={u.teamId || ''} onChange={(e) => changeTeam(u, e.target.value)} style={{ fontSize: 12, padding: '4px 6px' }}>
                      <option value="">No team</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px' }}>
                  <span className="badge" style={{ background: u.isActive ? '#e9f3ec' : '#fbeceb', color: u.isActive ? 'var(--status-done)' : 'var(--status-blocked)' }}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <button onClick={() => toggleActive(u)} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} disabled={busy}>
                    {u.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
