import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAssignableUsers } from '../utils/useAssignableUsers.js';
import Modal from './Modal.jsx';

export default function CreateTaskModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const { users, loading: usersLoading } = useAssignableUsers();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState('ONE_TIME');
  const [assigneeIds, setAssigneeIds] = useState(user.role === 'STAFF' ? [user.id] : []);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleAssignee(id) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (assigneeIds.length === 0) {
      setError('Select at least one assignee.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/tasks', {
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigneeIds,
        recurrenceType,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create task. Check your inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="Title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ width: '100%' }} placeholder="e.g. Fix article tagging bug" />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
            placeholder="Add any context the assignee will need..."
          />
        </Field>

        <div style={{ display: 'flex', gap: 16 }}>
          <Field label="Priority" style={{ flex: 1 }}>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%' }}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Field label="Due date (optional)" style={{ flex: 1 }}>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: '100%' }} />
          </Field>
        </div>

        <Field label="Frequency">
          <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} style={{ width: '100%' }}>
            <option value="ONE_TIME">One-time</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
          </select>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 5, marginBottom: 0 }}>
            This just tags and filters this single task. For a task that should auto-create itself on a schedule
            (e.g. every Monday, without you re-creating it), set up a{' '}
            <a href="/templates" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>recurring template</a> instead.
          </p>
        </Field>

        <Field label="Assignees">
          {usersLoading ? (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading people...</div>
          ) : (
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
          )}
        </Field>

        {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
