/**
 * Simple IP-based rate limiter using a sliding window.
 * Works in-memory per Vercel instance — good enough for abuse prevention.
 * For production-scale: swap for @upstash/ratelimit + Redis.
 */

const store = new Map(); // ip → [timestamp, ...]

const WINDOW_MS  = 60 * 1000; // 1 Minute
const MAX_CALLS  = 10;         // max 10 Analysen pro Minute pro IP

export function checkRateLimit(ip) {
  const now    = Date.now();
  const key    = ip || "unknown";
  const calls  = (store.get(key) || []).filter(t => now - t < WINDOW_MS);

  if (calls.length >= MAX_CALLS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((calls[0] + WINDOW_MS - now) / 1000),
    };
  }

  calls.push(now);
  store.set(key, calls);

  // Cleanup old entries periodically
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (v.every(t => now - t > WINDOW_MS)) store.delete(k);
    }
  }

  return { allowed: true, remaining: MAX_CALLS - calls.length };
}
