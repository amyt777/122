import React, { useState, useEffect } from 'react';
import { UserProfile, ReferralData, AppSettings } from '../types';
import { api } from '../api';
import { 
  Users, Copy, Check, Share2, Sparkles, TrendingUp, 
  ShieldCheck, Info, Gift, UserCheck, Clock 
} from 'lucide-react';

interface ReferralsPageProps {
  user: UserProfile;
  settings: AppSettings;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshUser?: () => Promise<void>;
}

export const ReferralsPage: React.FC<ReferralsPageProps> = ({
  user,
  settings,
  showToast,
  onRefreshUser,
}) => {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const referralLink = `https://t.me/watchpaybdbot?startapp=${user.telegramId}`;

  const loadReferrals = async () => {
    setLoading(true);
    try {
      const res = await api.getReferrals();
      setData(res);
    } catch (err: any) {
      showToast(err.message || 'রেফারেল তথ্য লোড করা যায়নি।', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimEarnings = async () => {
    setClaiming(true);
    try {
      const res = await api.claimReferralEarnings();
      showToast(res.message || `৳${res.claimedAmount.toFixed(2)} রেফারেল বোনাস যোগ হয়েছে!`, 'success');
      await loadReferrals();
      if (onRefreshUser) {
        await onRefreshUser();
      }
    } catch (err: any) {
      showToast(err.message || 'রেফারেল বোনাস ক্লেইম করা যায়নি।', 'error');
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    loadReferrals();
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showToast('রেফারেল লিংক কপি করা হয়েছে!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTelegram = () => {
    const text = encodeURIComponent(
      `🔥 WatchPay টেলিগ্রাম মিনি অ্যাপে বিজ্ঞাপন দেখুন ও সরাসরি বিকাশ, নগদ ও রকেটে টাকা উত্তোলন করুন! জয়েন করতে লিংকে ক্লিক করুন:`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`;

    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Header Card */}
      <div className="relative overflow-hidden p-5 rounded-3xl glass-card-glow text-white">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-sm font-bold text-slate-100">রেফারেল প্রোগ্রাম</h1>
              <p className="text-[11px] text-purple-300/80">
                বন্ধুদের আমন্ত্রণ জানিয়ে আজীবন ১০% কমিশন লাভ করুন
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-purple-200">কমিশন রেট:</span>
            </div>
            <span className="text-sm font-extrabold text-emerald-400">
              {settings.referralCommissionPercent || 10}% আজীবন
            </span>
          </div>
        </div>
      </div>

      {/* 2. Referral Link Box */}
      <div className="p-4 rounded-2xl glass-card space-y-3">
        <label className="text-xs font-bold text-slate-200 block">
          আপনার ইউনিক রেফারেল লিংক
        </label>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/80 border border-purple-500/30">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="bg-transparent text-xs text-purple-200 font-mono flex-1 outline-none select-all truncate"
          />
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 shrink-0 transition-colors"
            title="কপি করুন"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleCopyLink}
            className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Copy className="w-3.5 h-3.5 text-purple-300" />
            <span>{copied ? 'কপি হয়েছে' : 'লিংক কপি'}</span>
          </button>

          <button
            onClick={handleShareTelegram}
            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold shadow-md shadow-cyan-600/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>টেলিগ্রামে শেয়ার</span>
          </button>
        </div>
      </div>

      {/* 3. Referral Statistics */}
      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="p-3 rounded-2xl glass-card">
          <span className="text-[10px] text-slate-400 block mb-1">মোট রেফারেল</span>
          <span className="text-sm font-bold text-purple-300 font-mono">
            {data?.totalReferrals ?? user.totalReferrals} জন
          </span>
        </div>

        <div className="p-3 rounded-2xl glass-card">
          <span className="text-[10px] text-slate-400 block mb-1">সক্রিয় মেম্বার</span>
          <span className="text-sm font-bold text-cyan-300 font-mono">
            {data?.activeReferrals ?? user.activeReferrals} জন
          </span>
        </div>

        <div className="p-3 rounded-2xl glass-card">
          <span className="text-[10px] text-slate-400 block mb-1">রেফারেল আয়</span>
          <span className="text-sm font-bold text-emerald-400">
            ৳{(data?.referralEarnings ?? user.referralEarnings).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Unclaimed Commission Card */}
      {((data?.unclaimedReferralEarnings ?? user.unclaimedReferralEarnings ?? 0) > 0) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-purple-950/30 to-slate-900 border border-emerald-500/30 flex items-center justify-between shadow-lg">
          <div>
            <span className="text-[10px] text-emerald-300 font-semibold block">অব্যবহৃত রেফারেল কমিশন</span>
            <span className="text-base font-extrabold text-emerald-400 font-mono">
              ৳{((data?.unclaimedReferralEarnings ?? user.unclaimedReferralEarnings ?? 0)).toFixed(2)}
            </span>
          </div>
          <button
            onClick={handleClaimEarnings}
            disabled={claiming}
            className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            {claiming ? (
              <span>প্রসেস হচ্ছে...</span>
            ) : (
              <>
                <Gift className="w-3.5 h-3.5" />
                <span>ব্যালেন্সে নিন</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* 4. Referral History */}
      <div className="p-4 rounded-2xl glass-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-purple-400" />
            রেফারেল ইতিহাস
          </h2>
          <span className="text-[10px] text-slate-400">সর্বশেষ জয়েন</span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">লোড হচ্ছে...</div>
        ) : !data?.history || data.history.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs">এখনও কোনো রেফারেল নেই।</p>
            <p className="text-[11px] text-slate-500">আপনার লিংক শেয়ার করে বন্ধুদের আমন্ত্রণ জানান।</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {data.history.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-indigo-500/30 border border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-300">
                    {item.firstName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">{item.firstName}</h4>
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.joinedAt).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-400 block">
                    +৳{item.earningsEarned.toFixed(2)}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    সক্রিয়
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Referral Security & Rules */}
      <div className="p-3.5 rounded-2xl glass-card flex items-start gap-2.5 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          নিরাপত্তা নীতি: একই ডিভাইসে একাধিক একাউন্ট বা সেলফ রেফারেল স্বয়ংক্রিয়ভাবে শনাক্ত ও ব্লক করা হয়।
        </p>
      </div>
    </div>
  );
};
