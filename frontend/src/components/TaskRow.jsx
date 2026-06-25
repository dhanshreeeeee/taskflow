import React from 'react';
import { StatusBadge, PriorityBadge, priorityColor } from './Badges.jsx';

function isOverdue(task) {
  if (!task.dueDate) return false;
  if (['DONE'].includes(task.status)) return false;
  return new Date(task.dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
}

export default function TaskRow({ task, onClick, currentUserId, showAssignees = true }) {
  const overdue = isOverdue(task);
  const isMine = task.assignees.some((a) => a.assignee.id === currentUserId) || task.createdBy.id === currentUserId;

  return (
    <div
      onClick={onClick}
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '12px 16px',
        cursor: 'pointer',
        borderLeft: `4px solid ${priorityColor(task.priority)}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.title}
          </span>
          {isMine && (
            <span className="badge" style={{ background: 'var(--accent-soft)', color: '#8a5a16', flexShrink: 0 }}>
              Mine
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {showAssignees && (
        <div style={{ display: 'flex', flexShrink: 0 }}>
          {task.assignees.slice(0, 3).map((a) => (
            <span
              key={a.id}
              title={a.assignee.name}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--ink)',
                color: 'white',
                fontSize: 10.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: -6,
                border: '2px solid white',
              }}
            >
              {a.assignee.name.charAt(0)}
            </span>
          ))}
          {task.assignees.length === 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unassigned</span>
          )}
        </div>
      )}

      <div style={{ flexShrink: 0, minWidth: 64, textAlign: 'right' }}>
        {task.dueDate ? (
          <span style={{ fontSize: 11.5, fontWeight: overdue ? 700 : 400, color: overdue ? 'var(--status-blocked)' : 'var(--text-secondary)' }}>
            {overdue ? 'Overdue · ' : ''}
            {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>—</span>
        )}
      </div>
    </div>
  );
}

export { isOverdue };
