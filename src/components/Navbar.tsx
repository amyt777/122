import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Copy, Check, Star, ShieldCheck, Wifi } from 'lucide-react';

interface NavbarProps {
  user: UserProfile | null;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenProfile }) => {
  const [copied, setCopied] = useState(false);

  const copyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    navigator.clipboard.writeText(user.telegramId.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#070b14]/80 backdrop-blur-md border-b border-white/10 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: User Avatar & Info */}
        <div 
          onClick={onOpenProfile}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="relative">
            <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-purple-500/40 p-0.5 bg-gradient-to-tr from-purple-600 to-indigo-600 group-hover:border-purple-400 transition-colors shadow-lg shadow-purple-950/40">
              {user?.photoUrl ? (
                <img 
                  src={user.photoUrl} 
                  alt={user.firstName} 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 rounded-full flex items-center justify-center font-bold text-white text-base">
                  {user?.firstName ? user.firstName.charAt(0).toUpperCase() : 'W'}
                </div>
              )}
            </div>
            {/* Status dot */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#070b14] rounded-full"></span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-sm tracking-tight group-hover:text-purple-300 transition-colors">
                {user?.firstName || 'লোড হচ্ছে...'}
              </span>
              {user?.isPremium && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-amber-500/20 to-purple-500/20 text-amber-300 border border-amber-500/30">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  Premium
                </span>
              )}
            </div>

            <button
              onClick={copyId}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors font-mono"
            >
              <span>ID: {user?.telegramId || '...'}</span>
              {copied ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500" />
              )}
              {copied && <span className="text-[10px] text-emerald-400 font-sans">কপি হয়েছে</span>}
            </button>
          </div>
        </div>

        {/* Right: Badge / WatchPay Brand */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-purple-300 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-bold text-xs tracking-wider">WATCHPAY</span>
          </div>
        </div>
      </div>
    </header>
  );
};
