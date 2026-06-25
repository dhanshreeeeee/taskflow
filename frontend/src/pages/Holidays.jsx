import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TeamCalendar from '../components/TeamCalendar.jsx';

export default function Holidays() {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const year = new Date().getFullYear();

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/holidays', { params: { year } })
      .then((res) => setHolidays(res.data))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  async function addHoliday(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/holidays', { date: new Date(date).toISOString(), name });
      setDate('');
      setName('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not add holiday.');
    } finally {
      setBusy(false);
    }
  }

  async function removeHoliday(id) {
    setBusy(true);
    try {
      await api.delete(`/holidays/${id}`);
      load();
    } catch {
      setError('Could not remove holiday.');
    } finally {
      setBusy(false);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = holidays.filter((h) => new Date(h.date) >= today);
  const past = holidays.filter((h) => new Date(h.date) < today);

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Company holidays</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        {year} holiday calendar. Sundays are off automatically and don't need to be listed here.
      </p>

      <div style={{ marginBottom: 28 }}>
        <TeamCalendar />
      </div>

      {user.role === 'ADMIN' && (
        <div className="card" style={{ padding: 20, marginBottom: 28, maxWidth: 460 }}>
          <h2 style={{ fontSize: 15, marginBottom: 12 }}>Add a holiday</h2>
          <form onSubmit={addHoliday} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <input placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} required style={{ flex: 1, minWidth: 140 }} />
            <button type="submit" className="btn btn-accent" disabled={busy}>Add</button>
          </form>
          {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
      )}

      {loading ? (
        <div>Loading holidays...</div>
      ) : (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10 }}>Upcoming</h3>
            <HolidayList holidays={upcoming} onRemove={user.role === 'ADMIN' ? removeHoliday : null} />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>Past</h3>
            <HolidayList holidays={past} muted onRemove={user.role === 'ADMIN' ? removeHoliday : null} />
          </div>
        </div>
      )}
    </div>
  );
}

function HolidayList({ holidays, muted, onRemove }) {
  if (holidays.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>None.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {holidays.map((h) => (
        <div
          key={h.id}
          className="card"
          style={{
            padding: '10px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: muted ? 0.6 : 1,
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{h.name}</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 8 }}>
              {new Date(h.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
          </div>
          {onRemove && (
            <button onClick={() => onRemove(h.id)} className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}>
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
