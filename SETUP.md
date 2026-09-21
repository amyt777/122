# WATCHPAY — USER PANEL SETUP & DEPLOYMENT GUIDE

Complete step-by-step instructions for deploying WatchPay User Panel, Cloudflare Worker backend, and Firebase Realtime Database.

---

## 1. Firebase Realtime Database Setup

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Go to **Build > Realtime Database** and click **Create Database**.
3. Choose your region (e.g. `Singapore` or `United States`).
4. Go to the **Rules** tab and paste the contents of `firebase/database.rules.json`.
5. Click **Publish**.
6. Note your Realtime Database URL (e.g., `https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app`).
7. Go to **Project Settings > Service Accounts**, generate a new private key, and copy:
   - `client_email`
   - `private_key`

---

## 2. Cloudflare Worker Backend Deployment

1. Install the Cloudflare Wrangler CLI if you haven't already:
   ```bash
   npm install -g wrangler
   ```
2. Authenticate Wrangler with your Cloudflare account:
   ```bash
   wrangler login
   ```
3. Navigate to the `worker/` directory:
   ```bash
   cd worker
   ```
4. Configure all production secrets:
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   # Enter your bot token from @BotFather (e.g. 789123456:AAFd...)

   npx wrangler secret put TELEGRAM_ADMIN_CHAT_ID
   # Enter your admin Telegram numeric chat ID

   npx wrangler secret put FIREBASE_DB_URL
   # Enter your Firebase RTDB URL

   npx wrangler secret put FIREBASE_CLIENT_EMAIL
   # Enter the client email from your Firebase service account

   npx wrangler secret put FIREBASE_PRIVATE_KEY
   # Enter the private key from your Firebase service account

   npx wrangler secret put MONETAG_API_URL
   # Optional: Monetag publisher API URL

   npx wrangler secret put MONETAG_API_TOKEN
   # Optional: Monetag API authorization bearer token
   ```
5. Deploy the worker:
   ```bash
   wrangler deploy
   ```
6. Your backend will be live at `https://watchpay-worker.<your-subdomain>.workers.dev`.

---

## 3. Telegram Bot Mini App Configuration

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Create or select your bot:
   - Send `/newbot` or `/mybots` > select your bot.
3. Configure the Mini App URL:
   - Send `/newapp` or select **Bot Settings > Menu Button > Configure menu button**.
   - Enter your hosted web app URL (e.g., `https://your-app-domain.com` or Cloud Run / Pages URL).
   - Enter the short name: `watchpay`.
4. Test launching the app inside Telegram!

---

## 4. Monetag Ads Configuration

1. Register or login to [Monetag](https://monetag.com/).
2. Create a new zone for **Rewarded Web Ads / Interstitial**.
3. Copy your numeric Zone ID (e.g. `892341`).
4. Update `worker/wrangler.toml` under `MONETAG_ZONE_ID` or set it in Firebase `settings/monetagZoneId`.

---

## 5. Security & Anti-Fraud Best Practices

- **Zero Client Trust**: Balances, rewards, and withdrawals are calculated strictly on the backend.
- **Telegram Signature Validation**: Every request is authenticated using HMAC-SHA256 of `initData`.
- **Atomic Operations**: Ad rewards and withdrawal deductions use transaction IDs to prevent double claiming.
- **Strict Database Rules**: Direct frontend database write access is set to `false`.
