import React from 'react';

const STATUS_META = {
  TODO: { label: 'To Do', color: 'var(--status-todo)' },
  IN_PROGRESS: { label: 'In Progress', color: 'var(--status-progress)' },
  IN_REVIEW: { label: 'In Review', color: 'var(--status-review)' },
  CHANGES_REQUESTED: { label: 'Changes Requested', color: 'var(--status-changes)' },
  DONE: { label: 'Done', color: 'var(--status-done)' },
  BLOCKED: { label: 'Blocked', color: 'var(--status-blocked)' },
};

const PRIORITY_META = {
  LOW: { label: 'Low', color: 'var(--priority-low)' },
  MEDIUM: { label: 'Medium', color: 'var(--priority-medium)' },
  HIGH: { label: 'High', color: 'var(--priority-high)' },
  URGENT: { label: 'Urgent', color: 'var(--priority-urgent)' },
};

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, color: '#999' };
  return (
    <span className="badge" style={{ background: `${meta.color}1A`, color: meta.color }}>
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || { label: priority, color: '#999' };
  return (
    <span className="badge" style={{ background: `${meta.color}1A`, color: meta.color }}>
      {meta.label}
    </span>
  );
}

const RECURRENCE_META = {
  ONE_TIME: { label: 'One-time', color: 'var(--text-secondary)' },
  DAILY: { label: 'Daily', color: '#4A7C9E' },
  WEEKLY: { label: 'Weekly', color: '#5B8C6E' },
  MONTHLY: { label: 'Monthly', color: '#B07CC6' },
  QUARTERLY: { label: 'Quarterly', color: '#E8A33D' },
};

export function RecurrenceBadge({ recurrenceType }) {
  if (!recurrenceType || recurrenceType === 'ONE_TIME') return null;
  const meta = RECURRENCE_META[recurrenceType] || { label: recurrenceType, color: '#999' };
  return (
    <span className="badge" style={{ background: `${meta.color}1A`, color: meta.color }}>
      ↻ {meta.label}
    </span>
  );
}

export { RECURRENCE_META };

export function priorityColor(priority) {
  return (PRIORITY_META[priority] || {}).color || '#999';
}

export { STATUS_META, PRIORITY_META };
