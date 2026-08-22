type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as typeof globalThis & { __levienRateLimits?: Map<string, Bucket> };
const buckets = globalBuckets.__levienRateLimits || new Map<string, Bucket>();
globalBuckets.__levienRateLimits = buckets;

function clientAddress(request: Request) {
  return (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "local").split(",")[0].trim().slice(0, 80);
}

export function allowRequest(request: Request, namespace: string, limit: number, windowMs: number) {
  const now = Date.now(); const key = `${namespace}:${clientAddress(request)}`; const current = buckets.get(key);
  if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; }
  if (current.count >= limit) return false;
  current.count += 1;
  if (buckets.size > 5000) for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
  return true;
}
