import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

import { validateTelegramInitData, verifyTelegramChatMember } from './src/server/telegram';
import { getAppSettings, SERVER_TASKS, PAYMENT_METHODS } from './src/server/settings';
import { dbService } from './src/server/db';
import { checkRateLimit } from './src/server/rateLimit';
import { processMonetagPostback } from './src/server/monetag';
import { AdSession } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// 14. Restrict CORS to actual User Panel origin & trusted Telegram origins
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const appUrl = process.env.APP_URL;

  const allowedOrigins = [
    appUrl,
    'https://web.telegram.org',
    'https://t.me',
    'https://telegram.org',
  ].filter(Boolean) as string[];

  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }

  if (origin) {
    const isAllowed = allowedOrigins.some(
      (o) => origin === o || (appUrl && origin.includes('.run.app') && appUrl.includes('.run.app'))
    );

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (req.method === 'OPTIONS') {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Init-Data, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 13. Global IP Rate Limiter (Abuse protection)
app.use('/api/', (req: Request, res: Response, next: NextFunction) => {
  // Exclude Monetag postback from standard user rate limiting
  if (req.path === '/monetag-postback') {
    return next();
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const { allowed, retryAfterSeconds } = checkRateLimit(`ip_${clientIp}`, 120, 60000); // 120 req/min per IP
  if (!allowed) {
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      success: false,
      message: 'অনেক বেশি অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।',
    });
  }
  next();
});

// Telegram Authentication Middleware
async function requireTelegramAuth(req: Request, res: Response, next: NextFunction) {
  const initData = (req.headers['x-telegram-init-data'] as string) || (req.query.initData as string);

  const authResult = validateTelegramInitData(initData);
  if (!authResult.valid || !authResult.user) {
    return res.status(401).json({
      success: false,
      message: authResult.error || 'টেলিগ্রাম প্রমাণীকরণ ব্যর্থ হয়েছে।',
    });
  }

  (req as any).telegramUser = authResult.user;
  next();
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    telegramAuthEnforced: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    firebaseConfigured: Boolean(process.env.FIREBASE_DB_URL && process.env.FIREBASE_CLIENT_EMAIL),
    monetagPostbackReady: true,
  });
});

// 1. POST /api/auth
app.post('/api/auth', async (req: Request, res: Response) => {
  const { initData, referrerId } = req.body;

  const authResult = validateTelegramInitData(initData);
  if (!authResult.valid || !authResult.user) {
    return res.status(401).json({
      success: false,
      message: authResult.error || 'টেলিগ্রাম অথেনটিকেশন ব্যর্থ হয়েছে।',
    });
  }

  try {
    const user = await dbService.getOrCreateUser(authResult.user, referrerId ? Number(referrerId) : undefined);
    const settings = await getAppSettings();

    res.json({
      success: true,
      data: {
        user,
        settings,
      },
    });
  } catch (err: any) {
    console.error('Auth error:', err);
    res.status(500).json({ success: false, message: err.message || 'সার্ভার ত্রুটি ঘটেছে।' });
  }
});

// 2. GET /api/user
app.get('/api/user', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  try {
    const user = await dbService.getUser(tgUser.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'ইউজার প্রোফাইল পাওয়া যায়নি।' });
    }
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'ডেটা লোড করা যায়নি।' });
  }
});

// 3. GET /api/settings
app.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const settings = await getAppSettings();
    res.json({ success: true, data: settings });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'সেটিংস লোড করা যায়নি।' });
  }
});

// 4. POST /api/ad-session
app.post('/api/ad-session', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  // Rate limit ad session requests: max 1 per 4 seconds
  const { allowed } = checkRateLimit(`ad_sess_${userId}`, 1, 4000);
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'অনুগ্রহ করে কয়েক সেকেন্ড পর পরবর্তী বিজ্ঞাপন দেখুন।' });
  }

  try {
    const settings = await getAppSettings();
    if (!settings.ads) {
      return res.status(403).json({ success: false, message: 'বিজ্ঞাপন সার্ভিস বর্তমানে বন্ধ রয়েছে।' });
    }

    const user = await dbService.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
    }

    if (user.todayAdsWatched >= settings.dailyAdLimit) {
      return res.status(400).json({ success: false, message: 'আজকের দৈনিক বিজ্ঞাপন সীমা শেষ হয়েছে।' });
    }

    if (user.hourlyAdsWatched >= settings.hourlyAdLimit) {
      return res.status(400).json({ success: false, message: 'এই ঘণ্টার বিজ্ঞাপন সীমা শেষ হয়েছে।' });
    }

    const adSessionId = `ads_${crypto.randomUUID()}`;
    const reward = user.isPremium ? settings.premiumAdReward : settings.adReward;

    const session: AdSession = {
      adSessionId,
      userId,
      zoneId: settings.monetagZoneId || '892341',
      createdAt: Date.now(),
      expiresAt: Date.now() + 300000, // 5 mins
      status: 'created',
      minWatchTime: 12,
      reward,
      monetagVerified: false,
    };

    await dbService.createAdSession(session);

    res.json({
      success: true,
      data: {
        adSessionId: session.adSessionId,
        zoneId: session.zoneId,
        minWatchTime: session.minWatchTime,
        reward: session.reward,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'বিজ্ঞাপন সেশন তৈরি করা যায়নি।' });
  }
});

