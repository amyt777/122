/**
 * Bangladesh Timezone (Asia/Dhaka, UTC+6) Utilities
 * Handles exact daily & hourly resets for ad limits and earnings.
 */

export function getBangladeshTime(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 6 * 3600000);
}

export function getBangladeshDateStr(): string {
  const bd = getBangladeshTime();
  return bd.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

export function getBangladeshHourStr(): string {
  const bd = getBangladeshTime();
  const day = bd.toISOString().split('T')[0];
  const hour = String(bd.getUTCHours()).padStart(2, '0');
  return `${day}-${hour}`; // "YYYY-MM-DD-HH"
}

/**
 * Checks and automatically resets daily & hourly ad counters according to
 * Bangladesh timezone boundaries (UTC+6).
 * Returns true if any counter was reset.
 */
export function ensureBangladeshCountersReset(user: any): boolean {
  if (!user) return false;

  let changed = false;
  const currentDay = getBangladeshDateStr();
  const currentHour = getBangladeshHourStr();

  // Daily reset at 00:00 BD Time
  if (user.lastAdDate !== currentDay) {
    user.todayAdsWatched = 0;
    user.todayEarnings = 0.00;
    user.lastAdDate = currentDay;
    changed = true;
  }

  // Hourly reset at XX:00 BD Time
  if (user.lastAdHour !== currentHour) {
    user.hourlyAdsWatched = 0;
    user.lastAdHour = currentHour;
    changed = true;
  }

  return changed;
}
