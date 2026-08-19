// A deliberately simple in-memory sliding-window limiter for the
// account-system's sensitive endpoints (login, register, password
// reset) - this app has no Redis client wired up on the web side (the
// NestJS API's own @nestjs/throttler doesn't cover these Next.js Route
// Handlers/middleware at all), and pulling one in just for this would be
// exactly the kind of unnecessary new infra the Phase 1 review argued
// against. In-memory means the counters reset on every server restart
// and don't share state across multiple instances - a real limitation
// for a horizontally-scaled deployment, fine for this project's actual
// scale (single process, small team of real users).
const buckets = new Map<string, { count: number; resetAt: number }>();

// Every entry this module has ever seen stays in memory until it
// expires - clean out stale ones periodically so a long-running process
// doesn't slowly accumulate one entry per distinct (ip, bucket) pair
// forever.
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, entry] of buckets) {
    if (entry.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// key should already identify both the caller (IP) and the action
// (e.g. "login:203.0.113.4") - this function doesn't know what it's
// limiting, just counts hits against a window.
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

// x-forwarded-for can carry a comma-separated chain (client, proxy1,
// proxy2, ...) - the first entry is the original client. Falls back to
// a constant when nothing is set (local dev without a proxy in front),
// which collapses every request onto one shared bucket - an accepted
// limitation for local dev, not a production concern since a real
// deployment always sits behind something that sets this header.
export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
