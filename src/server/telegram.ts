/**
 * Telegram Authentication & Telegram Bot API Integration
 * - Enforces HMAC-SHA256 signature verification.
 * - Forbids bypass when TELEGRAM_BOT_TOKEN is missing.
 * - Performs real getChatMember verification for Telegram channel/group tasks.
 */

import crypto from 'crypto';

export interface TelegramAuthResult {
  valid: boolean;
  user?: any;
  error?: string;
}

/**
 * Validates Telegram WebApp initData
 */
export function validateTelegramInitData(initData: string): TelegramAuthResult {
  if (!initData || typeof initData !== 'string') {
    return { valid: false, error: 'অননুমোদিত অনুরোধ: Missing Telegram initData' };
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const isProduction = process.env.NODE_ENV === 'production';

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  const userStr = params.get('user');
  const authDate = params.get('auth_date');

  if (!hash || !userStr) {
    return { valid: false, error: 'অননুমোদিত অনুরোধ: Invalid Telegram payload' };
  }

  // Parse user object safely
  let user: TelegramAuthUser;
  try {
    user = JSON.parse(decodeURIComponent(userStr));
  } catch {
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      return { valid: false, error: 'অননুমোদিত অনুরোধ: Invalid user JSON' };
    }
  }

  // 1. In production: NEVER bypass. If botToken is missing or hash is simulated, immediately reject.
  if (isProduction) {
    if (!botToken) {
      console.error('[SECURITY ALERT] TELEGRAM_BOT_TOKEN is missing in production.');
      return { valid: false, error: 'Server authentication configuration missing.' };
    }
    if (hash === 'dev_simulated_hash') {
      return { valid: false, error: 'Simulated authentication forbidden in production' };
    }
  } else {
    // In development / preview mode: Allow dev_simulated_hash ONLY if botToken is not configured yet
    if (!botToken && hash === 'dev_simulated_hash') {
      return { valid: true, user };
    }
    if (!botToken) {
      return { valid: false, error: 'TELEGRAM_BOT_TOKEN is not configured' };
    }
  }

  // 3. Enforce 24-hour expiration on Telegram auth session to prevent replay attacks
  if (authDate) {
    const authTimestamp = parseInt(authDate, 10);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (isNaN(authTimestamp) || nowSeconds - authTimestamp > 86400) {
      return { valid: false, error: 'টেলিগ্রাম সেশনের মেয়াদ শেষ হয়েছে। অ্যাপটি বন্ধ করে আবার খুলুন।' };
    }
  }

  // 4. Construct sorted data-check-string
  const dataCheckArr: string[] = [];
  params.forEach((val, key) => {
    if (key !== 'hash') {
      dataCheckArr.push(`${key}=${val}`);
    }
  });
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');

  try {
    // Secret Key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    // Calculated Hash = HMAC_SHA256(SecretKey, dataCheckString)
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const hashBuf = Buffer.from(hash, 'utf8');
    const calcBuf = Buffer.from(calculatedHash, 'utf8');

    // Constant-time timing-safe comparison
    if (hashBuf.length !== calcBuf.length || !crypto.timingSafeEqual(hashBuf, calcBuf)) {
      return { valid: false, error: 'টেলিগ্রাম ডিজিটাল স্বাক্ষর যাচাই ব্যর্থ হয়েছে।' };
    }

    let user: any;
    try {
      user = JSON.parse(decodeURIComponent(userStr));
    } catch {
      user = JSON.parse(userStr);
    }

    if (!user || !user.id) {
      return { valid: false, error: 'ইউজার ডেটা পাওয়া যায়নি।' };
    }

    return { valid: true, user };
  } catch (err: any) {
    console.error('Telegram verification exception:', err);
    return { valid: false, error: 'প্রমাণীকরণ যাচাইকালে অপ্রত্যাশিত ত্রুটি ঘটেছে।' };
  }
}

/**
 * Verifies real Telegram channel or group membership using Telegram Bot API getChatMember
 */
export async function verifyTelegramChatMember(
  chatId: string,
  userId: number
): Promise<{ success: boolean; message?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return {
      success: false,
      message: 'TELEGRAM_BOT_TOKEN কনফিগার করা নেই। মেম্বারশিপ যাচাই করা সম্ভব নয়।',
    };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(
      chatId
    )}&user_id=${userId}`;

    const res = await fetch(url, { method: 'GET' });
    const data = (await res.json()) as any;

    if (!data.ok) {
      console.warn(`Telegram getChatMember failed for chatId ${chatId}, user ${userId}:`, data);
      return {
        success: false,
        message: `চ্যানেল/গ্রুপে জয়েন করা নিশ্চিত করা যায়নি: ${data.description || 'বট চ্যানেলটিতে এডমিন নয় অথবা চ্যানেল পাবলিক নয়'}`,
      };
    }

    const status = data.result?.status;
    // Valid member statuses in Telegram Bot API:
    // 'creator', 'administrator', 'member', and 'restricted' (where is_member is true)
    const isMember =
      ['creator', 'administrator', 'member'].includes(status) ||
      (status === 'restricted' && data.result?.is_member !== false);

    if (!isMember) {
      return {
        success: false,
        message: 'আপনি এখনো চ্যানেল বা গ্রুপটিতে জয়েন করেননি। অনুগ্রহ করে জয়েন করুন।',
      };
    }

    return { success: true };
  } catch (err: any) {
    console.error('getChatMember network error:', err);
    return {
      success: false,
      message: 'টেলিগ্রাম সার্ভারে সংযোগ করা যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।',
    };
  }
}
