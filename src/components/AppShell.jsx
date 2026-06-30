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
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfileState] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  // Telegram verification states
  const [isTelegramWebApp, setIsTelegramWebApp] = useState(true);
  const [isTelegramChecked, setIsTelegramChecked] = useState(false);

  // Profile Form States
  const [formName, setFormName] = useState('');
  const [formAvatar, setFormAvatar] = useState('⚽');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [avatarType, setAvatarType] = useState('emoji'); // 'emoji' | 'url'

  const defaultEmojis = ['⚽', '🏆', '💩', '🤡', '👑', '🏃‍♂️', '🧤', '🍔', '🍺', '🦖'];

  // Cookie and WebApp initialization on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const urlParams = new URLSearchParams(window.location.search);
      const isMock = urlParams.get('mock') === 'true';

      const loadUserProfile = (id) => {
        // Save user details to cookies/localStorage for fast UI rendering
        const cachedProfile = localStorage.getItem(`rage_profile_${id}`);
        if (cachedProfile) {
          try {
            const parsed = JSON.parse(cachedProfile);
            setUserProfileState(parsed);
            setFormName(parsed.name || '');
            if (parsed.avatar) {
              if (defaultEmojis.includes(parsed.avatar)) {
                setFormAvatar(parsed.avatar);
                setAvatarType('emoji');
              } else {
                setCustomAvatarUrl(parsed.avatar);
                setAvatarType('url');
              }
            }
          } catch (e) {}
        }

        // Fetch latest profile from DB/Redis
        fetch(`/api/user?userId=${id}`)
          .then(res => res.json())
          .then(data => {
            if (data.profile) {
              setUserProfileState(data.profile);
              localStorage.setItem(`rage_profile_${id}`, JSON.stringify(data.profile));
              setFormName(data.profile.name || '');
              if (data.profile.avatar) {
                if (defaultEmojis.includes(data.profile.avatar)) {
                  setFormAvatar(data.profile.avatar);
                  setAvatarType('emoji');
                } else {
                  setCustomAvatarUrl(data.profile.avatar);
                  setAvatarType('url');
                }
              }
            } else {
              // Profile does not exist yet -> First time setup!
              setIsFirstTimeSetup(true);
              setShowProfileModal(true);

              // Try to prefill from Telegram WebApp SDK user object
              if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
                const defaultName = tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '');
                setFormName(defaultName || tgUser.username || '');
                if (tgUser.photo_url) {
                  setCustomAvatarUrl(tgUser.photo_url);
                  setAvatarType('url');
                }
              }
            }
          })
          .catch(err => console.error("Failed to load user profile:", err));
      };

      const startUserSession = () => {
        // Resolve User ID
        const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
        let id = null;
        if (tgUser && tgUser.id) {
          id = `tg_${tgUser.id}`;
          setCookie('rage_user_id', id, 365);
        } else {
          id = getCookie('rage_user_id');
          if (!id) {
            id = 'usr_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            setCookie('rage_user_id', id, 365);
          }
        }
        setUserId(id);
        loadUserProfile(id);
      };

      let attempts = 0;
      const maxAttempts = 30; // 3 seconds total duration with 100ms intervals

      const checkAndInit = () => {
        const hasTelegramScript = typeof window.Telegram !== 'undefined';
        const initData = window.Telegram?.WebApp?.initData;
        const inTelegram = !!initData;
        const valid = inTelegram || isLocal || isMock;

        if (valid) {
          setIsTelegramWebApp(true);
          setIsTelegramChecked(true);
          startUserSession();
          return true;
        } else if (hasTelegramScript) {
          // Script is loaded, but it's not local, mock, or within Telegram (empty initData)
          setIsTelegramWebApp(false);
          setIsTelegramChecked(true);
          return true;
        }
        return false;
      };

      // Perform check immediately
      if (!checkAndInit()) {
        const intervalId = setInterval(() => {
          attempts++;
          if (checkAndInit() || attempts >= maxAttempts) {
            clearInterval(intervalId);
            if (attempts >= maxAttempts && typeof window.Telegram === 'undefined') {
              // Timeout reached without script load. Assume not in Telegram context.
              setIsTelegramWebApp(false);
              setIsTelegramChecked(true);
            }
          }
        }, 100);
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

  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    if (!userId) return;

    const finalName = formName.trim() || 'تماشاگر ناشناس';
    const finalAvatar = avatarType === 'emoji' ? formAvatar : customAvatarUrl.trim();

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: finalName, avatar: finalAvatar })
      });
      const data = await res.json();
      if (data.success) {
        setUserProfileState(data.profile);
        localStorage.setItem(`rage_profile_${userId}`, JSON.stringify(data.profile));
        setShowProfileModal(false);
        setIsFirstTimeSetup(false);
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const handleDeleteProfile = async () => {
    if (!userId) return;
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: null, avatar: null })
      });
      const data = await res.json();
      if (data.success) {
        setUserProfileState(null);
        localStorage.removeItem(`rage_profile_${userId}`);
        setFormName('');
        setFormAvatar('⚽');
        setCustomAvatarUrl('');
        setAvatarType('emoji');
        setShowProfileModal(false);
        setIsFirstTimeSetup(false);
      }
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  const renderProfileAvatar = (profile, className = "profile-chip-avatar") => {
    if (!profile || !profile.avatar) {
      const initial = profile?.name ? profile.name.trim().charAt(0) : '👤';
      return <div className={`${className} initials`}>{initial}</div>;
    }
    const isEmoji = defaultEmojis.includes(profile.avatar);
    if (isEmoji) {
      return <div className={`${className} emoji`}>{profile.avatar}</div>;
    } else {
      return <img src={profile.avatar} alt="Avatar" className={className} onError={(e) => {
        e.target.onerror = null;
        e.target.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=placeholder';
      }} />;
    }
  };

  // 1. Telegram Blocker Rendering
  if (isTelegramChecked && !isTelegramWebApp) {
    return (
      <div className="telegram-blocker-overlay">
        <div className="telegram-blocker-card">
          <div className="blocker-logo">🏟️</div>
          <h2>ورود فقط از تلگرام</h2>
          <p>این برنامه فقط از داخل پیام‌رسان تلگرام به صورت مینی‌اپ قابل استفاده است. لطفا وارد ربات تلگرام شوید و دکمه ورود به استادیوم را بزنید.</p>
          <a href="https://t.me/bonjol_stadium_2026_bot" className="tg-bot-btn">ورود به ربات تلگرام</a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      {/* Sticky Navigation Bar */}
      <header className="native-app-bar">
        <div className="native-app-bar-inner">
          <div className="native-app-bar-right">
            {activeMatchId ? (
              <button
                 onClick={handleBack}
                 aria-label="بازگشت"
                 className="native-back-button"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ) : null}
          </div>
          <div className="native-app-bar-center">
            <h1 className="native-app-bar-title">استادیوم بنجل‌ها</h1>
            <p className="native-app-bar-subtitle">جام جهانی ۲۰۲۶</p>
          </div>
          <div className="native-app-bar-left">
            <button 
              className="native-profile-header-btn" 
              onClick={() => setShowProfileModal(true)}
              aria-label="حساب کاربری"
            >
              {userProfile ? (
                <div className="profile-chip">
                  {renderProfileAvatar(userProfile)}
                  <span className="profile-chip-name">{userProfile.name}</span>
                </div>
              ) : (
                <div className="profile-chip empty">
                  <span className="profile-chip-avatar">👤</span>
                  <span className="profile-chip-name">تنظیم نام</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="native-main-content" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1, 
        minHeight: 0,
        width: '100%', 
        overflowY: activeMatchId ? 'hidden' : 'auto', 
        WebkitOverflowScrolling: 'touch',
        paddingBottom: !activeMatchId ? '80px' : '0' 
      }}>
        {activeMatchId ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
            <MatchZone matchId={activeMatchId} onBack={handleBack} userProfile={userProfile} userId={userId} />
          </div>
        ) : activeTab === 'matches' ? (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
            <MatchesList onSelectMatch={navigateToMatch} />
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, width: '100%' }}>
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
            <span className="nav-item-label">جدول بنجل‌ها</span>
          </button>
        </nav>
      )}

      {/* Profile Dialog Modal */}
      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => !isFirstTimeSetup && setShowProfileModal(false)}>
          <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>{isFirstTimeSetup ? 'تنظیم حساب کاربری' : 'ویرایش حساب کاربری'}</h3>
              {!isFirstTimeSetup && (
                <button className="modal-close-btn" onClick={() => setShowProfileModal(false)}>×</button>
              )}
            </div>
            <form onSubmit={handleSaveProfile} className="profile-modal-form">
              <div className="form-group">
                <label>نام نمایشی شما:</label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)} 
                  placeholder="نام خود را وارد کنید..."
                  required
                  dir="rtl"
                />
              </div>

              <div className="form-group">
                <label>عکس پروفایل (آواتار):</label>
                <div className="avatar-type-selector">
                  <button 
                    type="button" 
                    className={`avatar-type-btn ${avatarType === 'emoji' ? 'active' : ''}`}
                    onClick={() => setAvatarType('emoji')}
                  >
                    انتخاب ایموجی
                  </button>
                  <button 
                    type="button" 
                    className={`avatar-type-btn ${avatarType === 'url' ? 'active' : ''}`}
                    onClick={() => setAvatarType('url')}
                  >
                    لینک عکس دلخواه
                  </button>
                </div>

                {avatarType === 'emoji' ? (
                  <div className="avatar-emoji-grid">
                    {defaultEmojis.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        className={`avatar-emoji-btn ${formAvatar === emoji ? 'selected' : ''}`}
                        onClick={() => setFormAvatar(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="custom-avatar-url-input">
                    <input 
                      type="url" 
                      value={customAvatarUrl} 
                      onChange={(e) => setCustomAvatarUrl(e.target.value)} 
                      placeholder="https://example.com/avatar.jpg"
                      dir="ltr"
                    />
                    {customAvatarUrl.trim() && (
                      <div className="avatar-preview-box">
                        <img src={customAvatarUrl} alt="Preview" onError={(e) => { e.target.style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="profile-modal-actions">
                <button type="submit" className="save-profile-btn">ذخیره تنظیمات</button>
                {!isFirstTimeSetup && (
                  <button 
                    type="button" 
                    className="delete-profile-btn"
                    onClick={handleDeleteProfile}
                  >
                    حذف و ریست نام
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
