import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Team() {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/teams')
      .then((res) => setTeams(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createTeam(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/teams', { name });
      setName('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create team.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Team</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        {user.role === 'ADMIN' ? 'All teams across the organization.' : 'Your team and its members.'}
      </p>

      {user.role === 'ADMIN' && (
        <div className="card" style={{ padding: 18, marginBottom: 28, maxWidth: 420 }}>
          <h2 style={{ fontSize: 14, marginBottom: 10 }}>Create a new team</h2>
          <form onSubmit={createTeam} style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Team name" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1 }} />
            <button type="submit" className="btn btn-accent" disabled={busy}>Create</button>
          </form>
          {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13, marginTop: 8 }}>{error}</div>}
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 8 }}>
            After creating, assign a Lead and members from the Users page.
          </p>
        </div>
      )}

      {loading ? (
        <div>Loading teams...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {teams.map((team) => (
            <div key={team.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 16 }}>{team.name}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{team._count.tasks} task{team._count.tasks === 1 ? '' : 's'}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Lead: <strong style={{ color: 'var(--text-primary)' }}>{team.lead?.name || 'Unassigned'}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {team.members.map((m) => (
                  <span
                    key={m.id}
                    className="badge"
                    style={{
                      background: m.isActive ? '#eef1f6' : '#fbeceb',
                      color: m.isActive ? 'var(--ink)' : 'var(--status-blocked)',
                    }}
                  >
                    {m.name}
                  </span>
                ))}
                {team.members.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No members yet.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
