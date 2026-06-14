import React, { useState, useEffect } from 'react';
import { getPersianTeamName, renderCrest } from '../utils/helpers';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('players'); // 'players' | 'teams'
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) {
        throw new Error('خطا در دریافت جدول رده‌بندی');
      }
      const data = await res.json();
      setPlayers(data.players || []);
      setTeams(data.teams || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'مشکلی در ارتباط با سرور پیش آمده است');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const getRankEmojiOrText = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getRankBadgeClass = (index) => {
    if (index === 0) return 'rank-first';
    if (index === 1) return 'rank-second';
    if (index === 2) return 'rank-third';
    return 'rank-normal';
  };

  if (loading) {
    return (
      <div className="leaderboard-loading-container">
        <div className="blink leaderboard-loading-text">
          📊 در حال محاسبه میزان خشم تماشاگران...
        </div>
        <div className="leaderboard-skeleton-list">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="leaderboard-skeleton-card" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-error-container">
        <div className="settings-error" style={{ textAlign: 'center', padding: '16px' }}>
          ⚠️ {error}
        </div>
        <button onClick={fetchLeaderboard} className="md3-btn md3-btn-filled-primary" style={{ marginTop: '12px', padding: '8px 16px' }}>
          تلاش مجدد
        </button>
      </div>
    );
  }

  const maxPlayerRants = players.length > 0 ? players[0].totalRants : 0;
  const maxTeamRants = teams.length > 0 ? teams[0].totalRants : 0;

  return (
    <div className="leaderboard-container animate-fade-in">
      {/* Premium Dashboard Header */}
      <div className="leaderboard-header-banner">
        <div className="leaderboard-banner-item">
          <span className="banner-icon">👑</span>
          <div className="banner-text">
            <span className="banner-label">رو مخ‌ترین بازیکن جام</span>
            <span className="banner-value">
              {players.length > 0 ? players[0].name : 'هنوز رایی ثبت نشده'}
            </span>
          </div>
        </div>
        <div className="leaderboard-banner-item">
          <span className="banner-icon">💩</span>
          <div className="banner-text">
            <span className="banner-label">رو مخ‌ترین تیم جام</span>
            <span className="banner-value">
              {teams.length > 0 ? getPersianTeamName(teams[0].name) : 'هنوز رایی ثبت نشده'}
            </span>
          </div>
        </div>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="leaderboard-tabs">
        <button
          onClick={() => setActiveTab('players')}
          className={`leaderboard-tab-btn ${activeTab === 'players' ? 'active' : ''}`}
        >
          🚶‍♂️ گه ترین بازیکنان
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`leaderboard-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
        >
          🛡️ گه ترین تیم‌ها
        </button>
      </div>

      {/* Leaderboard Lists */}
      <div className="leaderboard-content-card">
        {activeTab === 'players' ? (
          players.length > 0 ? (
            <div className="leaderboard-list">
              {players.map((player, index) => {
                const percentage = maxPlayerRants > 0 ? (player.totalRants / maxPlayerRants) * 100 : 0;
                return (
                  <div key={player.id} className="leaderboard-item">
                    <div className="leaderboard-item-meta">
                      <span className={`leaderboard-rank ${getRankBadgeClass(index)}`}>
                        {getRankEmojiOrText(index)}
                      </span>
                      <div className="leaderboard-avatar-wrapper">
                        <img
                          src={player.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=ff3e3e`}
                          alt={player.name}
                          className="leaderboard-item-avatar"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=ff3e3e`;
                          }}
                        />
                      </div>
                      <div className="leaderboard-item-details">
                        <span className="leaderboard-item-name">{player.name}</span>
                        <span className="leaderboard-item-subtext">تیم: {getPersianTeamName(player.teamName)}</span>
                      </div>
                    </div>
                    <div className="leaderboard-item-stats">
                      <span className="leaderboard-item-score">{player.totalRants} فحش</span>
                      <div className="leaderboard-progress-track">
                        <div
                          className="leaderboard-progress-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="leaderboard-empty">
              <span>🕊️</span>
              <p>هنوز هیچ فحشی برای بازیکنی ثبت نشده است!</p>
            </div>
          )
        ) : (
          teams.length > 0 ? (
            <div className="leaderboard-list">
              {teams.map((team, index) => {
                const percentage = maxTeamRants > 0 ? (team.totalRants / maxTeamRants) * 100 : 0;
                return (
                  <div key={team.id} className="leaderboard-item">
                    <div className="leaderboard-item-meta">
                      <span className={`leaderboard-rank ${getRankBadgeClass(index)}`}>
                        {getRankEmojiOrText(index)}
                      </span>
                      <div className="leaderboard-crest-wrapper">
                        {renderCrest(team.crest || '🇮🇷', team.name, 'leaderboard-item-crest')}
                      </div>
                      <div className="leaderboard-item-details">
                        <span className="leaderboard-item-name">{getPersianTeamName(team.name)}</span>
                      </div>
                    </div>
                    <div className="leaderboard-item-stats">
                      <span className="leaderboard-item-score">{team.totalRants} فحش</span>
                      <div className="leaderboard-progress-track">
                        <div
                          className="leaderboard-progress-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="leaderboard-empty">
              <span>🕊️</span>
              <p>هنوز هیچ فحشی برای تیمی ثبت نشده است!</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
