import React, { useState } from 'react';
import { UserProfile, AppSettings } from '../types';
import { 
  Megaphone, X, Wallet, ArrowUpRight, PlayCircle, Gift, 
  TrendingUp, Award, Users, Share2, CheckCircle2, ChevronRight,
  Clock, AlertCircle, Sparkles
} from 'lucide-react';

interface HomePageProps {
  user: UserProfile;
  settings: AppSettings;
  onNavigate: (tab: 'ads' | 'tasks' | 'referrals' | 'withdraw' | 'profile') => void;
  onClaimDailyBonus: () => Promise<void>;
  isClaimingBonus: boolean;
}

export const HomePage: React.FC<HomePageProps> = ({
  user,
  settings,
  onNavigate,
  onClaimDailyBonus,
  isClaimingBonus,
}) => {
  const [showNotice, setShowNotice] = useState(settings.notice?.show ?? true);

  // Ad progress calculations
  const dailyLimit = settings.dailyAdLimit || 50;
  const todayWatched = user.todayAdsWatched || 0;
  const remainingAds = Math.max(0, dailyLimit - todayWatched);
  const adPercent = Math.min(100, Math.round((todayWatched / dailyLimit) * 100));

  const hourlyLimit = settings.hourlyAdLimit || 10;
  const hourlyWatched = user.hourlyAdsWatched || 0;

  // Check if daily bonus was claimed today (Bangladesh date comparison)
  const isBonusClaimed = !!user.dailyBonusClaimedDate;

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Announcement Card */}
      {showNotice && settings.notice?.text && (
        <div className="relative flex items-start gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-900/40 border border-purple-500/30 backdrop-blur-md shadow-lg shadow-purple-950/20">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 shrink-0 mt-0.5">
            <Megaphone className="w-4 h-4 animate-bounce" />
          </div>
          <div className="flex-1 pr-6">
            <p className="text-xs text-purple-200 leading-relaxed font-medium">
              {settings.notice.text}
            </p>
          </div>
          <button
            onClick={() => setShowNotice(false)}
            className="absolute top-3 right-3 text-purple-400/70 hover:text-purple-200 p-1 rounded-lg transition-colors"
            aria-label="বিজ্ঞপ্তি বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Main Balance Card */}
      <div className="relative overflow-hidden rounded-3xl p-5 glass-card-glow text-white">
        {/* Background gradient decorative glow circles */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-purple-500/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/25 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-white/10 text-purple-200">
                <Wallet className="w-4 h-4" />
              </span>
              <span className="text-xs font-medium text-purple-200/90 tracking-wide uppercase">
                বর্তমান মোট ব্যালেন্স
              </span>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-medium">
              লাইভ ব্যালেন্স
            </span>
          </div>

          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-purple-400">৳</span>
              <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
                {user.balance.toFixed(2)}
              </h1>
              <span className="text-xs text-slate-300 font-medium ml-1">BDT</span>
            </div>
            <p className="text-[11px] text-purple-200/70 mt-1">
              আজকের আয়: <span className="text-emerald-400 font-semibold">+৳{user.todayEarnings.toFixed(2)}</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => onNavigate('ads')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-semibold text-xs tracking-wide shadow-lg shadow-purple-600/30 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <PlayCircle className="w-4 h-4 text-purple-200" />
              <span>উপার্জন শুরু করুন</span>
            </button>

            <button
              onClick={() => onNavigate('withdraw')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs tracking-wide backdrop-blur-md active:scale-[0.98] transition-all"
            >
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              <span>উত্তোলন করুন</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Ad Progress Card */}
      <div className="p-4 rounded-2xl glass-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300">
              <PlayCircle className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold text-slate-200 tracking-wide">
              আজকের বিজ্ঞাপন অগ্রগতি
            </h2>
          </div>
          <span className="text-xs font-mono font-bold text-cyan-400">
            {todayWatched} / {dailyLimit}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="w-full h-2.5 bg-slate-800/80 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-500 shadow-[0_0_10px_#06b6d4]"
              style={{ width: `${adPercent}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 font-medium pt-0.5">
            <span>{adPercent}% সম্পন্ন</span>
            <span>বাকি আছে: <strong className="text-slate-200">{remainingAds}</strong> টি</span>
          </div>
        </div>

        {/* Hourly limit sub-stats */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300 bg-slate-800/50 p-2 rounded-xl">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>এই ঘণ্টায়: <strong>{hourlyWatched} / {hourlyLimit}</strong></span>
          </div>
          <div className="flex items-center justify-between text-slate-300 bg-slate-800/50 p-2 rounded-xl">
            <span className="text-slate-400">প্রতি বিজ্ঞাপন:</span>
            <span className="text-emerald-400 font-bold">
              ৳{user.isPremium ? settings.premiumAdReward.toFixed(2) : settings.adReward.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Daily Bonus Card */}
      <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-indigo-950/40 border border-amber-500/20 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-slate-100">দৈনিক বোনাস</h2>
                <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-semibold">
                  {user.isPremium ? `৳${settings.premiumBonusAmount.toFixed(2)}` : `৳${settings.dailyBonusAmount.toFixed(2)}`}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                প্রতিদিন একবার ফ্রি রিওয়ার্ড ক্লেইম করুন
              </p>
            </div>
          </div>

          <button
            onClick={onClaimDailyBonus}
            disabled={isBonusClaimed || isClaimingBonus}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
              isBonusClaimed
                ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                : isClaimingBonus
                ? 'bg-amber-600 text-white opacity-80 cursor-wait'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 hover:brightness-110 active:scale-95 shadow-amber-500/30'
            }`}
          >
            {isBonusClaimed ? (
              <span className="flex items-center gap-1 text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                সংগৃহীত
              </span>
            ) : isClaimingBonus ? (
              'ক্লেইম হচ্ছে...'
            ) : (
              'ক্লেইম করুন'
            )}
          </button>
        </div>
      </div>

      {/* 5. Quick Action Shortcuts */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => onNavigate('tasks')}
          className="p-3.5 rounded-2xl glass-card hover:border-purple-500/40 cursor-pointer transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 group-hover:bg-purple-500/30 transition-colors">
              <Sparkles className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
          </div>
          <h3 className="text-xs font-bold text-slate-100">টেলিগ্রাম টাস্ক</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">সহজ টাস্কে পান ৳১৫+ পর্যন্ত</p>
        </div>

        <div
          onClick={() => onNavigate('referrals')}
          className="p-3.5 rounded-2xl glass-card hover:border-cyan-500/40 cursor-pointer transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 group-hover:bg-cyan-500/30 transition-colors">
              <Users className="w-4 h-4" />
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </div>
          <h3 className="text-xs font-bold text-slate-100">বন্ধুদের রেফার করুন</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">১০% লাইফটাইম কমিশন</p>
        </div>
      </div>

      {/* 6. Comprehensive Statistics Grid */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            উপার্জন পরিসংখ্যান
          </h2>
          <span className="text-[10px] text-slate-400 font-medium">রিয়েল-টাইম ডাটা</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Today's earnings */}
          <div className="p-3.5 rounded-2xl glass-card flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">আজকের আয়</span>
            <div className="mt-2">
              <span className="text-base font-bold text-emerald-400">
                +৳{user.todayEarnings.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Lifetime earnings */}
          <div className="p-3.5 rounded-2xl glass-card flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">মোট আজীবন আয়</span>
            <div className="mt-2">
              <span className="text-base font-bold text-purple-400">
                ৳{user.lifetimeEarnings.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Total ads */}
          <div className="p-3.5 rounded-2xl glass-card flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">মোট দেখা বিজ্ঞাপন</span>
            <div className="mt-2">
              <span className="text-base font-bold text-cyan-400 font-mono">
                {user.totalAdsWatched} টি
              </span>
            </div>
          </div>

          {/* Total referrals */}
          <div className="p-3.5 rounded-2xl glass-card flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">মোট রেফারেল</span>
            <div className="mt-2">
              <span className="text-base font-bold text-indigo-400 font-mono">
                {user.totalReferrals} জন
              </span>
            </div>
          </div>

          {/* Referral earnings */}
          <div className="p-3.5 rounded-2xl glass-card flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">রেফারেল থেকে আয়</span>
            <div className="mt-2">
              <span className="text-base font-bold text-amber-400">
                ৳{user.referralEarnings.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Total withdrawn */}
          <div className="p-3.5 rounded-2xl glass-card flex flex-col justify-between">
            <span className="text-[11px] text-slate-400 font-medium">মোট সফল উত্তোলন</span>
            <div className="mt-2">
              <span className="text-base font-bold text-rose-400">
                ৳{user.totalWithdrawn.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
