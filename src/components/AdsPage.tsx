import React, { useState, useEffect } from 'react';
import { UserProfile, AppSettings, AdSession } from '../types';
import { api } from '../api';
import { 
  Play, CheckCircle, AlertTriangle, ShieldCheck, Clock, 
  Sparkles, Award, RotateCcw, Lock, Tv, Info, ExternalLink 
} from 'lucide-react';

interface AdsPageProps {
  user: UserProfile;
  settings: AppSettings;
  onRefreshUser: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdsPage: React.FC<AdsPageProps> = ({
  user,
  settings,
  onRefreshUser,
  showToast,
}) => {
  const [session, setSession] = useState<AdSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isPlayingAd, setIsPlayingAd] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dailyLimit = settings.dailyAdLimit || 50;
  const todayWatched = user.todayAdsWatched || 0;
  const remainingAds = Math.max(0, dailyLimit - todayWatched);
  const hourlyLimit = settings.hourlyAdLimit || 10;
  const hourlyWatched = user.hourlyAdsWatched || 0;

  const currentReward = user.isPremium ? settings.premiumAdReward : settings.adReward;

  // Countdown effect during ad playback
  useEffect(() => {
    let timer: any;
    if (isPlayingAd && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isPlayingAd && countdown === 0) {
      // Ad completed countdown -> Trigger backend verification and claim
      handleCompleteAd();
    }
    return () => clearInterval(timer);
  }, [isPlayingAd, countdown]);

  // Step 1: Request Ad Session from Backend
  const handleStartAd = async () => {
    setErrorMessage(null);
    setClaimSuccess(null);

    // Frontend pre-check for limits
    if (todayWatched >= dailyLimit) {
      setErrorMessage('আজকের বিজ্ঞাপন সীমা শেষ হয়েছে।');
      showToast('আজকের বিজ্ঞাপন সীমা শেষ হয়েছে।', 'error');
      return;
    }

    if (hourlyWatched >= hourlyLimit) {
      setErrorMessage('এই ঘণ্টার বিজ্ঞাপন সীমা শেষ হয়েছে।');
      showToast('এই ঘণ্টার বিজ্ঞাপন সীমা শেষ হয়েছে।', 'error');
      return;
    }

    setIsLoadingSession(true);

    try {
      // Call backend to create secure server-side ad session
      const newSession = await api.createAdSession();
      setSession(newSession);

      // Start Ad Playback
      setIsLoadingSession(false);
      setIsPlayingAd(true);
      setCountdown(newSession.minWatchTime || 15);
    } catch (err: any) {
      setIsLoadingSession(false);
      const msg = err.message || 'বিজ্ঞাপন সেশন শুরু করা যায়নি।';
      setErrorMessage(msg);
      showToast(msg, 'error');
    }
  };

  // Step 2: User completed ad duration -> Send adSessionId to backend for server-side verification
  const handleCompleteAd = async () => {
    if (!session) return;

    setIsPlayingAd(false);
    setIsVerifying(true);

    try {
      // Server-side verification and atomic credit
      const result = await api.claimAd(session.adSessionId);

      setClaimSuccess(result.reward);
      showToast(`অভিনন্দন! ৳${result.reward.toFixed(2)} আপনার একাউন্টে যোগ হয়েছে!`, 'success');

      // Refresh real user profile data from backend
      await onRefreshUser();
    } catch (err: any) {
      const msg = err.message || 'বিজ্ঞাপন যাচাই করা যায়নি। আবার চেষ্টা করুন।';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsVerifying(false);
      setSession(null);
    }
  };

  const isDailyLimitReached = todayWatched >= dailyLimit;
  const isHourlyLimitReached = hourlyWatched >= hourlyLimit;

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden p-5 rounded-3xl glass-card-glow text-white">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/30 rounded-full blur-2xl"></div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                <Tv className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-sm font-bold text-slate-100">বিজ্ঞাপন দেখুন ও আয় করুন</h1>
                <p className="text-[11px] text-purple-300/80">Monetag স্পন্সরড ভিডিও নেটওয়ার্ক</p>
              </div>
            </div>

            <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>+৳{currentReward.toFixed(2)}</span>
            </div>
          </div>

          {/* Stats Badges */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center">
            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block">আজ দেখেছেন</span>
              <span className="text-xs font-bold text-purple-300 font-mono">
                {todayWatched} / {dailyLimit}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block">এই ঘণ্টায়</span>
              <span className="text-xs font-bold text-cyan-300 font-mono">
                {hourlyWatched} / {hourlyLimit}
              </span>
            </div>

            <div className="p-2 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block">বাকি আছে</span>
              <span className="text-xs font-bold text-emerald-300 font-mono">
                {remainingAds} টি
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Error Message Banner */}
      {errorMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs animate-shake">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* 3. Claim Success Banner */}
      {claimSuccess !== null && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs animate-in zoom-in-95">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-emerald-300 text-sm">সফলভাবে ক্লেইম সম্পন্ন হয়েছে!</p>
            <p className="text-[11px] text-emerald-200/80">
              আপনার একাউন্টে <strong>+৳{claimSuccess.toFixed(2)}</strong> যোগ করা হয়েছে।
            </p>
          </div>
        </div>
      )}

