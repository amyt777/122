/**
 * WatchPay Frontend Public Configuration
 * Only public client-side endpoints and constants.
 * NO secrets, private keys, or admin tokens!
 */

const CONFIG = {
  // If hosting the API on a Cloudflare Worker or custom domain, set WORKER_API_URL here.
  // When empty, it uses relative paths (same origin as server).
  WORKER_API_URL: window.location.origin.includes('localhost') || window.location.origin.includes('run.app')
    ? '' 
    : 'https://watchpay-worker.your-subdomain.workers.dev',

  TELEGRAM_BOT_USERNAME: 'watchpaybdbot',
  DEFAULT_LANG: 'bn',
  POLL_INTERVAL_MS: 30000,
};

window.WATCHPAY_CONFIG = CONFIG;
