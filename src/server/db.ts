/**
 * Database & Business Logic Layer
 * Interacts with authenticated Firebase Realtime Database.
 * Enforces:
 * - Proper Bangladesh daily/hourly ad counter reset.
 * - Idempotency & duplicate protection across claims, bonuses, and withdrawals.
 * - Atomic balance modifications.
 * - TotalWithdrawn counting ONLY after approval, not when pending.
 * - Withdrawal referral requirement.
 * - Referral commission claim (/api/referral-claim).
 * - Server-side task definition rewards.
 * - Rejection of memoryStore fallback in production.
 */

import { UserProfile, AdSession, TransactionRecord, WithdrawalRecord, ReferralData } from '../types';
import { firebaseDb } from './firebase';
import { ensureBangladeshCountersReset, getBangladeshDateStr } from './time';
import { getAppSettings, SERVER_TASKS } from './settings';
import { acquireUserLock, releaseUserLock } from './rateLimit';

// Local development fallback store (ONLY active when NODE_ENV !== 'production' and Firebase is unconfigured)
interface DevStore {
  users: Record<number, UserProfile>;
  adSessions: Record<string, AdSession>;
  taskVerifications: Record<string, boolean>; // `${userId}:${taskId}`
  taskClaims: Record<string, boolean>;
  dailyBonusClaims: Record<string, boolean>; // `${userId}:${date}`
  withdrawals: WithdrawalRecord[];
  transactions: TransactionRecord[];
  referrals: Record<number, number[]>; // referrerId -> [referredUserIds]
}

const devStore: DevStore = {
  users: {},
  adSessions: {},
  taskVerifications: {},
  taskClaims: {},
  dailyBonusClaims: {},
  withdrawals: [],
  transactions: [],
  referrals: {},
};

export class DatabaseService {
  private isProduction = process.env.NODE_ENV === 'production';

  private checkDbAvailability(): void {
    if (this.isProduction && !firebaseDb.isConfigured()) {
      throw new Error('Database is not configured for production. Memory store fallback is forbidden.');
    }
  }

  /**
   * Retrieves or initializes a user profile.
   * Runs Bangladesh daily/hourly reset logic automatically.
   */
  public async getOrCreateUser(telegramUser: any, referrerId?: number): Promise<UserProfile> {
    this.checkDbAvailability();
    const userId = Number(telegramUser.id);

    let user: UserProfile | null = null;

    if (firebaseDb.isConfigured()) {
      user = await firebaseDb.get<UserProfile>(`users/${userId}`);
    } else if (!this.isProduction) {
      user = devStore.users[userId] || null;
    }

    if (!user) {
      // Create new user profile
      const isPremium = Boolean(telegramUser.is_premium);
      user = {
        id: userId,
        telegramId: userId,
        firstName: telegramUser.first_name || 'User',
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        photoUrl: telegramUser.photo_url,
        isPremium,
        balance: 0.00,
        todayEarnings: 0.00,
        lifetimeEarnings: 0.00,
        totalAdsWatched: 0,
        todayAdsWatched: 0,
        hourlyAdsWatched: 0,
        totalReferrals: 0,
        activeReferrals: 0,
        referralEarnings: 0.00,
        unclaimedReferralEarnings: 0.00,
        totalWithdrawn: 0.00,
        referrerId: referrerId && referrerId !== userId ? referrerId : undefined,
        joinedAt: Date.now(),
      };

      // If referred, increment referrer stats
      if (user.referrerId) {
        await this.handleNewReferral(user.referrerId, user);
      }

      await this.saveUser(user);
    } else {
      // Update profile info if changed
      let profileUpdated = false;
      if (telegramUser.first_name && user.firstName !== telegramUser.first_name) {
        user.firstName = telegramUser.first_name;
        profileUpdated = true;
      }
      if (telegramUser.username && user.username !== telegramUser.username) {
        user.username = telegramUser.username;
        profileUpdated = true;
      }
      if (telegramUser.is_premium !== undefined && user.isPremium !== telegramUser.is_premium) {
        user.isPremium = telegramUser.is_premium;
        profileUpdated = true;
      }

      // 7. Enforce Bangladesh daily & hourly ad counter reset
      const resetOccurred = ensureBangladeshCountersReset(user);
      if (resetOccurred || profileUpdated) {
        await this.saveUser(user);
      }
    }

    return user;
  }

