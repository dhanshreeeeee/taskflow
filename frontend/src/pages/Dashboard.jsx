import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { STATUS_META } from '../components/Badges.jsx';

function StatCard({ label, value, accent, to }) {
  const content = (
    <div
      className="card"
      style={{
        padding: '18px 20px',
        flex: 1,
        minWidth: 140,
        cursor: to ? 'pointer' : 'default',
        transition: 'border-color 0.12s',
      }}
      onMouseEnter={(e) => to && (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => to && (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--ink)', fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
    </div>
  );
  return to ? <Link to={to} style={{ display: 'block', flex: 1, minWidth: 140 }}>{content}</Link> : content;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/dashboard/summary')
      .then((res) => setSummary(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (!summary) return <div>Couldn't load dashboard.</div>;

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Welcome back, {user.name.split(' ')[0]}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Here's what's happening{user.role === 'STAFF' ? ' with your work' : user.role === 'LEAD' ? ' across your team' : ' across the organization'} today.
      </p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="Total tasks" value={summary.totalTasks} to="/tasks" />
        {user.role !== 'STAFF' && (
          <StatCard label="Pending reviews" value={summary.pendingReviews} accent={summary.pendingReviews > 0} to="/reviews" />
        )}
        {user.role !== 'STAFF' && (
          <StatCard label="Leave approvals due" value={summary.pendingLeaveApprovals} accent={summary.pendingLeaveApprovals > 0} to="/leave" />
        )}
        {user.role !== 'STAFF' && (
          <StatCard label="Transfer approvals due" value={summary.pendingTransferApprovals} accent={summary.pendingTransferApprovals > 0} to="/tasks" />
        )}
        {user.role === 'STAFF' && (
          <StatCard label="Pending transfers (mine)" value={summary.pendingTransfersOut} to="/my-tasks" />
        )}
        {user.role === 'LEAD' && <StatCard label="Team size" value={summary.teamSize} />}
        {user.role === 'ADMIN' && <StatCard label="Teams" value={summary.teamCount} />}
        {user.role === 'ADMIN' && <StatCard label="Active users" value={summary.userCount} />}
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 16 }}>Task breakdown</h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: meta.color, display: 'inline-block' }} />
              <span style={{ fontSize: 13 }}>{meta.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                {summary.taskCountsByStatus?.[key] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/my-tasks" className="btn btn-primary">My Tasks</Link>
        <Link to="/tasks" className="btn btn-ghost">{user.role === 'STAFF' ? 'Team Tasks' : 'All Tasks'}</Link>
        <Link to="/leave" className="btn btn-ghost">View leave</Link>
      </div>
    </div>
  );
}