// 5. POST /api/ad-claim
app.post('/api/ad-claim', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;
  const { adSessionId } = req.body;

  if (!adSessionId) {
    return res.status(400).json({ success: false, message: 'Missing adSessionId' });
  }

  // Rate limit claims: max 1 per 8 seconds
  const { allowed } = checkRateLimit(`ad_claim_${userId}`, 1, 8000);
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'ক্লেইম খুব দ্রুত করা হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন।' });
  }

  try {
    const result = await dbService.claimAd(userId, adSessionId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        reward: result.reward,
        newBalance: result.newBalance,
        message: result.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'বিজ্ঞাপন ক্লেইম করা যায়নি।' });
  }
});

// 17. GET /api/monetag-postback (Real Monetag S2S Postback Endpoint)
app.get('/api/monetag-postback', async (req: Request, res: Response) => {
  try {
    const result = await processMonetagPostback(
      req.query,
      (ymid) => dbService.getAdSession(ymid),
      (ymid, updates) => dbService.updateAdSession(ymid, updates)
    );

    res.status(result.status).send(result.message);
  } catch (err: any) {
    console.error('Monetag postback processing error:', err);
    res.status(500).send('Internal error');
  }
});

// 6. GET /api/tasks
app.get('/api/tasks', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  try {
    const settings = await getAppSettings();
    if (!settings.telegramTasks) {
      return res.json({ success: true, data: [] });
    }

    const tasksWithStatus = await Promise.all(
      SERVER_TASKS.map(async (t) => {
        const isClaimed = await dbService.isTaskClaimed(userId, t.id);
        const isVerified = await dbService.isTaskVerified(userId, t.id);

        let status: 'not_started' | 'joined' | 'verified' | 'completed' = 'not_started';
        if (isClaimed) {
          status = 'completed';
        } else if (isVerified) {
          status = 'verified';
        }

        return {
          ...t,
          status,
        };
      })
    );

    res.json({ success: true, data: tasksWithStatus });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'টাস্ক লোড করা যায়নি।' });
  }
});

// 7. POST /api/task-verify (Real Telegram getChatMember verification)
app.post('/api/task-verify', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ success: false, message: 'Missing taskId' });
  }

  const { allowed } = checkRateLimit(`task_ver_${userId}`, 1, 3000);
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'অনুগ্রহ করে কয়েক সেকেন্ড পর আবার চেষ্টা করুন।' });
  }

  try {
    const settings = await getAppSettings();
    if (!settings.telegramTasks) {
      return res.status(403).json({ success: false, message: 'টাস্ক সিস্টেম বর্তমানে বন্ধ রয়েছে।' });
    }

    const task = SERVER_TASKS.find((t) => t.id === taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'টাস্ক পাওয়া যায়নি।' });
    }

    const alreadyClaimed = await dbService.isTaskClaimed(userId, taskId);
    if (alreadyClaimed) {
      return res.status(400).json({ success: false, message: 'টাস্কটি ইতোমধ্যেই সম্পন্ন হয়েছে।' });
    }

    // 5. Telegram getChatMember check for channel/group tasks
    if (task.chatId) {
      const checkRes = await verifyTelegramChatMember(task.chatId, userId);
      if (!checkRes.success) {
        return res.status(400).json({
          success: false,
          message: checkRes.message || 'চ্যানেল বা গ্রুপে জয়েন করা নিশ্চিত করা যায়নি।',
        });
      }
    }

    // Save real verified status
    await dbService.setTaskVerified(userId, taskId);

    res.json({
      success: true,
      data: {
        verified: true,
        message: 'টাস্ক সফলভাবে যাচাই করা হয়েছে! এখন রিওয়ার্ড ক্লেইম করুন।',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'টাস্ক যাচাই করা যায়নি।' });
  }
});

