import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import TaskTable from '../components/TaskTable.jsx';
import TaskModal from '../components/TaskModal.jsx';

export default function Reviews() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/tasks', { params: { status: 'IN_REVIEW' } })
      .then((res) => setTasks(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user.role === 'STAFF') {
    return (
      <div>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Reviews</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Only Leads and Admins review tasks.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Reviews</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        {user.role === 'LEAD' ? "Tasks from your team awaiting your review." : 'All tasks awaiting review across the organization.'}
      </p>

      {loading ? (
        <div>Loading...</div>
      ) : tasks.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Nothing waiting on you right now.
        </div>
      ) : (
        <TaskTable tasks={tasks} onRowClick={setSelectedTask} currentUserId={user.id} />
      )}

      {selectedTask && <TaskModal taskId={selectedTask.id} onClose={() => setSelectedTask(null)} onUpdated={load} />}
    </div>
  );
}
