import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Stable color per person, derived from their id, so the same person always
// gets the same color across renders without needing a server-side mapping.
const PERSON_COLORS = ['#4A7C9E', '#5B8C6E', '#B07CC6', '#E8A33D', '#C75450', '#7F9CC9', '#9C8A5A'];
function colorForUser(userId) {
  let hash = 2166136261; // FNV-1a offset basis
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  return PERSON_COLORS[(hash >>> 0) % PERSON_COLORS.length];
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

export default function TeamCalendar() {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/holidays', { params: { year: viewYear } }),
      api.get('/leave', { params: { status: 'APPROVED' } }),
    ])
      .then(([holidayRes, leaveRes]) => {
        setHolidays(holidayRes.data);
        setLeaves(leaveRes.data);
      })
      .finally(() => setLoading(false));
  }, [viewYear]);

  useEffect(() => {
    load();
  }, [load]);

  // Build a map of date string -> { holiday?, leaveUsers: [{id,name}] }
  const dayInfo = useMemo(() => {
    const map = {};

    for (const h of holidays) {
      const key = ymd(new Date(h.date));
      map[key] = map[key] || { holiday: null, leaveUsers: [] };
      map[key].holiday = h.name;
    }

    for (const l of leaves) {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        const key = ymd(cursor);
        map[key] = map[key] || { holiday: null, leaveUsers: [] };
        map[key].leaveUsers.push({ id: l.user.id, name: l.user.name });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return map;
  }, [holidays, leaves]);

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay(); // 0=Sun

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function goPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function goNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  }

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // Collect the distinct people on leave this month, for a small legend
  const peopleThisMonth = useMemo(() => {
    const seen = new Map();
    Object.values(dayInfo).forEach((info) => {
      info.leaveUsers.forEach((u) => seen.set(u.id, u.name));
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [dayInfo]);

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={goPrevMonth} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }} aria-label="Previous month">
            ‹
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, minWidth: 150, textAlign: 'center' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button onClick={goNextMonth} className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 13 }} aria-label="Next month">
            ›
          </button>
        </div>
        {!isCurrentMonth && (
          <button onClick={goToday} className="btn btn-ghost" style={{ fontSize: 12 }}>
            Today
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading calendar...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'center', padding: '4px 0' }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;

              const dateObj = new Date(viewYear, viewMonth, day);
              const key = ymd(dateObj);
              const info = dayInfo[key];
              const isSunday = dateObj.getDay() === 0;
              const isToday = ymd(today) === key;
              const isOff = isSunday || !!info?.holiday;

              return (
                <div
                  key={key}
                  style={{
                    minHeight: 64,
                    borderRadius: 6,
                    padding: '6px 6px',
                    background: isOff ? '#f3f0e8' : 'white',
                    border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <span style={{ fontSize: 11.5, fontWeight: isToday ? 700 : 500, color: isOff ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    {day}
                  </span>
                  {info?.holiday && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--accent)', lineHeight: 1.2 }}>
                      {info.holiday}
                    </span>
                  )}
                  {isSunday && !info?.holiday && (
                    <span style={{ fontSize: 9.5, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sunday</span>
                  )}
                  {info?.leaveUsers?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 'auto' }}>
                      {info.leaveUsers.slice(0, 4).map((u) => (
                        <span
                          key={u.id}
                          title={u.name}
                          style={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            background: colorForUser(u.id),
                            fontSize: 7,
                            color: 'white',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {u.name.charAt(0)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {peopleThisMonth.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              {peopleThisMonth.map((u) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorForUser(u.id), display: 'inline-block' }} />
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>{u.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