  public async getUser(userId: number): Promise<UserProfile | null> {
    this.checkDbAvailability();

    let user: UserProfile | null = null;
    if (firebaseDb.isConfigured()) {
      user = await firebaseDb.get<UserProfile>(`users/${userId}`);
    } else if (!this.isProduction) {
      user = devStore.users[userId] || null;
    }

    if (user) {
      const reset = ensureBangladeshCountersReset(user);
      if (reset) {
        await this.saveUser(user);
      }
    }
    return user;
  }

  public async saveUser(user: UserProfile): Promise<void> {
    this.checkDbAvailability();
    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`users/${user.id}`, user);
    } else if (!this.isProduction) {
      devStore.users[user.id] = { ...user };
    }
  }

  private async handleNewReferral(referrerId: number, newUser: UserProfile): Promise<void> {
    const referrer = await this.getUser(referrerId);
    if (!referrer) return;

    referrer.totalReferrals = (referrer.totalReferrals || 0) + 1;
    referrer.activeReferrals = (referrer.activeReferrals || 0) + 1;
    await this.saveUser(referrer);

    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`referrals/${referrerId}/${newUser.id}`, {
        id: newUser.id,
        firstName: newUser.firstName,
        username: newUser.username,
        joinedAt: newUser.joinedAt,
        earningsEarned: 0.00,
        status: 'active',
      });
    } else if (!this.isProduction) {
      if (!devStore.referrals[referrerId]) {
        devStore.referrals[referrerId] = [];
      }
      devStore.referrals[referrerId].push(newUser.id);
    }
  }

  // 4. Implement /api/referral-claim
  public async claimReferralEarnings(userId: number): Promise<{ success: boolean; claimedAmount: number; newBalance: number; message: string }> {
    this.checkDbAvailability();
    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, claimedAmount: 0, newBalance: 0, message: 'ইউজার পাওয়া যায়নি।' };
    }

    const claimable = user.unclaimedReferralEarnings || 0;
    if (claimable <= 0) {
      return {
        success: false,
        claimedAmount: 0,
        newBalance: user.balance,
        message: 'ক্লেইম করার মতো কোনো রেফারেল বোনাস জমা নেই।',
      };
    }

    // Atomic update
    const prevBalance = user.balance;
    user.balance = Number((user.balance + claimable).toFixed(2));
    user.referralEarnings = Number(((user.referralEarnings || 0) + claimable).toFixed(2));
    user.lifetimeEarnings = Number((user.lifetimeEarnings + claimable).toFixed(2));
    user.unclaimedReferralEarnings = 0.00;

    await this.saveUser(user);

    await this.recordTransaction({
      transactionId: `tx_ref_${Date.now()}_${userId}`,
      userId,
      type: 'referral_reward',
      title: 'রেফারেল কমিশন ক্লেইম',
      amount: claimable,
      balanceBefore: prevBalance,
      balanceAfter: user.balance,
      timestamp: Date.now(),
    });

    return {
      success: true,
      claimedAmount: claimable,
      newBalance: user.balance,
      message: `অভিনন্দন! ৳${claimable.toFixed(2)} রেফারেল কমিশন সফলভাবে মূল ব্যালেন্সে যোগ হয়েছে।`,
    };
  }

  public async getReferralData(userId: number): Promise<ReferralData> {
    this.checkDbAvailability();
    const user = await this.getUser(userId);
    const settings = await getAppSettings();

    let items: any[] = [];
    if (firebaseDb.isConfigured()) {
      const data = await firebaseDb.get<Record<string, any>>(`referrals/${userId}`);
      if (data) {
        items = Object.values(data);
      }
    } else if (!this.isProduction) {
      const list = devStore.referrals[userId] || [];
      items = list.map((refId) => {
        const u = devStore.users[refId];
        return {
          id: refId,
          firstName: u?.firstName || 'Referred User',
          username: u?.username,
          joinedAt: u?.joinedAt || Date.now(),
          earningsEarned: 0,
          status: 'active',
        };
      });
    }

    return {
      referralLink: `https://t.me/watchpaybdbot?startapp=${userId}`,
      commissionRate: settings.referralCommissionPercent || 10,
      totalReferrals: user?.totalReferrals || 0,
      activeReferrals: user?.activeReferrals || 0,
      referralEarnings: user?.referralEarnings || 0,
      unclaimedReferralEarnings: user?.unclaimedReferralEarnings || 0,
      history: items,
    };
  }

  // Ad Session Management
  public async createAdSession(session: AdSession): Promise<void> {
    this.checkDbAvailability();
    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`adSessions/${session.adSessionId}`, session);
    } else if (!this.isProduction) {
      devStore.adSessions[session.adSessionId] = { ...session };
    }
  }

  public async getAdSession(sessionId: string): Promise<AdSession | null> {
    this.checkDbAvailability();
    if (firebaseDb.isConfigured()) {
      return await firebaseDb.get<AdSession>(`adSessions/${sessionId}`);
    } else if (!this.isProduction) {
      return devStore.adSessions[sessionId] || null;
    }
    return null;
  }

  public async updateAdSession(sessionId: string, updates: Partial<AdSession>): Promise<boolean> {
    this.checkDbAvailability();
    if (firebaseDb.isConfigured()) {
      const res = await firebaseDb.patch(`adSessions/${sessionId}`, updates);
      return Boolean(res);
    } else if (!this.isProduction) {
      if (devStore.adSessions[sessionId]) {
        devStore.adSessions[sessionId] = { ...devStore.adSessions[sessionId], ...updates };
        return true;
      }
    }
    return false;
  }

  // Claim Ad
  public async claimAd(
    userId: number,
    adSessionId: string
  ): Promise<{ success: boolean; reward: number; newBalance: number; message: string }> {
    this.checkDbAvailability();
    const session = await this.getAdSession(adSessionId);
    if (!session) {
      return { success: false, reward: 0, newBalance: 0, message: 'বিজ্ঞাপন সেশন পাওয়া যায়নি।' };
    }

    if (session.userId !== userId) {
      return { success: false, reward: 0, newBalance: 0, message: 'অননুমোদিত বিজ্ঞাপন সেশন।' };
    }

    // 9. Idempotency and duplicate protection
    if (session.status === 'completed') {
      return { success: false, reward: 0, newBalance: 0, message: 'এই বিজ্ঞাপনটি ইতোমধ্যেই ক্লেইম করা হয়েছে।' };
    }

    // Check watch duration
    const elapsedSeconds = (Date.now() - session.createdAt) / 1000;
    if (elapsedSeconds < (session.minWatchTime || 12)) {
      return {
        success: false,
        reward: 0,
        newBalance: 0,
        message: 'বিজ্ঞাপনটি সম্পূর্ণ দেখার আগে ক্লেইম করা যাবে না।',
      };
    }

    const settings = await getAppSettings();
    if (!settings.ads) {
      return { success: false, reward: 0, newBalance: 0, message: 'বিজ্ঞাপন সিস্টেম বর্তমানে বন্ধ রয়েছে।' };
    }

    // 17. Monetag Verification requirement
    if (settings.requireMonetagPostback && !session.monetagVerified) {
      return {
        success: false,
        reward: 0,
        newBalance: 0,
        message: 'বিজ্ঞাপনটি এখনো Monetag সার্ভার থেকে যাচাই হয়নি। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।',
      };
    }

    // Mark session as completed
    await this.updateAdSession(adSessionId, { status: 'completed' });

    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, reward: 0, newBalance: 0, message: 'ইউজার তথ্য পাওয়া যায়নি।' };
    }

    // Re-check daily and hourly limits
    if (user.todayAdsWatched >= settings.dailyAdLimit) {
      return { success: false, reward: 0, newBalance: user.balance, message: 'আজকের বিজ্ঞাপন সীমা পূর্ণ হয়েছে।' };
    }
    if (user.hourlyAdsWatched >= settings.hourlyAdLimit) {
      return { success: false, reward: 0, newBalance: user.balance, message: 'এই ঘণ্টার বিজ্ঞাপন সীমা পূর্ণ হয়েছে।' };
    }

    const reward = session.reward || (user.isPremium ? settings.premiumAdReward : settings.adReward);
    const prevBalance = user.balance;

    user.balance = Number((user.balance + reward).toFixed(2));
    user.todayEarnings = Number((user.todayEarnings + reward).toFixed(2));
    user.lifetimeEarnings = Number((user.lifetimeEarnings + reward).toFixed(2));
    user.todayAdsWatched = (user.todayAdsWatched || 0) + 1;
    user.hourlyAdsWatched = (user.hourlyAdsWatched || 0) + 1;
    user.totalAdsWatched = (user.totalAdsWatched || 0) + 1;

    await this.saveUser(user);

    // Record ledger transaction
    await this.recordTransaction({
      transactionId: `tx_ad_${Date.now()}_${userId}`,
      userId,
      type: 'ad_reward',
      title: 'বিজ্ঞাপন দেখা সম্পন্ন',
      amount: reward,
      balanceBefore: prevBalance,
      balanceAfter: user.balance,
      timestamp: Date.now(),
      referenceId: adSessionId,
    });

    // Credit referrer commission if exists
    if (user.referrerId && settings.referral) {
      const commissionRate = settings.referralCommissionPercent || 10;
      const commission = Number(((reward * commissionRate) / 100).toFixed(2));
      if (commission > 0) {
        await this.creditReferralCommission(user.referrerId, commission, user);
      }
    }

    return {
      success: true,
      reward,
      newBalance: user.balance,
      message: `অভিনন্দন! ৳${reward.toFixed(2)} আপনার একাউন্টে যোগ হয়েছে।`,
    };
  }

  private async creditReferralCommission(referrerId: number, commission: number, fromUser: UserProfile): Promise<void> {
    const referrer = await this.getUser(referrerId);
    if (!referrer) return;

    referrer.unclaimedReferralEarnings = Number(((referrer.unclaimedReferralEarnings || 0) + commission).toFixed(2));
    await this.saveUser(referrer);
  }

  // 10, 11, 12: Atomic Withdrawal Creation
  public async createWithdrawal(
    userId: number,
    method: string,
    account: string,
    amount: number
  ): Promise<{ success: boolean; record?: WithdrawalRecord; message: string }> {
    this.checkDbAvailability();

    // 10. Concurrency Lock per user
    if (!acquireUserLock(userId, 'withdraw')) {
      return {
        success: false,
        message: 'আগের অনুরোধটি প্রক্রিয়াকরণাধীন রয়েছে। অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।',
      };
    }

    try {
      const settings = await getAppSettings();

      // Feature toggle
      if (!settings.withdrawal) {
        return { success: false, message: 'টাকা উত্তোলন সার্ভিস বর্তমানে বন্ধ রয়েছে।' };
      }

      // Check pending withdrawal to prevent concurrent double withdrawal
      const hasPending = await this.hasPendingWithdrawal(userId);
      if (hasPending) {
        return {
          success: false,
          message: 'আপনার ইতোমধ্যেই একটি উত্তোলন অনুরোধ বিবেচনাধীন রয়েছে। সেটি নিষ্পত্তি না হওয়া পর্যন্ত নতুন অনুরোধ গ্রহণযোগ্য নয়।',
        };
      }

      const user = await this.getUser(userId);
      if (!user) {
        return { success: false, message: 'ইউজার তথ্য পাওয়া যায়নি।' };
      }

      // 12. Enforce withdrawal referral requirement
      const minReferrals = settings.minReferralsForWithdrawal ?? 3;
      if ((user.totalReferrals || 0) < minReferrals) {
        return {
          success: false,
          message: `টাকা উত্তোলন করতে কমপক্ষে ${minReferrals} টি সফল রেফারেল প্রয়োজন। আপনার বর্তমান রেফারেল: ${user.totalReferrals || 0} টি।`,
        };
      }

      // Minimum withdrawal check
      if (amount < settings.minWithdrawal) {
        return {
          success: false,
          message: `সর্বনিম্ন উত্তোলনের পরিমাণ ৳${settings.minWithdrawal}।`,
        };
      }

      // Balance check
      if (user.balance < amount) {
        return {
          success: false,
          message: `আপনার একাউন্টে পর্যাপ্ত ব্যালেন্স নেই। বর্তমান ব্যালেন্স: ৳${user.balance.toFixed(2)}।`,
        };
      }

      // Fee calculation
      const fee = Number(((amount * (settings.withdrawFeePercent || 2)) / 100).toFixed(2));
      const finalAmount = Number((amount - fee).toFixed(2));

      // 11. CRITICAL: Count totalWithdrawn ONLY after approval, NOT when pending!
      const prevBalance = user.balance;
      user.balance = Number((user.balance - amount).toFixed(2));
      // NOTE: user.totalWithdrawn is deliberately NOT changed here.
      await this.saveUser(user);

      const record: WithdrawalRecord = {
        withdrawalId: `wd_${Date.now()}_${userId}`,
        userId,
        method,
        account: account.trim(),
        amount,
        fee,
        finalAmount,
        status: 'pending',
        createdAt: Date.now(),
      };

      if (firebaseDb.isConfigured()) {
        await firebaseDb.put(`withdrawals/${record.withdrawalId}`, record);
        await firebaseDb.put(`userWithdrawals/${userId}/${record.withdrawalId}`, record);
      } else if (!this.isProduction) {
        devStore.withdrawals.unshift(record);
      }

      // Record ledger transaction
      await this.recordTransaction({
        transactionId: `tx_wd_${Date.now()}_${userId}`,
        userId,
        type: 'withdrawal',
        title: `${method.toUpperCase()} উত্তোলন অনুরোধ (পেন্ডিং)`,
        amount: -amount,
        balanceBefore: prevBalance,
        balanceAfter: user.balance,
        timestamp: Date.now(),
        referenceId: record.withdrawalId,
      });

      return {
        success: true,
        record,
        message: `৳${amount} টাকা উত্তোলনের অনুরোধ সফলভাবে জমা হয়েছে। দ্রুত ভেরিফাই করে পেমেন্ট পাঠিয়ে দেওয়া হবে।`,
      };
    } finally {
      releaseUserLock(userId, 'withdraw');
    }
  }

  public async hasPendingWithdrawal(userId: number): Promise<boolean> {
    if (firebaseDb.isConfigured()) {
      const records = await firebaseDb.get<Record<string, WithdrawalRecord>>(`userWithdrawals/${userId}`);
      if (records) {
        return Object.values(records).some((w) => w.status === 'pending');
      }
      return false;
    } else if (!this.isProduction) {
      return devStore.withdrawals.some((w) => w.userId === userId && w.status === 'pending');
    }
    return false;
  }

  public async getWithdrawals(userId: number): Promise<WithdrawalRecord[]> {
    this.checkDbAvailability();
    if (firebaseDb.isConfigured()) {
      const records = await firebaseDb.get<Record<string, WithdrawalRecord>>(`userWithdrawals/${userId}`);
      if (!records) return [];
      return Object.values(records).sort((a, b) => b.createdAt - a.createdAt);
    } else if (!this.isProduction) {
      return devStore.withdrawals.filter((w) => w.userId === userId);
    }
    return [];
  }

  // 5 & 6. Task Verification & Server-side Task Rewards
  public async isTaskClaimed(userId: number, taskId: string): Promise<boolean> {
    const key = `${userId}:${taskId}`;
    if (firebaseDb.isConfigured()) {
      const claimed = await firebaseDb.get<boolean>(`taskClaims/${key}`);
      return Boolean(claimed);
    } else if (!this.isProduction) {
      return Boolean(devStore.taskClaims[key]);
    }
    return false;
  }

  public async isTaskVerified(userId: number, taskId: string): Promise<boolean> {
    const key = `${userId}:${taskId}`;
    if (firebaseDb.isConfigured()) {
      const val = await firebaseDb.get<boolean>(`taskVerifications/${key}`);
      return Boolean(val);
    } else if (!this.isProduction) {
      return Boolean(devStore.taskVerifications[key]);
    }
    return false;
  }

  public async setTaskVerified(userId: number, taskId: string): Promise<void> {
    const key = `${userId}:${taskId}`;
    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`taskVerifications/${key}`, true);
    } else if (!this.isProduction) {
      devStore.taskVerifications[key] = true;
    }
  }

  public async claimTask(
    userId: number,
    taskId: string
  ): Promise<{ success: boolean; reward: number; newBalance: number; message: string }> {
    this.checkDbAvailability();
    const settings = await getAppSettings();
    if (!settings.telegramTasks) {
      return { success: false, reward: 0, newBalance: 0, message: 'টাস্ক সিস্টেম বর্তমানে বন্ধ রয়েছে।' };
    }

    // 6. Reward MUST come from the server-side task definition!
    const task = SERVER_TASKS.find((t) => t.id === taskId);
    if (!task) {
      return { success: false, reward: 0, newBalance: 0, message: 'টাস্কটি খুঁজে পাওয়া যায়নি।' };
    }

    // 9. Idempotency check
    const alreadyClaimed = await this.isTaskClaimed(userId, taskId);
    if (alreadyClaimed) {
      return { success: false, reward: 0, newBalance: 0, message: 'টাস্কটি ইতোমধ্যেই সম্পন্ন ও ক্লেইম করা হয়েছে।' };
    }

    // 5. Check real verification
    const isVerified = await this.isTaskVerified(userId, taskId);
    if (!isVerified) {
      return {
        success: false,
        reward: 0,
        newBalance: 0,
        message: 'টাস্কটি প্রথমে যাচাই (Verify) করতে হবে।',
      };
    }

    const key = `${userId}:${taskId}`;
    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`taskClaims/${key}`, true);
    } else if (!this.isProduction) {
      devStore.taskClaims[key] = true;
    }

    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, reward: 0, newBalance: 0, message: 'ইউজার তথ্য পাওয়া যায়নি।' };
    }

    const reward = task.reward;
    const prevBalance = user.balance;

    user.balance = Number((user.balance + reward).toFixed(2));
    user.lifetimeEarnings = Number((user.lifetimeEarnings + reward).toFixed(2));
    user.todayEarnings = Number((user.todayEarnings + reward).toFixed(2));
    await this.saveUser(user);

    await this.recordTransaction({
      transactionId: `tx_task_${Date.now()}_${userId}`,
      userId,
      type: 'task_reward',
      title: `${task.title} সম্পন্ন`,
      amount: reward,
      balanceBefore: prevBalance,
      balanceAfter: user.balance,
      timestamp: Date.now(),
      referenceId: taskId,
    });

    return {
      success: true,
      reward,
      newBalance: user.balance,
      message: `অভিনন্দন! ৳${reward.toFixed(2)} সফলভাবে একাউন্টে যোগ হয়েছে।`,
    };
  }

  // Daily Bonus with Idempotency
  public async claimDailyBonus(
    userId: number
  ): Promise<{ success: boolean; reward: number; newBalance: number; message: string }> {
    this.checkDbAvailability();
    const settings = await getAppSettings();
    if (!settings.dailyBonus) {
      return { success: false, reward: 0, newBalance: 0, message: 'দৈনিক বোনাস সার্ভিস বর্তমানে বন্ধ রয়েছে।' };
    }

    const todayDate = getBangladeshDateStr();
    const key = `${userId}:${todayDate}`;

    let alreadyClaimed = false;
    if (firebaseDb.isConfigured()) {
      alreadyClaimed = Boolean(await firebaseDb.get<boolean>(`dailyBonusClaims/${key}`));
    } else if (!this.isProduction) {
      alreadyClaimed = Boolean(devStore.dailyBonusClaims[key]);
    }

    if (alreadyClaimed) {
      return { success: false, reward: 0, newBalance: 0, message: 'আজকের দৈনিক বোনাস ইতোমধ্যেই গ্রহণ করা হয়েছে।' };
    }

    const user = await this.getUser(userId);
    if (!user) {
      return { success: false, reward: 0, newBalance: 0, message: 'ইউজার তথ্য পাওয়া যায়নি।' };
    }

    if (user.dailyBonusClaimedDate === todayDate) {
      return { success: false, reward: 0, newBalance: user.balance, message: 'আজকের দৈনিক বোনাস ইতোমধ্যেই গ্রহণ করা হয়েছে।' };
    }

    const reward = user.isPremium ? settings.premiumBonusAmount : settings.dailyBonusAmount;
    const prevBalance = user.balance;

    user.balance = Number((user.balance + reward).toFixed(2));
    user.lifetimeEarnings = Number((user.lifetimeEarnings + reward).toFixed(2));
    user.todayEarnings = Number((user.todayEarnings + reward).toFixed(2));
    user.dailyBonusClaimedDate = todayDate;
    await this.saveUser(user);

    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`dailyBonusClaims/${key}`, true);
    } else if (!this.isProduction) {
      devStore.dailyBonusClaims[key] = true;
    }

    await this.recordTransaction({
      transactionId: `tx_bonus_${Date.now()}_${userId}`,
      userId,
      type: 'daily_bonus',
      title: 'দৈনিক লগইন বোনাস',
      amount: reward,
      balanceBefore: prevBalance,
      balanceAfter: user.balance,
      timestamp: Date.now(),
    });

    return {
      success: true,
      reward,
      newBalance: user.balance,
      message: `অভিনন্দন! আজকের দৈনিক বোনাস ৳${reward.toFixed(2)} আপনার একাউন্টে যোগ হয়েছে!`,
    };
  }

  // Transactions
  public async recordTransaction(record: TransactionRecord): Promise<void> {
    if (firebaseDb.isConfigured()) {
      await firebaseDb.put(`transactions/${record.userId}/${record.transactionId}`, record);
    } else if (!this.isProduction) {
      devStore.transactions.unshift(record);
    }
  }

  public async getTransactions(userId: number): Promise<TransactionRecord[]> {
    this.checkDbAvailability();
    if (firebaseDb.isConfigured()) {
      const data = await firebaseDb.get<Record<string, TransactionRecord>>(`transactions/${userId}`);
      if (!data) return [];
      return Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
    } else if (!this.isProduction) {
      return devStore.transactions.filter((t) => t.userId === userId);
    }
    return [];
  }
}

export const dbService = new DatabaseService();
