import React, { useState, useEffect } from 'react';
import { UserProfile, AppSettings, TabType } from './types';
import { api } from './api';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './components/HomePage';
import { AdsPage } from './components/AdsPage';
import { TasksPage } from './components/TasksPage';
import { ReferralsPage } from './components/ReferralsPage';
import { WithdrawPage } from './components/WithdrawPage';
import { ProfilePage } from './components/ProfilePage';
import { 
  AlertCircle, RefreshCw, CheckCircle2, Info, X, 
  Settings2, ShieldAlert 
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isClaimingBonus, setIsClaimingBonus] = useState(false);

  // Toast notification system
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToast({ id, message, type });
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'error') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      } else if (type === 'success') {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      } else {
        window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
      }
    }
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 3500);
  };

  // Initialize Telegram WebApp & Authenticate
  const initApp = async () => {
    setLoading(true);
    setServerError(null);

    // Tell Telegram WebApp it is ready & expand full height
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      } catch (e) {
        console.warn('Telegram WebApp init error', e);
      }
    }

    try {
      const authData = await api.authenticate();
      setUser(authData.user);
      setSettings(authData.settings);
    } catch (err: any) {
      console.error('App init failed:', err);
      const msg = err.message || 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না।';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const freshUser = await api.getUser();
      setUser(freshUser);
    } catch (err: any) {
      console.warn('Refresh user failed:', err);
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  // Daily Bonus Handler
  const handleClaimDailyBonus = async () => {
    if (!user || isClaimingBonus) return;
    setIsClaimingBonus(true);
    try {
      const res = await api.claimDailyBonus();
      showToast(`অভিনন্দন! +৳${res.bonus.toFixed(2)} দৈনিক বোনাস পেয়েছেন!`, 'success');
      await refreshUser();
    } catch (err: any) {
      showToast(err.message || 'দৈনিক বোনাস ক্লেইম করা যায়নি।', 'error');
    } finally {
      setIsClaimingBonus(false);
    }
  };

  // Switch tab with haptic feedback
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  };

  // Server error fallback screen
  if (serverError && !user) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-[480px] p-6 rounded-3xl glass-card text-center space-y-4 border border-rose-500/30 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30 animate-pulse">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">সার্ভারের সাথে সংযোগ সমস্যা</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              সার্ভারের সাথে সংযোগ করা যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।
            </p>
          </div>
          <button
            onClick={initApp}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs tracking-wide shadow-lg shadow-purple-600/30 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>আবার চেষ্টা করুন</span>
          </button>
        </div>
      </div>
    );
  }

  // Initial loading screen
  if (loading || !user || !settings) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 p-0.5 shadow-[0_0_40px_rgba(147,51,234,0.4)] animate-pulse">
          <div className="w-full h-full bg-[#070b14] rounded-2xl flex items-center justify-center">
            <span className="text-2xl font-black text-purple-400">W</span>
          </div>
        </div>
        <p className="text-xs font-semibold text-purple-300 mt-4 tracking-wider uppercase">
          WatchPay লোড হচ্ছে...
        </p>
      </div>
    );
  }

  // Render current tab page
  const renderCurrentPage = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomePage
            user={user}
            settings={settings}
            onNavigate={(tab) => handleTabChange(tab)}
            onClaimDailyBonus={handleClaimDailyBonus}
            isClaimingBonus={isClaimingBonus}
          />
        );
      case 'ads':
        return (
          <AdsPage
            user={user}
            settings={settings}
            onRefreshUser={refreshUser}
            showToast={showToast}
          />
        );
      case 'tasks':
        return (
          <TasksPage
            user={user}
            onRefreshUser={refreshUser}
            showToast={showToast}
          />
        );
      case 'referrals':
        return (
          <ReferralsPage
            user={user}
            settings={settings}
            onRefreshUser={refreshUser}
            showToast={showToast}
          />
        );
      case 'withdraw':
        return (
          <WithdrawPage
            user={user}
            settings={settings}
            onRefreshUser={refreshUser}
            showToast={showToast}
          />
        );
      case 'profile':
        return (
          <ProfilePage
            user={user}
            settings={settings}
            onRefreshUser={refreshUser}
            showToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] flex justify-center selection:bg-purple-600 selection:text-white">
      {/* 480px Mobile Content Container */}
      <div className="w-full max-w-[480px] min-h-screen flex flex-col bg-[#070b14] relative shadow-[0_0_50px_rgba(0,0,0,0.8)] border-x border-white/5">
        
        {/* Navbar */}
        <Navbar 
          user={user} 
          onOpenProfile={() => handleTabChange('profile')} 
        />

        {/* Main Viewport Content */}
        <main className="flex-1 px-3.5 pt-3">
          {renderCurrentPage()}
        </main>

        {/* Fixed Bottom Navigation */}
        <BottomNav
          activeTab={activeTab}
          onChangeTab={handleTabChange}
          adsCountBadge={Math.max(0, (settings.dailyAdLimit || 50) - (user.todayAdsWatched || 0))}
        />

        {/* Toast Notification Notification Alert */}
        {toast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[420px] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
            <div
              className={`p-3 rounded-2xl shadow-xl backdrop-blur-xl border flex items-center gap-2.5 text-xs font-semibold ${
                toast.type === 'error'
                  ? 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-950/40'
                  : toast.type === 'success'
                  ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-950/40'
                  : 'bg-purple-950/90 text-purple-200 border-purple-500/40 shadow-purple-950/40'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Info className="w-4 h-4 text-purple-400 shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
