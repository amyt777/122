export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface UserProfile {
  id: number;
  telegramId: number;
  firstName: string;
  lastName?: string;
  username?: string;
  photoUrl?: string;
  isPremium: boolean;
  balance: number;
  todayEarnings: number;
  lifetimeEarnings: number;
  totalAdsWatched: number;
  todayAdsWatched: number;
  hourlyAdsWatched: number;
  totalReferrals: number;
  activeReferrals: number;
  referralEarnings: number;
  unclaimedReferralEarnings?: number;
  totalWithdrawn: number;
  referrerId?: number;
  joinedAt: number;
  dailyBonusClaimedDate?: string;
}

export interface AppSettings {
  ads: boolean;
  telegramTasks: boolean;
  referral: boolean;
  withdrawal: boolean;
  dailyBonus: boolean;
  premiumBonus: boolean;
  botProtection: boolean;
  notice: {
    show: boolean;
    text: string;
  };
  dailyAdLimit: number;
  hourlyAdLimit: number;
  adReward: number;
  premiumAdReward: number;
  dailyBonusAmount: number;
  premiumBonusAmount: number;
  minWithdrawal: number;
  withdrawFeePercent: number;
  referralCommissionPercent: number;
  minReferralsForWithdrawal?: number;
  requireMonetagPostback?: boolean;
  monetagZoneId: string;
}

export interface AdSession {
  adSessionId: string;
  userId: number;
  zoneId: string;
  createdAt: number;
  expiresAt: number;
  status: 'created' | 'completed' | 'expired' | 'rejected';
  minWatchTime: number;
  reward: number;
  monetagVerified?: boolean;
}

export interface TelegramTask {
  id: string;
  title: string;
  description: string;
  reward: number;
  type: 'channel' | 'group' | 'bot';
  link: string;
  chatId?: string;
  status: 'not_started' | 'joined' | 'verified' | 'completed';
}

export interface ReferralItem {
  id: number;
  firstName: string;
  username?: string;
  joinedAt: number;
  earningsEarned: number;
  status: 'active' | 'inactive';
}

export interface ReferralData {
  referralLink: string;
  commissionRate: number;
  totalReferrals: number;
  activeReferrals: number;
  referralEarnings: number;
  unclaimedReferralEarnings?: number;
  history: ReferralItem[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  logo: string;
  minAmount: number;
  feePercent: number;
  placeholder: string;
  instructions: string;
  accountTypeLabel: string;
}

export interface WithdrawalRecord {
  withdrawalId: string;
  userId: number;
  method: string;
  account: string;
  amount: number;
  fee: number;
  finalAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  processedAt?: number;
  rejectionReason?: string;
}

export interface TransactionRecord {
  transactionId: string;
  userId: number;
  type: 'ad_reward' | 'referral_reward' | 'daily_bonus' | 'task_reward' | 'withdrawal' | 'withdrawal_refund' | 'manual_credit' | 'manual_debit';
  title: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: number;
  referenceId?: string;
}

export type TabType = 'home' | 'ads' | 'tasks' | 'referrals' | 'withdraw' | 'profile';