// 8. POST /api/task-claim (Server-side task reward definition)
app.post('/api/task-claim', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;
  const { taskId } = req.body;

  if (!taskId) {
    return res.status(400).json({ success: false, message: 'Missing taskId' });
  }

  const { allowed } = checkRateLimit(`task_claim_${userId}`, 1, 3000);
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।' });
  }

  try {
    const result = await dbService.claimTask(userId, taskId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        reward: result.reward,
        newBalance: result.newBalance,
        message: result.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'টাস্ক ক্লেইম করা যায়নি।' });
  }
});

// 9. GET /api/referrals
app.get('/api/referrals', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  try {
    const data = await dbService.getReferralData(userId);
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'রেফারেল তথ্য লোড করা যায়নি।' });
  }
});

// 4. POST /api/referral-claim (Real referral claim implementation)
app.post('/api/referral-claim', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  const { allowed } = checkRateLimit(`ref_claim_${userId}`, 1, 4000);
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'অনুগ্রহ করে কয়েক সেকেন্ড অপেক্ষা করুন।' });
  }

  try {
    const settings = await getAppSettings();
    if (!settings.referral) {
      return res.status(403).json({ success: false, message: 'রেফারেল প্রোগ্রাম বর্তমানে বন্ধ রয়েছে।' });
    }

    const result = await dbService.claimReferralEarnings(userId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        claimedAmount: result.claimedAmount,
        newBalance: result.newBalance,
        message: result.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'রেফারেল বোনাস ক্লেইম করা যায়নি।' });
  }
});

// 10. GET /api/withdraw-methods
app.get('/api/withdraw-methods', async (req: Request, res: Response) => {
  try {
    const settings = await getAppSettings();
    const methods = PAYMENT_METHODS.map((m) => ({
      ...m,
      minAmount: settings.minWithdrawal || m.minAmount,
      feePercent: settings.withdrawFeePercent || m.feePercent,
    }));
    res.json({
      success: true,
      data: methods,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'পেমেন্ট মেথড লোড করা যায়নি।' });
  }
});

// 11. POST /api/withdraw-create (Atomic withdrawal, referral requirement, no totalWithdrawn increment while pending)
app.post('/api/withdraw-create', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;
  const { method, account, amount } = req.body;

  if (!method || !account || !amount) {
    return res.status(400).json({ success: false, message: 'সকল প্রয়োজনীয় তথ্য প্রদান করুন।' });
  }

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, message: 'সঠিক উত্তোলনের পরিমাণ উল্লেখ করুন।' });
  }

  const { allowed } = checkRateLimit(`wd_req_${userId}`, 1, 10000); // 1 every 10s
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'অপেক্ষা করুন, আগের অনুরোধটি প্রসেস হচ্ছে।' });
  }

  try {
    const result = await dbService.createWithdrawal(userId, method, account, numAmount);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        withdrawal: result.record,
        message: result.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'উত্তোলন অনুরোধ সম্পন্ন করা যায়নি।' });
  }
});

// 12. GET /api/withdrawals
app.get('/api/withdrawals', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  try {
    const history = await dbService.getWithdrawals(userId);
    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'উত্তোলন ইতিহাস লোড করা যায়নি।' });
  }
});

// 13. GET /api/transactions
app.get('/api/transactions', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  try {
    const transactions = await dbService.getTransactions(userId);
    res.json({ success: true, data: transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'ট্রানজেকশন লোড করা যায়নি।' });
  }
});

// 14. POST /api/daily-bonus
app.post('/api/daily-bonus', requireTelegramAuth, async (req: Request, res: Response) => {
  const tgUser = (req as any).telegramUser;
  const userId = tgUser.id;

  const { allowed } = checkRateLimit(`bonus_${userId}`, 1, 5000);
  if (!allowed) {
    return res.status(429).json({ success: false, message: 'অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।' });
  }

  try {
    const result = await dbService.claimDailyBonus(userId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    res.json({
      success: true,
      data: {
        reward: result.reward,
        newBalance: result.newBalance,
        message: result.message,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'বোনাস ক্লেইম করা যায়নি।' });
  }
});

// -------------------------------------------------------------
// VITE DEV SERVER / STATIC ASSET SERVING
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WatchPay User Panel] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
