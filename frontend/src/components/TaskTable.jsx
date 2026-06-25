import React, { useState, useMemo } from 'react';
import { StatusBadge, PriorityBadge, RecurrenceBadge } from './Badges.jsx';
import { isOverdue } from './TaskRow.jsx';

const COLUMNS = [
  { key: 'title', label: 'Task', sortable: true },
  { key: 'lastComment', label: 'Last comment', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'recurrenceType', label: 'Frequency', sortable: true },
  { key: 'assignees', label: 'Assignees', sortable: false },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'dueDate', label: 'Due date', sortable: true },
];

const STATUS_ORDER = ['BLOCKED', 'CHANGES_REQUESTED', 'IN_REVIEW', 'IN_PROGRESS', 'TODO', 'DONE'];
const FREQ_ORDER = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ONE_TIME'];

function getSortValue(task, key) {
  switch (key) {
    case 'title':
      return task.title?.toLowerCase() || '';
    case 'status':
      return STATUS_ORDER.indexOf(task.status);
    case 'recurrenceType':
      return FREQ_ORDER.indexOf(task.recurrenceType || 'ONE_TIME');
    case 'createdAt':
      return new Date(task.createdAt).getTime();
    case 'dueDate':
      return task.dueDate ? new Date(task.dueDate).getTime() : Infinity;
    default:
      return '';
  }
}

export default function TaskTable({ tasks, onRowClick, currentUserId }) {
  const [sortKey, setSortKey] = useState('dueDate');
  const [sortDir, setSortDir] = useState('asc');

  const sorted = useMemo(() => {
    const copy = [...tasks];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [tasks, sortKey, sortDir]);

  function handleSort(col) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

  return (
    <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col)}
                style={{
                  textAlign: 'left',
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  cursor: col.sortable ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const lastComment = task.comments?.length > 0 ? task.comments[task.comments.length - 1] : null;
            const overdue = isOverdue(task);
            const isMine = task.assignees.some((a) => a.assignee.id === currentUserId) || task.createdBy.id === currentUserId;

            return (
              <tr
                key={task.id}
                onClick={() => onRowClick(task)}
                style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#faf8f3')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '11px 14px', maxWidth: 280 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {task.title}
                    </span>
                    {isMine && (
                      <span className="badge" style={{ background: 'var(--accent-soft)', color: '#8a5a16', flexShrink: 0, fontSize: 10 }}>
                        Mine
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 3 }}>
                    <PriorityBadge priority={task.priority} />
                  </div>
                </td>
                <td style={{ padding: '11px 14px', maxWidth: 220, color: 'var(--text-secondary)' }}>
                  {lastComment ? (
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lastComment.author.name.split(' ')[0]}: </span>
                      {lastComment.body}
                    </div>
                  ) : (
                    <span style={{ fontStyle: 'italic' }}>No comments</span>
                  )}
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <StatusBadge status={task.status} />
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <RecurrenceBadge recurrenceType={task.recurrenceType} />
                  {(!task.recurrenceType || task.recurrenceType === 'ONE_TIME') && (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>One-time</span>
                  )}
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex' }}>
                    {task.assignees.slice(0, 4).map((a) => (
                      <span
                        key={a.id}
                        title={a.assignee.name}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--ink)',
                          color: 'white',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: -5,
                          border: '2px solid white',
                          flexShrink: 0,
                        }}
                      >
                        {a.assignee.name.charAt(0)}
                      </span>
                    ))}
                    {task.assignees.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unassigned</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                  {fmtDate(task.createdAt)}
                </td>
                <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontWeight: overdue ? 700 : 400, color: overdue ? 'var(--status-blocked)' : 'var(--text-secondary)' }}>
                    {overdue ? '⚠ ' : ''}
                    {fmtDate(task.dueDate)}
                  </span>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No tasks here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
