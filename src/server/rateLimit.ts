/**
 * Rate Limiting, Abuse Prevention, and Concurrency Locks
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const windowMap = new Map<string, RateLimitRecord>();
const userLocks = new Set<string>();

/**
 * Sliding-window rate limiter
 * @param key unique identifier (e.g. IP, userId:action)
 * @param maxRequests maximum allowed requests within window
 * @param windowMs window duration in milliseconds
 */
export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = windowMap.get(key);

  if (!record || now > record.resetAt) {
    windowMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Acquire an in-flight critical section lock for a user action (e.g. withdrawal creation)
 * Prevents concurrent double spending or double submissions.
 */
export function acquireUserLock(userId: number | string, action: string): boolean {
  const lockKey = `${userId}:${action}`;
  if (userLocks.has(lockKey)) {
    return false;
  }
  userLocks.add(lockKey);
  return true;
}

export function releaseUserLock(userId: number | string, action: string): void {
  const lockKey = `${userId}:${action}`;
  userLocks.delete(lockKey);
}

// Clean up expired rate limit records periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of windowMap.entries()) {
    if (now > v.resetAt) {
      windowMap.delete(k);
    }
  }
}, 60000);
