/**
 * Central Server-Side Settings, Task Catalog, and Feature Gate Enforcers
 * Single source of truth across all endpoints.
 */

import { AppSettings, PaymentMethod, TelegramTask } from '../types';
import { firebaseDb } from './firebase';

export const DEFAULT_SETTINGS: AppSettings = {
  ads: true,
  telegramTasks: true,
  referral: true,
  withdrawal: true,
  dailyBonus: true,
  premiumBonus: true,
  botProtection: true,
  notice: {
    show: true,
    text: 'স্বাগতম WatchPay-তে! বিজ্ঞাপন দেখুন, টাস্ক সম্পন্ন করুন এবং ইনস্ট্যান্ট বিকাশ বা নগদে পেমেন্ট নিন।',
  },
  dailyAdLimit: 50,
  hourlyAdLimit: 10,
  adReward: 0.50,
  premiumAdReward: 1.00,
  dailyBonusAmount: 1.00,
  premiumBonusAmount: 2.50,
  minWithdrawal: 50,
  withdrawFeePercent: 2,
  referralCommissionPercent: 10,
  minReferralsForWithdrawal: 3,
  requireMonetagPostback: false, // Can be set true via settings or MONETAG_SECRET
  monetagZoneId: process.env.MONETAG_ZONE_ID || '892341',
};

export const SERVER_TASKS: TelegramTask[] = [
  {
    id: 'task_1',
    title: 'WatchPay অফিসিয়াল টেলিগ্রাম চ্যানেল',
    description: 'আমাদের টেলিগ্রাম চ্যানেলে জয়েন করে সর্বশেষ আপডেট ও নোটিশ পান।',
    reward: 5.00,
    type: 'channel',
    link: 'https://t.me/watchpaybd',
    chatId: '@watchpaybd',
    status: 'not_started',
  },
  {
    id: 'task_2',
    title: 'WatchPay কমিউনিটি গ্রুপ',
    description: 'কমিউনিটি গ্রুপে যুক্ত হয়ে অন্যান্য মেম্বারদের সাথে আলোচনা করুন।',
    reward: 3.00,
    type: 'group',
    link: 'https://t.me/watchpaybd_chat',
    chatId: '@watchpaybd_chat',
    status: 'not_started',
  },
  {
    id: 'task_3',
    title: 'পেমেন্ট প্রুফ চ্যানেল',
    description: 'WatchPay-র সকল সফল পেমেন্ট প্রুফ এবং ট্রানজেকশন আইডি দেখুন।',
    reward: 4.00,
    type: 'channel',
    link: 'https://t.me/watchpay_proofs',
    chatId: '@watchpay_proofs',
    status: 'not_started',
  },
  {
    id: 'task_4',
    title: 'পার্টনার স্পন্সর চ্যানেল',
    description: 'আমাদের স্পন্সর চ্যানেলে যুক্ত হয়ে অতিরিক্ত রিওয়ার্ড নিশ্চিত করুন।',
    reward: 3.50,
    type: 'channel',
    link: 'https://t.me/watchpay_sponsors',
    chatId: '@watchpay_sponsors',
    status: 'not_started',
  },
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'bkash',
    name: 'bKash (বিকাশ)',
    logo: 'https://images.unsplash.com/photo-1556742049-0a67c5574f73?w=100&auto=format&fit=crop&q=60',
    minAmount: 50,
    feePercent: 2,
    placeholder: '01XXXXXXXXX',
    instructions: 'আপনার ১১ ডিজিটের পার্সোনাল বিকাশ একাউন্ট নাম্বারটি সঠিকভাবে প্রদান করুন। ২৪ ঘণ্টার মধ্যে পেমেন্ট পাঠিয়ে দেওয়া হবে।',
    accountTypeLabel: 'বিকাশ পার্সোনাল নাম্বার',
  },
  {
    id: 'nagad',
    name: 'Nagad (নগদ)',
    logo: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=100&auto=format&fit=crop&q=60',
    minAmount: 50,
    feePercent: 2,
    placeholder: '01XXXXXXXXX',
    instructions: 'আপনার ১১ ডিজিটের পার্সোনাল নগদ নাম্বারটি দিন। নগদ একাউন্ট সক্রিয় থাকতে হবে।',
    accountTypeLabel: 'নগদ পার্সোনাল নাম্বার',
  },
  {
    id: 'rocket',
    name: 'Rocket (রকেট)',
    logo: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=100&auto=format&fit=crop&q=60',
    minAmount: 100,
    feePercent: 2,
    placeholder: '01XXXXXXXXX',
    instructions: 'আপনার ১২ ডিজিটের রকেট একাউন্ট নাম্বারটি প্রদান করুন (মূল নাম্বার + লাস্ট ডিজিট)।',
    accountTypeLabel: 'রকেট একাউন্ট নাম্বার',
  },
  {
    id: 'upay',
    name: 'Upay (উপায়)',
    logo: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100&auto=format&fit=crop&q=60',
    minAmount: 50,
    feePercent: 2,
    placeholder: '01XXXXXXXXX',
    instructions: 'আপনার ১১ ডিজিটের উপায় পার্সোনাল একাউন্ট নাম্বার প্রদান করুন।',
    accountTypeLabel: 'উপায় পার্সোনাল নাম্বার',
  },
];

let cachedSettings: AppSettings | null = null;
let settingsCacheTime = 0;

/**
 * Loads the active AppSettings from the single server-side source of truth (Firebase or defaults).
 * Caches in memory for 15 seconds to minimize network latency while ensuring real-time configuration changes.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const now = Date.now();
  if (cachedSettings && now - settingsCacheTime < 15000) {
    return cachedSettings;
  }

  if (firebaseDb.isConfigured()) {
    try {
      const dbSettings = await firebaseDb.get<AppSettings>('settings');
      if (dbSettings) {
        cachedSettings = {
          ...DEFAULT_SETTINGS,
          ...dbSettings,
          monetagZoneId: process.env.MONETAG_ZONE_ID || dbSettings.monetagZoneId || DEFAULT_SETTINGS.monetagZoneId,
        };
        settingsCacheTime = now;
        return cachedSettings;
      }
    } catch (err) {
      console.warn('Could not load settings from Firebase, using defaults:', err);
    }
  }

  cachedSettings = {
    ...DEFAULT_SETTINGS,
    monetagZoneId: process.env.MONETAG_ZONE_ID || DEFAULT_SETTINGS.monetagZoneId,
  };
  settingsCacheTime = now;
  return cachedSettings;
}
