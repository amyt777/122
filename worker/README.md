# WatchPay Cloudflare Worker Backend

Production backend service for WatchPay Telegram Mini App.

## Required Secrets (Wrangler Secrets)

Set each secret using `npx wrangler secret put <KEY>`:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
npx wrangler secret put FIREBASE_DB_URL
npx wrangler secret put MONETAG_API_URL
npx wrangler secret put MONETAG_API_TOKEN
```

## Deployment

```bash
cd worker
npm install -g wrangler
wrangler deploy
```

## API Endpoints Implemented

- `POST /api/auth` - Authenticate via Telegram `initData` signature verification.
- `GET /api/settings` - Admin feature flags, rewards, limits, and notices.
- `GET /api/user` - Real user balance, earnings, and statistics.
- `POST /api/ad-session` - Creates secure server-side ad session with Monetag zone ID.
- `POST /api/ad-claim` - Verifies session duration & Monetag completion before atomic reward credit.
- `GET /api/tasks` - Dynamic Telegram tasks list with status.
- `POST /api/task-verify` - Telegram bot API getChatMember verification.
- `POST /api/task-claim` - Claim task reward idempotently.
- `GET /api/referrals` - Referral stats, unique bot link, and history.
- `POST /api/daily-bonus` - Claim daily Bangladesh-time bonus once per calendar day.
- `GET /api/withdraw-methods` - Active payment gateways (bKash, Nagad, Rocket, Binance).
- `POST /api/withdraw-create` - Validates balance, min withdrawal, calculates fee, creates pending withdrawal.
- `GET /api/withdrawals` - User withdrawal history with statuses.
- `GET /api/transactions` - Complete ledger with balance before/after records.
