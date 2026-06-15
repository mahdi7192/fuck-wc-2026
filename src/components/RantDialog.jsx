import React, { useEffect, useRef } from 'react';
import { renderCrest } from '../utils/helpers.jsx';

export default function RantDialog({
  isOpen,
  onClose,
  player,
  onRant,
  predefinedRants,
  isMatchFinished,
  homeTeam,
  awayTeam,
  matchScore,
  matchMinutes,
  matchStatus
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    if (isOpen) {
      if (!dialogEl.open) {
        dialogEl.showModal();
        document.body.style.overflow = 'hidden';
      }
    } else {
      if (dialogEl.open) {
        dialogEl.close();
        document.body.style.overflow = '';
      }
    }
  }, [isOpen]);

  if (!player) return null;

  const getPositionDetails = (pos) => {
    switch (pos?.toUpperCase()) {
      case 'GOALKEEPER':
        return { label: 'دروازه‌بان', color: 'var(--color-gk)' };
      case 'DEFENDER':
        return { label: 'مدافع', color: 'var(--color-def)' };
      case 'MIDFIELDER':
        return { label: 'هافبک', color: 'var(--color-mid)' };
      case 'FORWARD':
        return { label: 'مهاجم', color: 'var(--color-fwd)' };
      default:
        return { label: 'بازیکن', color: 'var(--md-sys-color-on-surface-variant)' };
    }
  };

  const { label: posLabel, color: posColor } = getPositionDetails(player.position);

  const handleDialogClick = (e) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleCancel = (e) => {
    e.preventDefault();
    onClose();
  };

  const totalRants = player.totalRants || 0;
  const playerFlag = player.side === 'home' ? homeTeam?.crest : awayTeam?.crest;

  const sortedRantsForAnalytics = [...predefinedRants]
    .map(rant => ({
      ...rant,
      count: player.rants?.[rant.key] || 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Split into 3 rows for horizontal flow
  const row1 = predefinedRants.slice(0, 5);
  const row2 = predefinedRants.slice(5, 10);
  const row3 = predefinedRants.slice(10, 15);

  return (
    <dialog
      ref={dialogRef}
      className="md3-bottom-sheet"
      onClick={handleDialogClick}
      onCancel={handleCancel}
    >
      <div className="sheet-container" style={{ gap: '14px', padding: '8px 16px 20px 16px' }}>
        {/* Drag handle */}
        <div className="sheet-drag-handle"></div>

        <div className="sheet-header-centered" style={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)', boxSizing: 'border-box' }}>
          {/* Close button at the top corner */}
          <button
            onClick={onClose}
            aria-label="بستن"
            className="native-dialog-close-btn"
            style={{ position: 'absolute', top: 0, right: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          {/* Large Avatar container */}
          <div className="large-avatar-container" style={{ position: 'relative', width: '72px', height: '72px', marginBottom: '10px', marginTop: '2px' }}>
            <img
              src={player.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.side === 'home' ? '00e676' : 'ff3e3e'}`}
              alt={player.name}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '2px solid var(--border-color-active)',
                objectFit: 'cover',
                display: 'block',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.side === 'home' ? '00e676' : 'ff3e3e'}`;
              }}
            />
            <span 
              className="native-player-number-chip"
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--color-surface-hover)',
                color: 'var(--text-primary)',
                border: '1.5px solid var(--border-color-active)',
                fontFamily: 'var(--font-family-en)',
                fontSize: '0.75rem',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '8px',
                minWidth: '20px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                lineHeight: 1
              }}
            >
              {player.shirtNumber}
            </span>
          </div>

          {/* Centered Name and Info */}
          <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: '2px 0', textAlign: 'center' }}>
            {player.name}
          </h2>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-hint)', marginTop: '2px' }}>
            <span>{posLabel}</span>
            <span style={{ color: 'var(--border-color-active)' }}>•</span>
            <span style={{ color: player.totalRants > 0 ? 'var(--color-danger)' : 'var(--text-hint)', fontWeight: '700' }}>
              {player.totalRants} فحش ثبت‌شده
            </span>
          </div>
        </div>

        {/* Section 1: Curses Analytics (Top 10) at the Top */}
        <div className="native-dialog-section" style={{ paddingBottom: '10px' }}>
          <h3 className="native-dialog-section-title" style={{ marginBottom: '6px' }}>
            آمار فحش‌های ثبت‌شده ({totalRants} بار)
          </h3>
          
          <div className="native-analytics-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '110px', overflowY: 'auto', paddingRight: '4px' }}>
            {sortedRantsForAnalytics.map((rant) => {
              const count = rant.count;
              const percent = totalRants > 0 ? Math.round((count / totalRants) * 100) : 0;
              
              return (
                <div key={rant.key} className="native-analytics-row" style={{ minWidth: 0 }}>
                  <div className="native-analytics-labels">
                    <span className="native-analytics-rant-name">{rant.persianText}</span>
                    <span className="native-analytics-rant-value">
                      {count} بار ({percent}٪)
                    </span>
                  </div>
                  <div className="native-progress-track">
                    <div className="native-progress-fill" style={{ width: `${percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Cursing Action Chips in 3 Horizontal Rows at the Bottom */}
        {matchStatus === 'LIVE' && (
          <div className="native-dialog-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            <h3 className="native-dialog-section-title">
              ثبت فحش (تخلیه خشم)
            </h3>
            
            <div className="native-rants-scroll-container">
              <div className="native-rants-scroll-row">
                {row1.map((rant) => (
                  <button
                    key={rant.key}
                    onClick={(e) => onRant(player.id, rant.key, e)}
                    className="native-rant-chip"
                  >
                    {rant.persianText}
                  </button>
                ))}
              </div>
              
              <div className="native-rants-scroll-row">
                {row2.map((rant) => (
                  <button
                    key={rant.key}
                    onClick={(e) => onRant(player.id, rant.key, e)}
                    className="native-rant-chip"
                  >
                    {rant.persianText}
                  </button>
                ))}
              </div>

              <div className="native-rants-scroll-row">
                {row3.map((rant) => (
                  <button
                    key={rant.key}
                    onClick={(e) => onRant(player.id, rant.key, e)}
                    className="native-rant-chip"
                  >
                    {rant.persianText}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
