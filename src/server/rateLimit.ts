/** Simple in-memory sliding-window rate limit (per server instance). */

type Bucket = { at: number[] };

const buckets = new Map<string, Bucket>();

const MAX_KEYS = 10_000;

function pruneIfNeeded(): void {
  if (buckets.size <= MAX_KEYS) return;
  const drop = Math.floor(MAX_KEYS / 5);
  let i = 0;
  for (const k of buckets.keys()) {
    buckets.delete(k);
    i += 1;
    if (i >= drop) break;
  }
}

/** @returns true if allowed */
export function rateLimitAllow(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { at: [] };
    buckets.set(key, b);
    pruneIfNeeded();
  }
  b.at = b.at.filter((t) => now - t < windowMs);
  if (b.at.length >= limit) return false;
  b.at.push(now);
  return true;
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export function rateLimitResponse(retryAfterSec = 60): Response {
  return Response.json(
    { error: "RATE LIMIT" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}
