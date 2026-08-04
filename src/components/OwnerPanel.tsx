import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAvailability as loadAvailability, saveAvailability, logoutOwner } from '../lib/ownerApi';
import OwnerGalleryManager from './OwnerGalleryManager';

interface OwnerPanelProps {
  onLogout: () => void;
}

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function OwnerPanel({ onLogout }: OwnerPanelProps) {
  const today = new Date();
  const [curYear, setCurYear] = useState(today.getFullYear());
  const [curMonth, setCurMonth] = useState(today.getMonth());
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [tab, setTab] = useState<'availability' | 'photos'>('availability');

  // Load initial data
  const fetchAvailability = useCallback(async () => {
    try {
      const data = await loadAvailability();
      setBookedDates(new Set(data.bookedDates || []));
    } catch {
      showToast('Failed to load availability data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const formatDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const getDays = (y: number, m: number) => {
    const d = new Date(y, m, 1);
    const days: (Date | null)[] = [];
    for (let i = 0; i < d.getDay(); i++) days.push(null);
    while (d.getMonth() === m) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const getDatesInRange = (start: string, end: string): string[] => {
    const dates: string[] = [];
    const cur = new Date(start);
    const endDate = new Date(end);
    if (cur > endDate) {
      // Swap if start is after end
      return getDatesInRange(end, start);
    }
    while (cur <= endDate) {
      dates.push(formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const handleDateClick = (day: Date, shiftKey: boolean) => {
    const ds = formatDate(day);

    if (shiftKey && rangeStart) {
      // Range selection with shift+click
      const rangeDates = getDatesInRange(rangeStart, ds);
      setSelectedDates((prev) => {
        const next = new Set(prev);
        rangeDates.forEach((d) => next.add(d));
        return next;
      });
      setRangeStart(ds);
      return;
    }

    setRangeStart(ds);
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(ds)) {
        next.delete(ds);
      } else {
        next.add(ds);
      }
      return next;
    });
  };

  const markAsBooked = () => {
    if (selectedDates.size === 0) return;
    setBookedDates((prev) => {
      const next = new Set(prev);
      selectedDates.forEach((d) => next.add(d));
      return next;
    });
    setSelectedDates(new Set());
    setHasChanges(true);
  };

  const markAsAvailable = () => {
    if (selectedDates.size === 0) return;
    setBookedDates((prev) => {
      const next = new Set(prev);
      selectedDates.forEach((d) => next.delete(d));
      return next;
    });
    setSelectedDates(new Set());
    setHasChanges(true);
  };

  const clearSelection = () => {
    setSelectedDates(new Set());
    setRangeStart(null);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const res = await saveAvailability([...bookedDates].sort());

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403 || res.status === 401) {
          showToast('Session expired. Please login again.', 'error');
          setTimeout(onLogout, 1500);
          return;
        }
        throw new Error(data.error || 'Save failed');
      }

      showToast('Availability saved successfully', 'success');
      setHasChanges(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutOwner();
    onLogout();
  };

  const prevMonth = () => {
    if (curMonth === 0) {
      setCurMonth(11);
      setCurYear((p) => p - 1);
    } else {
      setCurMonth((p) => p - 1);
    }
  };

  const nextMonth = () => {
    if (curMonth === 11) {
      setCurMonth(0);
      setCurYear((p) => p + 1);
    } else {
      setCurMonth((p) => p + 1);
    }
  };

  const days = getDays(curYear, curMonth);

  // Count stats
  const totalBookedThisMonth = days.filter(
    (d) => d && bookedDates.has(formatDate(d))
  ).length;
  const totalDaysThisMonth = days.filter((d) => d !== null).length;

  if (loading) {
    return (
      <div className="owner-panel-loading">
        <div className="owner-login-spinner" />
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--color-ash)', marginTop: '1.5rem' }}>
          Loading availability...
        </p>
      </div>
    );
  }

  return (
    <div className="owner-panel">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`owner-toast ${toast.type === 'success' ? 'owner-toast-success' : 'owner-toast-error'}`}
          >
            {toast.type === 'success' ? '✓' : '✕'} {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="owner-header">
        <div className="owner-header-inner">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="gold-shimmer-text"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
                  fontWeight: 300,
                  letterSpacing: '0.08em',
                }}
              >
                SaGa
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
                  fontWeight: 300,
                  letterSpacing: '0.08em',
                  color: 'var(--color-warm-white)',
                }}
              >
                Montana
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.55rem',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--color-ash)',
                marginTop: '0.25rem',
              }}
            >
              Availability Manager
            </p>
          </div>
          <button onClick={handleLogout} className="owner-logout-btn">
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="owner-main">
        <div className="owner-content">
          {/* Tabs */}
          <div className="owner-tabs">
            <button
              onClick={() => setTab('availability')}
              className={`owner-tab ${tab === 'availability' ? 'owner-tab-active' : ''}`}
            >
              Availability
            </button>
            <button
              onClick={() => setTab('photos')}
              className={`owner-tab ${tab === 'photos' ? 'owner-tab-active' : ''}`}
            >
              Photos
            </button>
          </div>

          {tab === 'photos' ? (
            <OwnerGalleryManager onLogout={onLogout} />
          ) : (
          <>
          {/* Instructions */}
          <div className="owner-instructions">
            <p>Click dates to select them, then mark as booked or available. Use <strong>Shift + Click</strong> to select a range.</p>
          </div>

          {/* Calendar & Controls Grid */}
          <div className="owner-grid">
            {/* Calendar */}
            <div className="owner-calendar-card glass-dark">
              {/* Month nav */}
              <div className="flex justify-between items-center mb-8">
                <button
                  onClick={prevMonth}
                  className="text-white/40 hover:text-[var(--color-champagne)] transition-colors text-lg"
                >
                  ←
                </button>
                <span
                  className="text-sm tracking-[0.2em] uppercase text-[var(--color-warm-white)]"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 400,
                    fontSize: '1.1rem',
                  }}
                >
                  {monthNames[curMonth]} {curYear}
                </span>
                <button
                  onClick={nextMonth}
                  className="text-white/40 hover:text-[var(--color-champagne)] transition-colors text-lg"
                >
                  →
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                  <span
                    key={d}
                    className="text-center text-[0.55rem] tracking-[0.2em] uppercase text-[var(--color-ash)]"
                    style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}
                  >
                    {d}
                  </span>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {days.map((day, i) => {
                  if (!day) return <span key={`e-${i}`} />;
                  const ds = formatDate(day);
                  const isBooked = bookedDates.has(ds);
                  const isSelected = selectedDates.has(ds);

                  let cellClass = 'owner-cal-day';
                  if (isSelected) cellClass += ' owner-cal-selected';
                  else if (isBooked) cellClass += ' owner-cal-booked';
                  else cellClass += ' owner-cal-available';

                  return (
                    <button
                      key={ds}
                      onClick={(e) => handleDateClick(day, e.shiftKey)}
                      className={cellClass}
                    >
                      <span className="owner-cal-day-num">{day.getDate()}</span>
                      {isBooked && !isSelected && (
                        <span className="owner-cal-status-dot owner-cal-dot-booked" />
                      )}
                      {!isBooked && !isSelected && (
                        <span className="owner-cal-status-dot owner-cal-dot-available" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="owner-legend">
                <div className="owner-legend-item">
                  <span className="owner-legend-dot owner-cal-dot-available" />
                  <span>Available</span>
                </div>
                <div className="owner-legend-item">
                  <span className="owner-legend-dot owner-cal-dot-booked" />
                  <span>Booked</span>
                </div>
                <div className="owner-legend-item">
                  <span className="owner-legend-dot" style={{ background: 'var(--color-champagne)' }} />
                  <span>Selected</span>
                </div>
              </div>
            </div>

            {/* Actions Sidebar */}
            <div className="owner-actions-card glass-dark">
              <p className="eyebrow mb-6">Actions</p>

              {/* Stats */}
              <div className="owner-stat-row">
                <span>Month</span>
                <span className="text-[var(--color-warm-white)]">
                  {monthNames[curMonth]} {curYear}
                </span>
              </div>
              <div className="owner-stat-row">
                <span>Booked days</span>
                <span style={{ color: totalBookedThisMonth > 0 ? 'var(--color-burgundy-light)' : 'var(--color-warm-white)' }}>
                  {totalBookedThisMonth} / {totalDaysThisMonth}
                </span>
              </div>
              <div className="owner-stat-row">
                <span>Available days</span>
                <span style={{ color: '#4ade80' }}>
                  {totalDaysThisMonth - totalBookedThisMonth} / {totalDaysThisMonth}
                </span>
              </div>

              <div className="gold-divider-wide my-6" />

              {/* Selection info */}
              <div className="owner-stat-row mb-6">
                <span>Selected</span>
                <span className="text-[var(--color-champagne)]">
                  {selectedDates.size} {selectedDates.size === 1 ? 'date' : 'dates'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={markAsBooked}
                  disabled={selectedDates.size === 0}
                  className="owner-action-btn owner-btn-booked"
                >
                  🔴 Mark as Booked
                </button>
                <button
                  onClick={markAsAvailable}
                  disabled={selectedDates.size === 0}
                  className="owner-action-btn owner-btn-available"
                >
                  🟢 Mark as Available
                </button>
                <button
                  onClick={clearSelection}
                  disabled={selectedDates.size === 0}
                  className="owner-action-btn owner-btn-clear"
                >
                  Clear Selection
                </button>
              </div>

              <div className="gold-divider-wide my-6" />

              {/* Save */}
              <button
                onClick={saveChanges}
                disabled={saving || !hasChanges}
                className="owner-save-btn"
              >
                {saving ? (
                  <span className="owner-login-spinner" />
                ) : hasChanges ? (
                  'Save Changes'
                ) : (
                  'No Changes'
                )}
              </button>

              {hasChanges && (
                <p
                  className="text-center mt-3"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '0.5rem',
                    letterSpacing: '0.15em',
                    color: 'var(--color-champagne)',
                  }}
                >
                  Unsaved changes
                </p>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}
