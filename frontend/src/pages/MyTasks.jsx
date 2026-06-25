import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isOverdue } from '../components/TaskRow.jsx';
import TaskTable from '../components/TaskTable.jsx';
import TaskModal from '../components/TaskModal.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';

export default function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const loadTasks = useCallback(() => {
    setLoading(true);
    api
      .get('/tasks')
      .then((res) => setTasks(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Leads/Admins see the whole org or team from /tasks, so filter down to "mine" client-side.
  // Staff already only get their own from the backend, but this filter is harmless either way.
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignees.some((a) => a.assignee.id === user.id) || t.createdBy.id === user.id),
    [tasks, user.id]
  );

  const active = myTasks.filter((t) => t.status !== 'DONE');
  const done = myTasks.filter((t) => t.status === 'DONE');
  const overdueCount = active.filter(isOverdue).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>My Tasks</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Everything assigned to you or created by you — across every team and frequency.
          </p>
        </div>
        <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
          + New task
        </button>
      </div>

      {!loading && overdueCount > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--status-blocked)', fontWeight: 600, marginTop: 14, marginBottom: 4 }}>
          {overdueCount} overdue
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 24 }}>Loading your tasks...</div>
      ) : (
        <div style={{ marginTop: 20 }}>
          {active.length === 0 && done.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              Nothing assigned to you right now.
            </div>
          )}

          {active.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <TaskTable tasks={active} onRowClick={setSelectedTask} currentUserId={user.id} />
            </div>
          )}

          {done.length > 0 && (
            <details>
              <summary style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 10 }}>
                Completed ({done.length})
              </summary>
              <div style={{ opacity: 0.75 }}>
                <TaskTable tasks={done} onRowClick={setSelectedTask} currentUserId={user.id} />
              </div>
            </details>
          )}
        </div>
      )}

      {selectedTask && <TaskModal taskId={selectedTask.id} onClose={() => setSelectedTask(null)} onUpdated={loadTasks} />}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
