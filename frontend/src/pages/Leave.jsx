import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ReassignPrompt from '../components/ReassignPrompt.jsx';
import TeamCalendar from '../components/TeamCalendar.jsx';

const STATUS_COLOR = {
  PENDING: 'var(--priority-high)',
  APPROVED: 'var(--status-done)',
  REJECTED: 'var(--status-blocked)',
  CANCELLED: 'var(--text-secondary)',
};

export default function Leave() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const [reassignPrompt, setReassignPrompt] = useState(null); // { leaveUserName, tasks }

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/leave')
      .then((res) => setLeaves(res.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function applyForLeave(e) {
    e.preventDefault();
    setError('');
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/leave', {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: reason || undefined,
      });
      setStartDate('');
      setEndDate('');
      setReason('');
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit leave request.');
    } finally {
      setBusy(false);
    }
  }

  async function review(leaveId, decision, leaveUserName) {
    setBusy(true);
    setError('');
    try {
      const res = await api.post(`/leave/${leaveId}/review`, { decision });
      load();
      if (decision === 'APPROVE' && res.data.flaggedTasksForReassignment?.length > 0) {
        setReassignPrompt({ leaveUserName, tasks: res.data.flaggedTasksForReassignment });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not process this request.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel(leaveId) {
    setBusy(true);
    try {
      await api.delete(`/leave/${leaveId}`);
      load();
    } catch {
      setError('Could not cancel request.');
    } finally {
      setBusy(false);
    }
  }

  const canReviewAny = user.role === 'LEAD' || user.role === 'ADMIN';
  const myLeaves = leaves.filter((l) => l.user.id === user.id);
  const othersLeaves = leaves.filter((l) => l.user.id !== user.id);

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Leave</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>
        Sundays and company holidays are off by default — apply here for anything else.
      </p>

      <div className="card" style={{ padding: 22, marginBottom: 28, maxWidth: 480 }}>
        <h2 style={{ fontSize: 15, marginBottom: 14 }}>Apply for leave</h2>
        <form onSubmit={applyForLeave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>From</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required style={{ width: '100%' }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>To</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required style={{ width: '100%' }} />
            </div>
          </div>
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13 }}>{error}</div>}
          <button type="submit" className="btn btn-accent" disabled={busy} style={{ alignSelf: 'flex-start' }}>
            Submit request
          </button>
        </form>
      </div>

      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Team calendar</h2>
        <TeamCalendar />
      </div>

      {loading ? (
        <div>Loading leave requests...</div>
      ) : (
        <>
          <Section title="My requests">
            {myLeaves.length === 0 && <Empty text="You haven't applied for leave yet." />}
            {myLeaves.map((l) => (
              <LeaveRow key={l.id} leave={l} onCancel={() => cancel(l.id)} showCancel={l.status === 'PENDING'} />
            ))}
          </Section>

          {canReviewAny && (
            <Section title="Team requests">
              {othersLeaves.length === 0 && <Empty text="No requests from your team." />}
              {othersLeaves.map((l) => (
                <LeaveRow
                  key={l.id}
                  leave={l}
                  showReview={l.status === 'PENDING'}
                  onApprove={() => review(l.id, 'APPROVE', l.user.name)}
                  onReject={() => review(l.id, 'REJECT', l.user.name)}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {reassignPrompt && (
        <ReassignPrompt
          leaveUserName={reassignPrompt.leaveUserName}
          tasks={reassignPrompt.tasks}
          onClose={() => setReassignPrompt(null)}
        />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{text}</div>;
}

function LeaveRow({ leave, showCancel, showReview, onCancel, onApprove, onReject }) {
  const fmt = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <div className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {leave.user.name} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>· {fmt(leave.startDate)} – {fmt(leave.endDate)}</span>
        </div>
        {leave.reason && <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>{leave.reason}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="badge" style={{ background: `${STATUS_COLOR[leave.status]}1A`, color: STATUS_COLOR[leave.status] }}>
          {leave.status}
        </span>
        {showCancel && <button className="btn btn-ghost" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>}
        {showReview && (
          <>
            <button className="btn btn-accent" onClick={onApprove} style={{ fontSize: 12 }}>Approve</button>
            <button className="btn btn-danger" onClick={onReject} style={{ fontSize: 12 }}>Reject</button>
          </>
        )}
      </div>
    </div>
  );
}
