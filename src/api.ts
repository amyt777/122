import { AppSettings, UserProfile, AdSession, TelegramTask, ReferralData, PaymentMethod, WithdrawalRecord, TransactionRecord } from './types';

// Detect Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            is_premium?: boolean;
            photo_url?: string;
          };
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        openTelegramLink: (url: string) => void;
        openLink: (url: string) => void;
        showAlert: (message: string) => void;
        showConfirm: (message: string, callback: (confirmed: boolean) => void) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

class ApiClient {
  private baseUrl: string = '';
  private devInitData: string | null = null;

  constructor() {
    // If running in development or inside AI Studio preview, baseUrl is relative ('')
    this.baseUrl = '';
  }

  public getInitData(): string {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) {
      return window.Telegram.WebApp.initData;
    }
    // Fallback for browser preview / local testing
    if (this.devInitData) {
      return this.devInitData;
    }
    const saved = localStorage.getItem('watchpay_dev_initdata');
    if (saved) {
      this.devInitData = saved;
      return saved;
    }
    // Default simulated dev initData for in-browser testing
    const defaultDev = 'query_id=AAHdF6IQAAAAAN0XohAgXwzN&user=%7B%22id%22%3A782918231%2C%22first_name%22%3A%22Rakib%22%2C%22last_name%22%3A%22Hasan%22%2C%22username%22%3A%22rakib_dev%22%2C%22language_code%22%3A%22bn%22%2C%22is_premium%22%3Atrue%7D&auth_date=1726915200&hash=dev_simulated_hash';
    this.devInitData = defaultDev;
    return defaultDev;
  }

  public setDevInitData(data: string) {
    this.devInitData = data;
    localStorage.setItem('watchpay_dev_initdata', data);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const initData = this.getInitData();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData,
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না।');
      }

      return data.data as T;
    } catch (err: any) {
      console.error(`API Error on ${endpoint}:`, err);
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        throw new Error('সার্ভারের সাথে সংযোগ করা যাচ্ছে না।');
      }
      throw err;
    }
  }

  // 1. Auth & Initial User State
  async authenticate(): Promise<{ user: UserProfile; settings: AppSettings }> {
    const initData = this.getInitData();
    return this.request<{ user: UserProfile; settings: AppSettings }>('/api/auth', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
  }

  // 2. Settings
  async getSettings(): Promise<AppSettings> {
    return this.request<AppSettings>('/api/settings', { method: 'GET' });
  }

  // 3. User details
  async getUser(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/user', { method: 'GET' });
  }

  // 4. Ad session creation
  async createAdSession(): Promise<AdSession> {
    return this.request<AdSession>('/api/ad-session', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // 5. Ad claim
  async claimAd(adSessionId: string): Promise<{
    reward: number;
    newBalance: number;
    todayAdsWatched: number;
    hourlyAdsWatched: number;
  }> {
    return this.request('/api/ad-claim', {
      method: 'POST',
      body: JSON.stringify({ adSessionId }),
    });
  }

  // 6. Tasks
  async getTasks(): Promise<TelegramTask[]> {
    return this.request<TelegramTask[]>('/api/tasks', { method: 'GET' });
  }

  // 7. Verify Task
  async verifyTask(taskId: string): Promise<{ verified: boolean; message: string }> {
    return this.request<{ verified: boolean; message: string }>('/api/task-verify', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  // 8. Claim Task
  async claimTask(taskId: string): Promise<{ reward: number; newBalance: number }> {
    return this.request<{ reward: number; newBalance: number }>('/api/task-claim', {
      method: 'POST',
      body: JSON.stringify({ taskId }),
    });
  }

  // 9. Referrals
  async getReferrals(): Promise<ReferralData> {
    return this.request<ReferralData>('/api/referrals', { method: 'GET' });
  }

  // 10. Claim Referral Earnings
  async claimReferralEarnings(): Promise<{ claimedAmount: number; newBalance: number; message?: string }> {
    return this.request<{ claimedAmount: number; newBalance: number; message?: string }>('/api/referral-claim', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // 11. Daily Bonus
  async claimDailyBonus(): Promise<{ bonus: number; newBalance: number; date: string }> {
    return this.request<{ bonus: number; newBalance: number; date: string }>('/api/daily-bonus', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // 12. Withdraw Methods
  async getWithdrawMethods(): Promise<PaymentMethod[]> {
    const res = await this.request<any>('/api/withdraw-methods', { method: 'GET' });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.methods)) return res.methods;
    return [];
  }

  // 13. Create Withdrawal
  async createWithdrawal(payload: {
    method: string;
    account: string;
    amount: number;
  }): Promise<WithdrawalRecord> {
    return this.request<WithdrawalRecord>('/api/withdraw-create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // 14. Withdrawals List
  async getWithdrawals(): Promise<WithdrawalRecord[]> {
    return this.request<WithdrawalRecord[]>('/api/withdrawals', { method: 'GET' });
  }

  // 15. Transactions List
  async getTransactions(): Promise<TransactionRecord[]> {
    return this.request<TransactionRecord[]>('/api/transactions', { method: 'GET' });
  }
}

export const api = new ApiClient();