      {/* 4. Interactive Ad Stage Card */}
      <div className="p-5 rounded-3xl glass-card space-y-4">
        {isPlayingAd ? (
          // Active Ad Playing Screen
          <div className="space-y-4 text-center py-4 animate-in fade-in">
            <div className="relative mx-auto w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-tr from-purple-600 to-indigo-600 p-1 shadow-[0_0_30px_rgba(147,51,234,0.4)]">
              <div className="w-full h-full bg-[#0b0f1d] rounded-full flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-purple-400 font-mono">
                  {countdown}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">সেকেন্ড</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-100">
                বিজ্ঞাপন প্রদর্শিত হচ্ছে...
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                পুরো বিজ্ঞাপনটি মনোযোগ দিয়ে দেখুন। সময় শেষ হলে স্বয়ংক্রিয়ভাবে রিওয়ার্ড জমা হবে।
              </p>
            </div>

            {/* Simulated Monetag Ad Zone container */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 text-left space-y-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 text-purple-300">
                  <ShieldCheck className="w-3 h-3" />
                  Monetag Zone: {session?.zoneId}
                </span>
                <span className="font-mono text-slate-500">ID: {session?.adSessionId.slice(0, 14)}...</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-1000"
                  style={{ width: `${Math.max(0, 100 - (countdown / (session?.minWatchTime || 15)) * 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        ) : isVerifying ? (
          // Server Verification State
          <div className="py-8 text-center space-y-3 animate-in fade-in">
            <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">বিজ্ঞাপন যাচাই করা হচ্ছে...</h3>
              <p className="text-xs text-slate-400 mt-1">
                সার্ভার সেশন ও রিওয়ার্ড নিশ্চিত করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন।
              </p>
            </div>
          </div>
        ) : (
          // Idle / Ready to Watch State
          <div className="space-y-4">
            <div className="text-center py-3 space-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400 mb-3 shadow-inner">
                <Play className="w-7 h-7 fill-purple-400/20 stroke-[2.5]" />
              </div>
              <h2 className="text-sm font-bold text-slate-100">
                পরবর্তী বিজ্ঞাপন দেখতে প্রস্তুত?
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                ১৫ সেকেন্ডের বিজ্ঞাপন সম্পন্ন করে জিতে নিন <strong>৳{currentReward.toFixed(2)}</strong> নিশ্চিত ক্যাশ রিওয়ার্ড।
              </p>
            </div>

            <button
              onClick={handleStartAd}
              disabled={isLoadingSession || isDailyLimitReached || isHourlyLimitReached}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                isDailyLimitReached || isHourlyLimitReached
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                  : isLoadingSession
                  ? 'bg-purple-700 text-white cursor-wait opacity-80'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:brightness-110 active:scale-[0.98] shadow-purple-600/30'
              }`}
            >
              {isLoadingSession ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>সেশন তৈরি হচ্ছে...</span>
                </>
              ) : isDailyLimitReached ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>আজকের বিজ্ঞাপন সীমা শেষ হয়েছে</span>
                </>
              ) : isHourlyLimitReached ? (
                <>
                  <Clock className="w-4 h-4" />
                  <span>এই ঘণ্টার বিজ্ঞাপন সীমা শেষ হয়েছে</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>বিজ্ঞাপন দেখুন (Watch Ad)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 5. Advertisement Rules Card */}
      <div className="p-4 rounded-2xl glass-card space-y-2.5 text-xs text-slate-300">
        <div className="flex items-center gap-2 text-slate-200 font-bold">
          <Info className="w-4 h-4 text-purple-400" />
          <span>বিজ্ঞাপন দেখার নিয়মাবলী ও নিরাপত্তা</span>
        </div>

        <ul className="space-y-2 text-slate-400 pl-1">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
            <span>১. বিজ্ঞাপনটি সম্পূর্ণ না দেখে ক্লোজ করলে অথবা পেজ পরিবর্তন করলে কোনো রিওয়ার্ড পাবেন না।</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
            <span>২. প্রতি ঘণ্টায় সর্বোচ্চ ১০টি এবং দিনে সর্বোচ্চ ৫০টি বিজ্ঞাপন দেখার সুযোগ রয়েছে।</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
            <span>৩. কোনো প্রকার স্ক্রিপ্ট, ভিপিএন বা অটোমেটেড বট ব্যবহার করলে একাউন্ট আজীবনের জন্য ব্যান করা হবে।</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0"></span>
            <span>৪. সকল রিওয়ার্ড সার্ভার-সাইড যাচাইকরণের পরই আপনার ব্যালেন্সে যোগ করা হয়।</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
