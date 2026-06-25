import React, { useEffect } from 'react';

export default function Modal({ title, onClose, width = 560, children }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 33, 61, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        className="card"
        style={{
          width,
          maxWidth: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            position: 'sticky',
            top: 0,
            background: 'var(--bg-card)',
            zIndex: 1,
          }}
        >
          <h2 style={{ fontSize: 17 }}>{title}</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost"
            aria-label="Close"
            style={{ padding: '4px 10px', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}
