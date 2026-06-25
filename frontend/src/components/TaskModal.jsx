import React, { useEffect, useState, useRef } from 'react';
import { api, API_URL } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useAssignableUsers } from '../utils/useAssignableUsers.js';
import { StatusBadge, PriorityBadge } from './Badges.jsx';
import Modal from './Modal.jsx';

const ACTIVITY_LABEL = {
  CREATED: 'created the task',
  ASSIGNED: 'assigned',
  STATUS_CHANGE: 'changed status',
  REVIEWED: 'reviewed',
  TRANSFER_REQUESTED: 'requested a transfer',
  TRANSFERRED: 'transferred the task',
  TRANSFER_REJECTED: 'rejected a transfer request',
  REASSIGNED_BY_LEAD: 'reassigned the task',
};

export default function TaskModal({ taskId, onClose, onUpdated }) {
  const { user } = useAuth();
  const { users } = useAssignableUsers();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [commentImage, setCommentImage] = useState(null); // File object
  const [commentImagePreview, setCommentImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const [reviewNote, setReviewNote] = useState('');
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');

  function load() {
    setLoading(true);
    api
      .get(`/tasks/${taskId}`)
      .then((res) => setTask(res.data))
      .catch(() => setError('Could not load this task.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [taskId]);

  function refreshAndNotify() {
    load();
    onUpdated?.();
  }

  const isAssignee = task?.assignees.some((a) => a.assignee.id === user.id);
  const canReview = (user.role === 'LEAD' || user.role === 'ADMIN') && task?.status === 'IN_REVIEW';
  const canMarkInReview = isAssignee && ['TODO', 'IN_PROGRESS', 'CHANGES_REQUESTED'].includes(task?.status);
  const canMarkInProgress = isAssignee && task?.status === 'TODO';
  const canMarkBlocked = isAssignee && ['TODO', 'IN_PROGRESS'].includes(task?.status);

  async function setStatus(status) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      refreshAndNotify();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(decision) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/tasks/${taskId}/review`, { decision, note: reviewNote || undefined });
      setReviewNote('');
      refreshAndNotify();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit review.');
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!commentBody.trim() && !commentImage) return;
    setBusy(true);
    setError('');
    try {
      let imageUrl;
      if (commentImage) {
        setUploadingImage(true);
        const formData = new FormData();
        formData.append('file', commentImage);
        const uploadRes = await api.post('/uploads/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        imageUrl = uploadRes.data.url;
        setUploadingImage(false);
      }
      await api.post(`/tasks/${taskId}/comments`, {
        body: commentBody.trim() || undefined,
        imageUrl,
      });
      setCommentBody('');
      clearCommentImage();
      load();
    } catch (err) {
      setUploadingImage(false);
      setError(err.response?.data?.message || 'Could not post comment.');
    } finally {
      setBusy(false);
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Only JPEG, PNG, WEBP, and GIF images are supported.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Image must be under 8MB.');
      return;
    }
    setError('');
    setCommentImage(file);
    setCommentImagePreview(URL.createObjectURL(file));
  }

  function clearCommentImage() {
    if (commentImagePreview) URL.revokeObjectURL(commentImagePreview);
    setCommentImage(null);
    setCommentImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submitTransferRequest(e) {
    e.preventDefault();
    if (!transferTo) return;
    setBusy(true);
    setError('');
    try {
      await api.post(`/tasks/${taskId}/transfer-requests`, {
        toUserId: transferTo,
        reason: transferReason || undefined,
      });
      setShowTransferForm(false);
      setTransferTo('');
      setTransferReason('');
      refreshAndNotify();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request transfer.');
    } finally {
      setBusy(false);
    }
  }

  async function reviewTransfer(transferId, decision) {
    setBusy(true);
    setError('');
    try {
      await api.post(`/tasks/${taskId}/transfer-requests/${transferId}/review`, { decision });
      refreshAndNotify();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resolve transfer request.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <Modal title="Loading..." onClose={onClose}>
        <div>Loading task...</div>
      </Modal>
    );
  }
  if (!task) {
    return (
      <Modal title="Error" onClose={onClose}>
        <div style={{ color: 'var(--status-blocked)' }}>{error || 'Task not found.'}</div>
      </Modal>
    );
  }

  const pendingTransfer = task.transferRequests.find((t) => t.status === 'PENDING');
  const canReviewTransfer = (user.role === 'LEAD' || user.role === 'ADMIN') && pendingTransfer;

  return (
    <Modal title={task.title} onClose={onClose} width={680}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', alignSelf: 'center' }}>
            Due {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>

      {task.description && (
        <p style={{ fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 18, lineHeight: 1.6 }}>{task.description}</p>
      )}

      <div style={{ display: 'flex', gap: 24, marginBottom: 20, fontSize: 12.5 }}>
        <div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Created by</div>
          <div style={{ fontWeight: 600 }}>{task.createdBy.name}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Assignees</div>
          <div style={{ fontWeight: 600 }}>{task.assignees.map((a) => a.assignee.name).join(', ') || '—'}</div>
        </div>
        {task.reviewedBy && (
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>Reviewed by</div>
            <div style={{ fontWeight: 600 }}>{task.reviewedBy.name}</div>
          </div>
        )}
      </div>

      {task.reviewNote && (
        <div className="card" style={{ padding: 12, marginBottom: 18, background: '#fdf6e8', borderColor: 'var(--accent-soft)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>REVIEW NOTE</div>
          <div style={{ fontSize: 13 }}>{task.reviewNote}</div>
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--status-blocked)', fontSize: 13, marginBottom: 14 }}>{error}</div>
      )}

      {/* --- Action zone --- */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {canMarkInProgress && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => setStatus('IN_PROGRESS')}>
            Start work
          </button>
        )}
        {canMarkInReview && (
          <button className="btn btn-primary" disabled={busy} onClick={() => setStatus('IN_REVIEW')}>
            Submit for review
          </button>
        )}
        {canMarkBlocked && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => setStatus('BLOCKED')}>
            Mark blocked
          </button>
        )}
        {isAssignee && !pendingTransfer && (
          <button className="btn btn-ghost" disabled={busy} onClick={() => setShowTransferForm((s) => !s)}>
            Request transfer
          </button>
        )}
      </div>

      {showTransferForm && (
        <form onSubmit={submitTransferRequest} className="card" style={{ padding: 16, marginBottom: 22, background: '#f8f7f3' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Request transfer to:</div>
          <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} required style={{ width: '100%', marginBottom: 10 }}>
            <option value="">Select a person...</option>
            {users.filter((u) => u.id !== user.id).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <input
            placeholder="Reason (optional)"
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            style={{ width: '100%', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn btn-accent" disabled={busy}>Send request</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowTransferForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {pendingTransfer && (
        <div className="card" style={{ padding: 14, marginBottom: 22, background: '#f3f0fb' }}>
          <div style={{ fontSize: 13, marginBottom: canReviewTransfer ? 10 : 0 }}>
            <strong>{pendingTransfer.fromUser.name}</strong> requested to transfer this task to{' '}
            <strong>{pendingTransfer.toUser.name}</strong>
            {pendingTransfer.reason ? ` — "${pendingTransfer.reason}"` : ''}. Awaiting approval.
          </div>
          {canReviewTransfer && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-accent" disabled={busy} onClick={() => reviewTransfer(pendingTransfer.id, 'APPROVE')}>
                Approve transfer
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => reviewTransfer(pendingTransfer.id, 'REJECT')}>
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {canReview && (
        <div className="card" style={{ padding: 16, marginBottom: 22, background: '#fdf6e8' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>This task is awaiting your review</div>
          <textarea
            placeholder="Optional note for the assignee..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={2}
            style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-accent" disabled={busy} onClick={() => submitReview('APPROVE')}>
              Approve & close
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => submitReview('REJECT')}>
              Request changes
            </button>
          </div>
        </div>
      )}

      {/* --- Comments --- */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Comments</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          {task.comments.length === 0 && (
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No comments yet.</div>
          )}
          {task.comments.map((c) => (
            <div key={c.id} style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{c.author.name}</span>{' '}
              <span style={{ color: 'var(--text-secondary)', fontSize: 11.5 }}>
                {new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
              {c.body && <div style={{ marginTop: 2 }}>{c.body}</div>}
              {c.imageUrl && (
                <a href={`${API_URL}${c.imageUrl}`} target="_blank" rel="noopener noreferrer">
                  <img
                    src={`${API_URL}${c.imageUrl}`}
                    alt="Attached"
                    style={{ maxWidth: 220, maxHeight: 160, borderRadius: 6, marginTop: 6, display: 'block', border: '1px solid var(--border)' }}
                  />
                </a>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={submitComment}>
          {commentImagePreview && (
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
              <img src={commentImagePreview} alt="Preview" style={{ maxWidth: 140, maxHeight: 100, borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
              <button
                type="button"
                onClick={clearCommentImage}
                className="btn btn-ghost"
                style={{ position: 'absolute', top: -8, right: -8, padding: '2px 7px', fontSize: 12, borderRadius: '50%', background: 'white' }}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              style={{ flex: 1 }}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-ghost"
              title="Attach an image"
              aria-label="Attach an image"
              style={{ padding: '8px 10px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button type="submit" className="btn btn-ghost" disabled={busy || uploadingImage}>
              {uploadingImage ? 'Uploading...' : 'Post'}
            </button>
          </div>
        </form>
      </div>

      {/* --- Activity log --- */}
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 10 }}>Activity</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {task.activity.map((a) => (
            <div key={a.id} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{a.actor.name}</strong>{' '}
              {ACTIVITY_LABEL[a.action] || a.action.toLowerCase()}
              {' · '}
              {new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
