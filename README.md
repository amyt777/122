# WatchPay — Complete Telegram Mini App User Panel

WatchPay is a Telegram Mini App and reward monetization platform built with React, Vite, Tailwind CSS, Express backend (and Cloudflare Worker export), and Firebase Realtime Database.

## Features

- **Match-Accurate UI/UX**: Dark navy theme (`#070b14`), violet/cyan glows, glassmorphism cards, and Bengali typography.
- **Authoritative Security**: Server-authoritative balances, ad session countdown validation, and HMAC-SHA256 signature verification.
- **Monetag Ad Flow**: Server-issued ad session tokens, minimum watch time verification, and atomic balance crediting.
- **Telegram Tasks**: Channel/group join tracking, verification via Telegram Bot API, and rewards.
- **Daily Bonus**: Bangladesh-time (UTC+6) synchronized bonus with streak and premium bonus multiplier.
- **Referral System**: Unique deep-links (`https://t.me/watchpaybdbot?startapp=USER_ID`), lifetime 10% commission, and live history.
- **Financial Ledger & Withdrawal**: Multi-gateway support (bKash, Nagad, Rocket, Binance), transaction logs, and withdrawal status filters.

## Project Structure

```
├── firebase/
│   └── database.rules.json    # Strict Realtime Database security rules
├── user/
│   ├── index.html             # Standalone static user panel HTML
│   ├── style.css              # Custom glassmorphism stylesheet
│   ├── app.js                 # Standalone client application
│   └── config.js              # Public endpoint configuration
├── worker/
│   ├── src/index.js           # Cloudflare Worker API backend
│   ├── wrangler.toml          # Worker configuration
│   └── README.md              # Worker deployment instructions
├── src/
│   ├── components/            # React components (Home, Ads, Tasks, Referrals, Withdraw, Profile)
│   ├── api.ts                 # Centralized API client with initData header injection
│   ├── types.ts               # Shared TypeScript schemas and models
│   ├── App.tsx                # Main application orchestrator
│   └── index.css              # Tailwind and glassmorphism styling
├── server.ts                  # Express backend with Vite SSR/middleware
├── SETUP.md                   # Full step-by-step deployment guide
└── package.json               # Dependencies and scripts
```

## Running the App

```bash
# Install dependencies
npm install

# Start local full-stack dev server
npm run dev

# Build for production
npm run build
```
