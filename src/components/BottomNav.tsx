import React from 'react';
import { TabType } from '../types';
import { Home, PlayCircle, CheckSquare, Users, Wallet, User } from 'lucide-react';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  adsCountBadge?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab, adsCountBadge }) => {
  const tabs = [
    { id: 'home' as TabType, label: 'হোম', icon: Home },
    { id: 'ads' as TabType, label: 'বিজ্ঞাপন', icon: PlayCircle, badge: adsCountBadge },
    { id: 'tasks' as TabType, label: 'টাস্ক', icon: CheckSquare },
    { id: 'referrals' as TabType, label: 'রেফার', icon: Users },
    { id: 'withdraw' as TabType, label: 'উত্তোলন', icon: Wallet },
    { id: 'profile' as TabType, label: 'প্রোফাইল', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center w-full pointer-events-none pb-safe">
      <div className="w-full max-w-[480px] bg-[#0b0f1d]/90 backdrop-blur-xl border-t border-purple-500/20 px-2 py-2 pointer-events-auto shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-6 items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onChangeTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-purple-400 font-semibold scale-105'
                    : 'text-slate-400 hover:text-slate-200 active:scale-95'
                }`}
              >
                {/* Active Glow indicator */}
                {isActive && (
                  <span className="absolute -top-2 w-8 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_10px_#a855f7]"></span>
                )}

                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'
                    }`}
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 bg-gradient-to-r from-rose-500 to-purple-600 text-[9px] font-bold text-white px-1 py-0.2 rounded-full min-w-3.5 text-center leading-none shadow-sm">
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span className="text-[10px] mt-1 tracking-tight leading-tight">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
