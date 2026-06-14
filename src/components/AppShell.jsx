import React, { useState, useEffect } from 'react';
import MatchesList from './MatchesList';
import MatchZone from './MatchZone';
import Leaderboard from './Leaderboard';

// Helper to get a cookie
const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
};

// Helper to set a cookie (default 365 days -> permanent)
const setCookie = (name, value, days = 365) => {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax`;
};

export default function AppShell() {
  // Initialize permanent user cookie on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let userId = getCookie('rage_user_id');
      if (!userId) {
        userId = 'usr_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        setCookie('rage_user_id', userId, 365);
      }
    }
  }, []);

  const [activeMatchId, setActiveMatchId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('match') || null;
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'leaderboard'

  const navigateToMatch = (id) => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (id) {
      params.set('match', id);
    } else {
      params.delete('match');
    }

    const newSearch = params.toString();
    const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;

    const currentParams = new URLSearchParams(window.location.search);
    const currentId = currentParams.get('match') || null;
    if (currentId !== id) {
      window.history.pushState({ matchId: id, navigatedInApp: true }, '', newUrl);
    }
    setActiveMatchId(id);
  };

  const handleBack = () => {
    if (typeof window === 'undefined') return;
    
    if (window.history.state && window.history.state.navigatedInApp) {
      window.history.back();
    } else {
      navigateToMatch(null);
    }
  };

  // Sync URL popstate/back-forward navigation with React state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const matchId = params.get('match') || null;
      setActiveMatchId(matchId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Sync Telegram WebApp BackButton
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      const handleTelegramBack = () => {
        handleBack();
      };

      if (activeMatchId) {
        tg.BackButton.show();
        tg.BackButton.onClick(handleTelegramBack);
      } else {
        tg.BackButton.hide();
      }

      return () => {
        if (tg.BackButton) {
          tg.BackButton.offClick(handleTelegramBack);
          tg.BackButton.hide();
        }
      };
    }
  }, [activeMatchId]);

  return (
    <div className="app-shell-content" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      {/* Sticky Navigation Bar */}
      <header className="native-app-bar">
        <div className="native-app-bar-inner">
          <div className="native-app-bar-right">
            {activeMatchId && (
              <button
                onClick={handleBack}
                aria-label="بازگشت"
                className="native-back-button"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
          </div>
          <div className="native-app-bar-center">
            <h1 className="native-app-bar-title">استادیوم خشم</h1>
            <p className="native-app-bar-subtitle">جام جهانی ۲۰۲۶</p>
          </div>
          <div className="native-app-bar-left">
            {/* Left side empty for spacing balance */}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="native-main-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', paddingBottom: !activeMatchId ? '80px' : '0' }}>
        {activeMatchId ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
            <MatchZone matchId={activeMatchId} onBack={handleBack} />
          </div>
        ) : activeTab === 'matches' ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
            <MatchesList onSelectMatch={navigateToMatch} />
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
            <Leaderboard />
          </div>
        )}
      </main>

      {/* Bottom Navigation Tabs */}
      {!activeMatchId && (
        <nav className="native-bottom-nav">
          <button
            onClick={() => setActiveTab('matches')}
            className={`native-nav-item ${activeTab === 'matches' ? 'active' : ''}`}
          >
            <span className="nav-item-icon">⚽</span>
            <span className="nav-item-label">مسابقات</span>
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`native-nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
          >
            <span className="nav-item-icon">🏆</span>
            <span className="nav-item-label">جدول خشم</span>
          </button>
        </nav>
      )}

      {/* Native App Footer */}
      <footer className="native-app-footer" style={{ paddingBottom: !activeMatchId ? '100px' : '24px' }}>
        <p>© ۲۰۲۶ استادیوم خشم فوتبالی • تلگرام مینی‌اپ</p>
      </footer>
    </div>
  );
}
