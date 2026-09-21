import React, { useState, useEffect } from 'react';
import { UserProfile, AppSettings, PaymentMethod, WithdrawalRecord } from '../types';
import { api } from '../api';
import { 
  Wallet, ArrowUpRight, History, CheckCircle2, Clock, 
  XCircle, AlertCircle, ShieldCheck, ChevronRight, RefreshCw,
  CreditCard
} from 'lucide-react';

interface WithdrawPageProps {
  user: UserProfile;
  settings: AppSettings;
  onRefreshUser: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const WithdrawPage: React.FC<WithdrawPageProps> = ({
  user,
  settings,
  onRefreshUser,
  showToast,
}) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Load payment methods & withdrawal history
  const loadData = async () => {
    setLoadingHistory(true);
    try {
      const [methodsData, historyData] = await Promise.all([
        api.getWithdrawMethods(),
        api.getWithdrawals(),
      ]);
      setMethods(methodsData);
      if (methodsData.length > 0 && !selectedMethod) {
        setSelectedMethod(methodsData[0]);
      }
      setWithdrawals(historyData);
    } catch (err: any) {
      showToast(err.message || 'উত্তোলন তথ্য লোড করা যায়নি।', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Numerical amount calculation
  const amount = parseFloat(amountStr) || 0;
  const minWithdraw = selectedMethod?.minAmount ?? settings.minWithdrawal ?? 50;
  const feePercent = selectedMethod?.feePercent ?? settings.withdrawFeePercent ?? 2;
  const fee = Number(((amount * feePercent) / 100).toFixed(2));
  const finalReceivingAmount = Math.max(0, Number((amount - fee).toFixed(2)));

  const handleQuickAmount = (val: number) => {
    setAmountStr(val.toString());
  };

  const handleMaxAmount = () => {
    setAmountStr(Math.floor(user.balance).toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedMethod) {
      showToast('পেমেন্ট মাধ্যম সিলেক্ট করুন।', 'error');
      return;
    }

    if (!accountNumber || accountNumber.trim().length < 6) {
      showToast('সঠিক ওয়ালেট বা একাউন্ট নম্বর প্রদান করুন।', 'error');
      return;
    }

    if (amount <= 0 || isNaN(amount)) {
      showToast('উত্তোলনের সঠিক পরিমাণ লিখুন।', 'error');
      return;
    }

    if (amount < minWithdraw) {
      showToast(`সর্বনিম্ন উত্তোলনের পরিমাণ ৳${minWithdraw.toFixed(2)} টাকা।`, 'error');
      return;
    }

    if (amount > user.balance) {
      showToast('আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই।', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createWithdrawal({
        method: selectedMethod.name,
        account: accountNumber.trim(),
        amount,
      });

      showToast('উত্তোলন অনুরোধ সফলভাবে গৃহীত হয়েছে!', 'success');
      setAmountStr('');
      setAccountNumber('');

      // Refresh real balance & history
      await onRefreshUser();
      await loadData();
    } catch (err: any) {
      showToast(err.message || 'উত্তোলন প্রক্রিয়াকরণ ব্যর্থ হয়েছে।', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter withdrawal history
  const filteredWithdrawals = withdrawals.filter((item) => {
    if (activeHistoryTab === 'all') return true;
    return item.status === activeHistoryTab;
  });

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Balance Overview Card */}
      <div className="relative overflow-hidden p-5 rounded-3xl glass-card-glow text-white">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-purple-200/80 font-medium">উত্তোলনযোগ্য ব্যালেন্স</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-purple-400">৳</span>
              <h2 className="text-3xl font-extrabold text-white">
                {user.balance.toFixed(2)}
              </h2>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Withdrawal Request Form */}
      <div className="p-5 rounded-3xl glass-card space-y-4">
        <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          টাকা উত্তোলন করুন
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Payment Method Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              পেমেন্ট মাধ্যম সিলেক্ট করুন
            </label>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((method) => {
                const isSelected = selectedMethod?.id === method.id;
                return (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setSelectedMethod(method)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/20 shadow-md shadow-purple-500/20'
                        : 'border-white/10 bg-slate-900/40 hover:border-white/20'
                    }`}
                  >
                    <span className="text-xs font-bold text-white block">
                      {method.name}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      মিনিমাম: ৳{method.minAmount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Number Field */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              {selectedMethod?.accountTypeLabel || 'একাউন্ট নম্বর'}
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={selectedMethod?.placeholder || '017XXXXXXXX'}
              className="w-full py-3 px-4 rounded-xl bg-slate-900/80 border border-white/10 focus:border-purple-500 text-sm text-white placeholder-slate-500 outline-none transition-colors"
            />
            {selectedMethod?.instructions && (
              <p className="text-[10px] text-slate-400 mt-1">
                {selectedMethod.instructions}
              </p>
            )}
          </div>

          {/* Amount Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                উত্তোলনের পরিমাণ (টাকা)
              </label>
              <span className="text-[11px] text-slate-400">
                মিনিমাম: ৳{minWithdraw.toFixed(2)}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                ৳
              </span>
              <input
                type="number"
                step="any"
                required
                min={minWithdraw}
                max={user.balance}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder={`${minWithdraw}`}
                className="w-full py-3 pl-8 pr-4 rounded-xl bg-slate-900/80 border border-white/10 focus:border-purple-500 text-sm text-white placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1">
              {[50, 100, 200, 500].map((val) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => handleQuickAmount(val)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors border border-white/5 shrink-0"
                >
                  ৳{val}
                </button>
              ))}
              <button
                type="button"
                onClick={handleMaxAmount}
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-[11px] font-bold transition-colors border border-purple-500/30 shrink-0"
              >
                সব ব্যালেন্স
              </button>
            </div>
          </div>

          {/* Financial Breakdown Receipt */}
          {amount > 0 && (
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>উত্তোলনের পরিমাণ:</span>
                <span className="text-slate-200 font-mono">৳{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>সার্ভিস ফি ({feePercent}%):</span>
                <span className="text-rose-400 font-mono">-৳{fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-white/5 font-bold">
                <span className="text-purple-200">আপনি পাবেন (Final):</span>
                <span className="text-emerald-400 font-mono text-sm">
                  ৳{finalReceivingAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || user.balance < minWithdraw}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wide shadow-lg flex items-center justify-center gap-2 transition-all ${
              user.balance < minWithdraw
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : isSubmitting
                ? 'bg-purple-700 text-white cursor-wait'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white hover:brightness-110 active:scale-[0.98] shadow-purple-600/30'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>অনুরোধ পাঠানো হচ্ছে...</span>
              </>
            ) : user.balance < minWithdraw ? (
              <span>পর্যাপ্ত ব্যালেন্স নেই (মিনিমাম ৳{minWithdraw})</span>
            ) : (
              <>
                <ArrowUpRight className="w-4 h-4" />
                <span>উত্তোলন অনুরোধ পাঠান</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* 3. Withdrawal History */}
      <div className="p-4 rounded-3xl glass-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
            <History className="w-4 h-4 text-purple-400" />
            উত্তোলন হিস্ট্রি
          </h2>

          <button
            onClick={loadData}
            disabled={loadingHistory}
            className="p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/80 border border-white/5 text-[11px]">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveHistoryTab(tab)}
              className={`flex-1 py-1.5 rounded-lg font-semibold transition-all ${
                activeHistoryTab === tab
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'all'
                ? 'সব'
                : tab === 'pending'
                ? 'পেন্ডিং'
                : tab === 'approved'
                ? 'সফল'
                : 'বাতিল'}
            </button>
          ))}
        </div>

        {/* Records list */}
        {loadingHistory ? (
          <div className="py-8 text-center text-xs text-slate-400">হিস্ট্রি লোড হচ্ছে...</div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="py-8 text-center text-slate-400 space-y-1">
            <History className="w-6 h-6 text-slate-600 mx-auto" />
            <p className="text-xs">কোনো উত্তোলনের রেকর্ড পাওয়া যায়নি।</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredWithdrawals.map((record) => {
              const isApproved = record.status === 'approved';
              const isPending = record.status === 'pending';
              const isRejected = record.status === 'rejected';

              return (
                <div key={record.withdrawalId} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-300">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-100">{record.method}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {record.account}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-white font-mono">
                        ৳{record.amount.toFixed(2)}
                      </span>
                      <div className="mt-0.5">
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            সফল
                          </span>
                        )}
                        {isPending && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Clock className="w-2.5 h-2.5" />
                            পেন্ডিং
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <XCircle className="w-2.5 h-2.5" />
                            বাতিল
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
                    <span>ID: {record.withdrawalId}</span>
                    <span>{new Date(record.createdAt).toLocaleString('bn-BD')}</span>
                  </div>

                  {record.rejectionReason && (
                    <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-500/20 text-[10px] text-rose-300">
                      বাতিলের কারণ: {record.rejectionReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
