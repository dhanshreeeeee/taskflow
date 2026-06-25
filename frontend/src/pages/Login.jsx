import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error === 'InvalidCredentials' ? 'Incorrect email or password.' : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ink)',
      }}
    >
      <div className="card" style={{ width: 380, padding: 40 }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              width: 40,
              height: 4,
              background: 'var(--accent)',
              marginBottom: 16,
              borderRadius: 2,
            }}
          />
          <h1 style={{ fontSize: 26 }}>TaskFlow</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13 }}>
            Sign in to manage tasks, leave, and your team.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: '100%' }}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: '100%' }}
              placeholder="••••••••"
            />
          </div>
          {error && <div style={{ color: 'var(--status-blocked)', fontSize: 13 }}>{error}</div>}
          <button type="submit" className="btn btn-accent" disabled={submitting} style={{ marginTop: 6, justifyContent: 'center' }}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
