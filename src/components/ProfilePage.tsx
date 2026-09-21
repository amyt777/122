import React, { useState, useEffect } from 'react';
import { UserProfile, TransactionRecord, AppSettings } from '../types';
import { api } from '../api';
import { 
  User, Star, Award, TrendingUp, Wallet, ShieldCheck, 
  ArrowUpRight, ArrowDownLeft, Gift, Tv, CheckSquare, Users, 
  RefreshCw, Copy, Check, Clock 
} from 'lucide-react';

interface ProfilePageProps {
  user: UserProfile;
  settings: AppSettings;
  onRefreshUser: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  settings,
  onRefreshUser,
  showToast,
}) => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'earnings' | 'withdrawals'>('all');
  const [copiedId, setCopiedId] = useState(false);

  const loadTransactions = async () => {
    setLoadingTx(true);
    try {
      const data = await api.getTransactions();
      setTransactions(data);
    } catch (err: any) {
      showToast(err.message || 'ট্রানজেকশন লোড করা যায়নি।', 'error');
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.telegramId.toString());
    setCopiedId(true);
    showToast('টেলিগ্রাম আইডি কপি হয়েছে', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (activeFilter === 'earnings') return tx.amount > 0;
    if (activeFilter === 'withdrawals') return tx.amount < 0;
    return true;
  });

  const getTxIcon = (type: TransactionRecord['type']) => {
    switch (type) {
      case 'ad_reward':
        return <Tv className="w-4 h-4 text-purple-400" />;
      case 'daily_bonus':
        return <Gift className="w-4 h-4 text-amber-400" />;
      case 'referral_reward':
        return <Users className="w-4 h-4 text-cyan-400" />;
      case 'task_reward':
        return <CheckSquare className="w-4 h-4 text-emerald-400" />;
      case 'withdrawal':
        return <ArrowUpRight className="w-4 h-4 text-rose-400" />;
      default:
        return <Wallet className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. User Header Identity Card */}
      <div className="relative overflow-hidden p-6 rounded-3xl glass-card-glow text-white text-center space-y-3">
        {/* Background decorative ring */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Profile Avatar */}
        <div className="relative w-20 h-20 mx-auto rounded-full p-1 bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-400 shadow-xl shadow-purple-950/50">
          {user.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.firstName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              {user.firstName.charAt(0).toUpperCase()}
            </div>
          )}
          {user.isPremium && (
            <span className="absolute bottom-0 right-0 p-1 rounded-full bg-amber-500 text-slate-950 shadow-md">
              <Star className="w-3.5 h-3.5 fill-current" />
            </span>
          )}
        </div>

        <div>
          <h2 className="text-base font-bold text-white flex items-center justify-center gap-1.5">
            <span>{user.firstName} {user.lastName || ''}</span>
            {user.username && (
              <span className="text-xs font-normal text-purple-300">(@{user.username})</span>
            )}
          </h2>

          <div className="flex items-center justify-center gap-2 mt-1">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-900/60 px-2.5 py-0.5 rounded-full border border-white/5 hover:text-slate-200 transition-colors"
            >
              <span>ID: {user.telegramId}</span>
              {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>

            {user.isPremium ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                Telegram Premium
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                সাধারণ ইউজার
              </span>
            )}
          </div>
        </div>

        {/* Security badge */}
        <div className="pt-2 flex items-center justify-center gap-1 text-[10px] text-purple-300/80">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>টেলিগ্রাম ভেরিফাইড সিকিউর সেশন</span>
        </div>
      </div>

      {/* 2. Detailed Statistics Grid */}
      <div className="p-4 rounded-3xl glass-card space-y-3">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          আর্থিক ও একাউন্ট পরিসংখ্যান
        </h3>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">মোট আজীবন আয়</span>
            <span className="text-sm font-bold text-purple-300">
              ৳{user.lifetimeEarnings.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">আজকের আয়</span>
            <span className="text-sm font-bold text-emerald-400">
              +৳{user.todayEarnings.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">মোট দেখা বিজ্ঞাপন</span>
            <span className="text-sm font-bold text-cyan-300 font-mono">
              {user.totalAdsWatched} টি
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">রেফারেল সংখ্যা</span>
            <span className="text-sm font-bold text-indigo-300 font-mono">
              {user.totalReferrals} জন
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">রেফারেল থেকে আয়</span>
            <span className="text-sm font-bold text-amber-300">
              ৳{user.referralEarnings.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">মোট সফল উত্তোলন</span>
            <span className="text-sm font-bold text-rose-400">
              ৳{user.totalWithdrawn.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Transaction History */}
      <div className="p-4 rounded-3xl glass-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-purple-400" />
            লেনদেন হিস্ট্রি (Transactions)
          </h3>

          <button
            onClick={loadTransactions}
            disabled={loadingTx}
            className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingTx ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/5 text-[11px]">
          {(['all', 'earnings', 'withdrawals'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`flex-1 py-1 rounded-lg font-semibold transition-all ${
                activeFilter === filter
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'all'
                ? 'সকল লেনদেন'
                : filter === 'earnings'
                ? 'আয় (+৳)'
                : 'উত্তোলন (-৳)'}
            </button>
          ))}
        </div>

        {/* Transactions List */}
        {loadingTx ? (
          <div className="py-8 text-center text-xs text-slate-400">লেনদেন লোড হচ্ছে...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <Clock className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-xs">কোনো লেনদেনের রেকর্ড পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredTransactions.map((tx) => {
              const isPositive = tx.amount > 0;

              return (
                <div key={tx.transactionId} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-white/5">
                      {getTxIcon(tx.type)}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">{tx.title}</h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        <span>{new Date(tx.timestamp).toLocaleString('bn-BD')}</span>
                        {tx.referenceId && (
                          <span className="font-mono text-slate-500">
                            • {tx.referenceId.slice(0, 10)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xs font-extrabold font-mono ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isPositive ? `+৳${tx.amount.toFixed(2)}` : `-৳${Math.abs(tx.amount).toFixed(2)}`}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      ব্যালেন্স: ৳{tx.balanceAfter.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
