import React, { useState } from 'react';
import { api } from '../api/client.js';
import { useAssignableUsers } from '../utils/useAssignableUsers.js';
import Modal from './Modal.jsx';

export default function ReassignPrompt({ leaveUserName, tasks, onClose }) {
  const { users } = useAssignableUsers();
  const [choices, setChoices] = useState({}); // taskId -> newUserId
  const [done, setDone] = useState({}); // taskId -> true once reassigned
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The person going on leave — exclude them from the reassignment options
  const leaveUserId = tasks[0]?.assignees.find((a) => a.assignee.name === leaveUserName)?.assignee.id;

  async function reassign(taskId) {
    const toUserId = choices[taskId];
    if (!toUserId) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/tasks/${taskId}/reassign`, { fromUserId: leaveUserId, toUserId });
      setDone((prev) => ({ ...prev, [taskId]: true }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reassign this task.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`${leaveUserName}'s leave was approved`} onClose={onClose} width={560}>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginBottom: 18 }}>
        They have {tasks.length} open task{tasks.length === 1 ? '' : 's'} while they're away. Pick someone to cover each one,
        or close this and reassign later from the task board.
      </p>

      {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tasks.map((task) => (
          <div key={task.id} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>{task.title}</div>
            {done[task.id] ? (
              <div style={{ fontSize: 12.5, color: 'var(--status-done)', fontWeight: 600 }}>✓ Reassigned</div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  value={choices[task.id] || ''}
                  onChange={(e) => setChoices((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  style={{ flex: 1 }}
                >
                  <option value="">Assign to...</option>
                  {users.filter((u) => u.id !== leaveUserId).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <button
                  className="btn btn-accent"
                  disabled={busy || !choices[task.id]}
                  onClick={() => reassign(task.id)}
                  style={{ fontSize: 12.5 }}
                >
                  Reassign
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={onClose}>Done for now</button>
      </div>
    </Modal>
  );
}
