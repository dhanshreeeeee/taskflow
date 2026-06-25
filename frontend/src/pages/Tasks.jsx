import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PriorityBadge, RecurrenceBadge, priorityColor } from '../components/Badges.jsx';
import { isOverdue } from '../components/TaskRow.jsx';
import TaskTable from '../components/TaskTable.jsx';
import TaskModal from '../components/TaskModal.jsx';
import CreateTaskModal from '../components/CreateTaskModal.jsx';

const COLUMNS = [
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'CHANGES_REQUESTED', label: 'Changes Requested' },
  { key: 'DONE', label: 'Done' },
  { key: 'BLOCKED', label: 'Blocked' },
];

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'

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

  const needsAttention = useMemo(
    () => tasks.filter((t) => isOverdue(t) || t.status === 'IN_REVIEW' || t.status === 'BLOCKED'),
    [tasks]
  );
  const needsAttentionIds = useMemo(() => new Set(needsAttention.map((t) => t.id)), [needsAttention]);
  const restOfTasks = useMemo(() => tasks.filter((t) => !needsAttentionIds.has(t.id)), [tasks, needsAttentionIds]);

  function tasksForStatus(status) {
    return tasks.filter((t) => t.status === status);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Tasks</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            {user.role === 'STAFF' ? 'Tasks you created or are assigned to.' : user.role === 'LEAD' ? 'Your team\u2019s task board.' : 'All tasks across the organization.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('list')}
              className="btn"
              style={{ borderRadius: 0, fontSize: 12.5, padding: '8px 14px', background: viewMode === 'list' ? 'var(--ink)' : 'white', color: viewMode === 'list' ? 'white' : 'var(--text-primary)' }}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className="btn"
              style={{ borderRadius: 0, fontSize: 12.5, padding: '8px 14px', background: viewMode === 'kanban' ? 'var(--ink)' : 'white', color: viewMode === 'kanban' ? 'white' : 'var(--text-primary)' }}
            >
              Board
            </button>
          </div>
          <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
            + New task
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 24 }}>Loading tasks...</div>
      ) : viewMode === 'list' ? (
        <div style={{ marginTop: 24 }}>
          {needsAttention.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-blocked)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  Needs attention
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--status-blocked)', background: '#fbeceb', borderRadius: 10, padding: '1px 8px' }}>
                  {needsAttention.length}
                </span>
              </div>
              <TaskTable tasks={needsAttention} onRowClick={setSelectedTask} currentUserId={user.id} />
            </div>
          )}

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 }}>
              All tasks
            </div>
            <TaskTable tasks={restOfTasks} onRowClick={setSelectedTask} currentUserId={user.id} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, marginTop: 24 }}>
          {COLUMNS.map((col) => {
            const colTasks = tasksForStatus(col.key);
            return (
              <div key={col.key} style={{ minWidth: 260, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {col.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: '#eee', borderRadius: 10, padding: '1px 7px' }}>
                    {colTasks.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="card"
                      onClick={() => setSelectedTask(task)}
                      style={{ padding: '14px 14px 14px 12px', cursor: 'pointer', borderLeft: `4px solid ${priorityColor(task.priority)}` }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                        <PriorityBadge priority={task.priority} />
                        <RecurrenceBadge recurrenceType={task.recurrenceType} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex' }}>
                          {task.assignees.slice(0, 3).map((a) => (
                            <span
                              key={a.id}
                              title={a.assignee.name}
                              style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--ink)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -4, border: '2px solid white' }}
                            >
                              {a.assignee.name.charAt(0)}
                            </span>
                          ))}
                        </div>
                        {task.dueDate && (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '12px 4px', fontStyle: 'italic' }}>Nothing here.</div>
                  )}
                </div>
              </div>
            );
          })}
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
