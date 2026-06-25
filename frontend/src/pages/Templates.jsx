import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAssignableUsers } from '../utils/useAssignableUsers.js';
import { RECURRENCE_META } from '../components/Badges.jsx';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Templates() {
  const { user } = useAuth();
  const { users } = useAssignableUsers();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runNowMessage, setRunNowMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [recurrenceType, setRecurrenceType] = useState('WEEKLY');
  const [weekday, setWeekday] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [assigneeIds, setAssigneeIds] = useState([]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/recurring-templates')
      .then((res) => setTemplates(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleAssignee(id) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function createTemplate(e) {
    e.preventDefault();
    setError('');
    if (assigneeIds.length === 0) {
      setError('Select at least one default assignee.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/recurring-templates', {
        title,
        priority,
        recurrenceType,
        assigneeIds,
        weekday: recurrenceType === 'WEEKLY' ? Number(weekday) : undefined,
        dayOfMonth: ['MONTHLY', 'QUARTERLY'].includes(recurrenceType) ? Number(dayOfMonth) : undefined,
      });
      setTitle('');
      setAssigneeIds([]);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create template.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(template) {
    setBusy(true);
    try {
      await api.patch(`/recurring-templates/${template.id}`, { isActive: !template.isActive });
      load();
    } catch {
      setError('Could not update template.');
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate(id) {
    setBusy(true);
    try {
      await api.delete(`/recurring-templates/${id}`);
      load();
    } catch {
      setError('Could not delete template.');
    } finally {
      setBusy(false);
    }
  }

  async function runNow(template) {
    setBusy(true);
    setError('');
    setRunNowMessage('');
    try {
      await api.post(`/recurring-templates/${template.id}/run-now`);
      setRunNowMessage(`Generated a task from "${template.title}" — check Tasks or My Tasks.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not run this template now.');
    } finally {
      setBusy(false);
    }
  }

  if (user.role === 'STAFF') {
    return (
      <div>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Recurring tasks</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Ask your Lead to set up recurring tasks for the team.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Recurring tasks</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Set up a task that auto-creates itself on a schedule — daily, weekly, monthly, or quarterly.
      </p>

      <div className="card" style={{ padding: 20, marginBottom: 28, maxWidth: 560 }}>
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>New recurring template</h2>
        <form onSubmit={createTemplate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input placeholder="Task title (used every time it's generated)" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <div style={{ display: 'flex', gap: 10 }}>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ flex: 1 }}>
              <option value="LOW">Low priority</option>
              <option value="MEDIUM">Medium priority</option>
              <option value="HIGH">High priority</option>
              <option value="URGENT">Urgent priority</option>
            </select>
            <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} style={{ flex: 1 }}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
            </select>
          </div>

          {recurrenceType === 'WEEKLY' && (
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {WEEKDAYS.map((d, i) => (
                <option key={i} value={i}>Every {d}</option>
              ))}
            </select>
          )}

          {['MONTHLY', 'QUARTERLY'].includes(recurrenceType) && (
            <select value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Day {d} of the month</option>
              ))}
            </select>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Default assignees
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {users.map((u) => {
                const active = assigneeIds.includes(u.id);
                return (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => toggleAssignee(u.id)}
                    className={active ? 'btn btn-accent' : 'btn btn-ghost'}
                    style={{ fontSize: 12.5, padding: '6px 12px' }}
                  >
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13 }}>{error}</div>}

          <button type="submit" className="btn btn-accent" disabled={busy} style={{ alignSelf: 'flex-start' }}>
            Create recurring template
          </button>
        </form>
      </div>

      {runNowMessage && (
        <div style={{ fontSize: 12.5, color: 'var(--status-done)', marginBottom: 16, fontWeight: 600 }}>{runNowMessage}</div>
      )}

      {loading ? (
        <div>Loading templates...</div>
      ) : templates.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No recurring templates yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map((t) => (
            <div key={t.id} className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, opacity: t.isActive ? 1 : 0.55 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {RECURRENCE_META[t.recurrenceType]?.label} · {t._count.generatedTasks} generated so far · next:{' '}
                  {new Date(t.nextRunAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" disabled={busy} onClick={() => runNow(t)} style={{ fontSize: 12 }} title="Generate a task from this template right now, regardless of schedule">
                  Run now
                </button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => toggleActive(t)} style={{ fontSize: 12 }}>
                  {t.isActive ? 'Pause' : 'Resume'}
                </button>
                <button className="btn btn-danger" disabled={busy} onClick={() => removeTemplate(t.id)} style={{ fontSize: 12 }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
