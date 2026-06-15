import React, { useState, useEffect } from 'react';
import { getPersianTeamName, formatMatchTime, formatMatchDate, renderCrest, getTeamFlag } from '../utils/helpers';

export default function MatchesList({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/match');
      if (!res.ok) {
        throw new Error('خطا در دریافت لیست بازی‌ها');
      }
      const data = await res.json();
      setMatches(data.matches || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'مشکلی در ارتباط با سرور پیش آمده است');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
    // Poll for list updates every 30s to keep scores fresh
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && matches.length === 0) {
    return (
      <div className="matches-loading-container">
        <div className="blink matches-loading-text">
          🏟️ در حال دریافت لیست بازی‌های فعال جام جهانی...
        </div>
        <div className="matches-skeleton-list">
          {[1, 2, 3].map(i => (
            <div key={i} className="match-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error && matches.length === 0) {
    return (
      <div className="matches-error-container">
        <div className="settings-error" style={{ textAlign: 'center', padding: '16px' }}>
          ⚠️ {error}
        </div>
        <button onClick={fetchMatches} className="md3-btn md3-btn-filled-primary" style={{ marginTop: '12px' }}>
          تلاش مجدد
        </button>
      </div>
    );
  }

  const liveMatches = matches.filter(m => m.status === 'LIVE');
  const upcomingMatches = matches.filter(m => m.status === 'WAITING');
  const finishedMatches = matches.filter(m => m.status === 'FINISHED');

  const renderMatchCard = (match) => {
    const isLive = match.status === 'LIVE';
    const isFinished = match.status === 'FINISHED';

    return (
      <div
        key={match.id}
        onClick={() => onSelectMatch(match.id)}
        className={`native-match-item ${isLive ? 'match-item-live' : ''}`}
      >
        {/* Right side: Home Team (RTL right-to-left layout) */}
        <div className="native-match-team home">
          {renderCrest(match.homeTeam.crest || getTeamFlag(match.homeTeam.name), match.homeTeam.name, 'native-team-logo')}
          <span className="native-team-name">{getPersianTeamName(match.homeTeam.name)}</span>
        </div>

        {/* Center: Score or VS and Status */}
        <div className="native-match-center">
          {isLive || isFinished ? (
            <div className="native-score-box">
              <span className="native-score-num">{match.score.home}</span>
              <span className={`native-score-colon ${isLive ? 'blink' : ''}`}>-</span>
              <span className="native-score-num">{match.score.away}</span>
            </div>
          ) : (
            <span className="native-vs-label">VS</span>
          )}
          
          <div className="native-status-badge">
            {isLive && (
              <span className="native-live-text">
                <span className="pulse-dot"></span>
                {match.displayClock === "HT" || match.displayClock === "بین نیمه" || /HT/i.test(String(match.displayClock))
                  ? "بین نیمه"
                  : `دقیقه ${match.displayClock || match.elapsed}'`}
              </span>
            )}
            {isFinished && <span className="native-finished-text">پایان</span>}
            {!isLive && !isFinished && (
              <div className="native-upcoming-badge">
                <span className="native-upcoming-time">{formatMatchTime(match.utcDate)}</span>
                <span className="native-upcoming-date">{formatMatchDate(match.utcDate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Left side: Away Team */}
        <div className="native-match-team away">
          <span className="native-team-name">{getPersianTeamName(match.awayTeam.name)}</span>
          {renderCrest(match.awayTeam.crest || getTeamFlag(match.awayTeam.name), match.awayTeam.name, 'native-team-logo')}
        </div>
      </div>
    );
  };

  return (
    <div className="matches-list-container">
      {/* 1. LIVE MATCHES */}
      {liveMatches.length > 0 && (
        <div className="matches-section animate-slide-in">
          <h2 className="matches-section-title">
            <span className="live-dot" /> بازی‌های زنده در حال برگزاری
          </h2>
          <div className="matches-grid">
            {liveMatches.map(renderMatchCard)}
          </div>
        </div>
      )}

      {/* 2. UPCOMING MATCHES */}
      {upcomingMatches.length > 0 && (
        <div className="matches-section animate-slide-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="matches-section-title">📅 بازی‌های پیش‌رو امروز</h2>
          <div className="matches-grid">
            {upcomingMatches.map(renderMatchCard)}
          </div>
        </div>
      )}

      {/* 3. FINISHED MATCHES */}
      {finishedMatches.length > 0 && (
        <div className="matches-section animate-slide-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="matches-section-title">🏁 بازی‌های خاتمه‌یافته</h2>
          <div className="matches-grid">
            {finishedMatches.map(renderMatchCard)}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <div className="matches-empty">
          <div style={{ fontSize: '3rem' }}>⚽</div>
          <h3>هیچ مسابقه‌ای در حال حاضر یافت نشد.</h3>
          <p>بعداً دوباره مراجعه کنید یا اتصال اینترنت خود را بررسی کنید.</p>
        </div>
      )}
    </div>
  );
}
