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
      <div className="sheet-container">
        {/* Drag handle */}
        <div className="sheet-drag-handle"></div>

        <div 
          className={`native-player-row ${player.side === 'home' ? 'home-row' : 'away-row'}`}
          style={{ 
            cursor: 'default', 
            borderBottom: '1px solid var(--border-color)', 
            paddingBottom: '12px', 
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <div className="player-row-right">
            <div className="native-player-avatar-container">
              <img
                src={player.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=${player.side === 'home' ? '00e676' : 'ff3e3e'}`}
                alt={player.name}
                className="native-player-avatar"
              />
              <span className="native-player-number-chip">{player.shirtNumber}</span>
            </div>
            <div className="native-player-name-wrapper">
              <span className="native-player-name">
                {player.name}
              </span>
              <span 
                className="native-player-rants-count"
                style={{ color: player.totalRants > 0 ? 'var(--color-danger)' : 'var(--text-hint)' }}
              >
                {player.totalRants} فحش
              </span>
            </div>
          </div>

          <div className="player-row-left">
            <button
              onClick={onClose}
              aria-label="بستن"
              className="native-dialog-close-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Section 1: Curses Analytics (Top 10) at the Top */}
        <div className="native-dialog-section">
          <h3 className="native-dialog-section-title">
            آمار فحش‌های ثبت‌شده ({totalRants} بار)
          </h3>
          
          <div className="native-analytics-list">
            {sortedRantsForAnalytics.map((rant) => {
              const count = rant.count;
              const percent = totalRants > 0 ? Math.round((count / totalRants) * 100) : 0;
              
              return (
                <div key={rant.key} className="native-analytics-row">
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
