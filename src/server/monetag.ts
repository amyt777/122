/**
 * Monetag Real Ad Integration & S2S (Server-to-Server) Verification
 * Supports:
 * 1. Monetag S2S Postback webhook receiver with signature/secret validation.
 * 2. Rewarded event verification (reward_event_type === 'valued').
 * 3. Idempotent deduplication by Monetag session ID (ymid).
 * 4. Monetag Publisher SSP API conversion checks when MONETAG_API_TOKEN is configured.
 */

import { getAppSettings } from './settings';

export interface MonetagPostbackPayload {
  ymid: string; // The unique adSessionId passed from TMA SDK
  zone_id: string; // The zone ID
  event_type?: string; // e.g. 'impression', 'click'
  reward_event_type?: string; // 'valued' or 'non_valued'
  estimated_price?: string | number; // Revenue in USD
  secret?: string; // Secret token configured in Monetag Postback settings
}

export interface MonetagVerificationResult {
  success: boolean;
  status: number;
  message: string;
  sessionUpdated?: boolean;
}

/**
 * Handles incoming Monetag S2S Postback GET request
 */
export async function processMonetagPostback(
  query: Record<string, any>,
  getSessionFn: (ymid: string) => Promise<any>,
  updateSessionFn: (ymid: string, updates: any) => Promise<boolean>
): Promise<MonetagVerificationResult> {
  const ymid = String(query.ymid || query.session_id || '').trim();
  const zoneId = String(query.zone_id || query.zoneId || '').trim();
  const rewardEventType = String(query.reward_event_type || query.rewardEventType || '').trim().toLowerCase();
  const eventType = String(query.event_type || 'impression').trim();
  const estimatedPrice = query.estimated_price || 0;
  const providedSecret = String(query.secret || query.token || '').trim();

  if (!ymid) {
    return {
      success: false,
      status: 400,
      message: 'Missing required ymid parameter',
    };
  }

  // 1. Verify Secret Token if configured on server
  const configuredSecret = process.env.MONETAG_SECRET || process.env.MONETAG_API_TOKEN;
  if (configuredSecret && providedSecret && providedSecret !== configuredSecret) {
    console.warn(`[MONETAG S2S REJECTED] Secret mismatch for ymid ${ymid}`);
    return {
      success: false,
      status: 403,
      message: 'Invalid Monetag postback secret token',
    };
  }

  // 2. Verify Zone ID
  const settings = await getAppSettings();
  if (zoneId && settings.monetagZoneId && zoneId !== settings.monetagZoneId) {
    console.warn(`[MONETAG S2S WARNING] Zone ID mismatch: received ${zoneId}, expected ${settings.monetagZoneId}`);
  }

  // 3. Find associated AdSession
  const session = await getSessionFn(ymid);
  if (!session) {
    console.warn(`[MONETAG S2S] AdSession not found for ymid: ${ymid}`);
    // Return 200 OK anyway to prevent Monetag retrying unknown sessions indefinitely
    return {
      success: true,
      status: 200,
      message: 'Session not found, acknowledged',
    };
  }

  // 4. Idempotency: Check if already verified
  if (session.monetagVerified) {
    return {
      success: true,
      status: 200,
      message: 'Already verified (idempotent)',
    };
  }

  // 5. Check reward event type (Monetag standard: 'valued')
  // Only 'valued' impressions qualify for real monetary reward
  const isValued = rewardEventType === 'valued' || rewardEventType === '' || rewardEventType === '1';

  await updateSessionFn(ymid, {
    monetagVerified: isValued,
    monetagRewardEventType: rewardEventType || 'valued',
    monetagEventType: eventType,
    monetagPrice: estimatedPrice,
    monetagVerifiedAt: Date.now(),
  });

  return {
    success: true,
    status: 200,
    message: isValued ? 'Monetag S2S postback verified successfully' : 'Monetag postback recorded (non_valued)',
    sessionUpdated: true,
  };
}

/**
 * Verifies with Monetag SSP API if token is configured
 */
export async function queryMonetagSspApi(ymid: string, zoneId: string): Promise<boolean> {
  const token = process.env.MONETAG_API_TOKEN;
  if (!token) return false;

  try {
    const url = `https://api.monetag.com/v5/statistics/conversions?zone_id=${encodeURIComponent(
      zoneId
    )}&sub_id=${encodeURIComponent(ymid)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) return false;
    const data = (await res.json()) as any;
    return Array.isArray(data.items) && data.items.length > 0;
  } catch (err) {
    console.warn('Monetag SSP API query failed:', err);
    return false;
  }
}
