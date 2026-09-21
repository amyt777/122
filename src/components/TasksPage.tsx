import React, { useState, useEffect } from 'react';
import { TelegramTask, UserProfile } from '../types';
import { api } from '../api';
import { 
  CheckSquare, Send, CheckCircle2, ExternalLink, ShieldCheck, 
  Sparkles, RefreshCw, AlertCircle, Clock 
} from 'lucide-react';

interface TasksPageProps {
  user: UserProfile;
  onRefreshUser: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({
  user,
  onRefreshUser,
  showToast,
}) => {
  const [tasks, setTasks] = useState<TelegramTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err: any) {
      showToast(err.message || 'টাস্ক লোড করা যায়নি।', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleJoin = (task: TelegramTask) => {
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(task.link);
    } else {
      window.open(task.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleVerify = async (task: TelegramTask) => {
    setVerifyingId(task.id);
    try {
      const res = await api.verifyTask(task.id);
      if (res.verified) {
        setVerifiedMap((prev) => ({ ...prev, [task.id]: true }));
        showToast('যাচাই সফল হয়েছে! এবার রিওয়ার্ড ক্লেইম করুন।', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'টাস্ক যাচাই করা যায়নি। অনুগ্রহ করে চ্যানেলে জয়েন করুন।', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleClaim = async (task: TelegramTask) => {
    setClaimingId(task.id);
    try {
      const res = await api.claimTask(task.id);
      showToast(`অভিনন্দন! +৳${res.reward.toFixed(2)} রিওয়ার্ড পেয়েছেন!`, 'success');

      // Update state locally and reload
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: 'completed' } : t))
      );
      setVerifiedMap((prev) => ({ ...prev, [task.id]: false }));

      await onRefreshUser();
    } catch (err: any) {
      showToast(err.message || 'রিওয়ার্ড ক্লেইম করা যায়নি।', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* 1. Header Card */}
      <div className="relative overflow-hidden p-5 rounded-3xl glass-card-glow text-white">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                <CheckSquare className="w-5 h-5" />
              </span>
              <h1 className="text-sm font-bold text-slate-100">টেলিগ্রাম টাস্ক</h1>
            </div>
            <p className="text-xs text-purple-200/80">
              অফিসিয়াল টেলিগ্রাম চ্যানেল ও গ্রুপে জয়েন করে রিওয়ার্ড পান
            </p>
          </div>

          <button
            onClick={loadTasks}
            disabled={loading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Tasks List */}
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">টাস্ক লোড হচ্ছে...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-8 text-center rounded-3xl glass-card text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs">বর্তমানে কোনো নতুন টাস্ক নেই।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isVerified = verifiedMap[task.id];
            const isVerifyingCurrent = verifyingId === task.id;
            const isClaimingCurrent = claimingId === task.id;

            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl glass-card transition-all space-y-3 border ${
                  isCompleted
                    ? 'border-emerald-500/20 bg-emerald-950/10'
                    : 'border-white/10 hover:border-purple-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 mt-0.5 shrink-0">
                      <Send className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-100 leading-snug">
                        {task.title}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {task.description}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    +৳{task.reward.toFixed(2)}
                  </span>
                </div>

                {/* Task Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  {isCompleted ? (
                    <div className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>টাস্ক সম্পন্ন হয়েছে</span>
                    </div>
                  ) : isVerified ? (
                    <button
                      onClick={() => handleClaim(task)}
                      disabled={isClaimingCurrent}
                      className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-500/25 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                    >
                      {isClaimingCurrent ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          <span>ক্লেইম হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>রিওয়ার্ড ক্লেইম করুন (+৳{task.reward.toFixed(2)})</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <button
                        onClick={() => handleJoin(task)}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-purple-300" />
                        <span>JOIN</span>
                      </button>

                      <button
                        onClick={() => handleVerify(task)}
                        disabled={isVerifyingCurrent}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold shadow-md shadow-purple-600/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                      >
                        {isVerifyingCurrent ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>যাচাই হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5 text-purple-200" />
                            <span>VERIFY</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
