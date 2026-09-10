// In-memory rate limiter using a Map at true module scope.
// Survives Next.js dev-mode hot reloads because it's not re-instantiated per import.
// No Redis — see DOCUMENTATION.md Section 5 for the tradeoff.

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  ip: string,
  route: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const key = `${ip}:${route}`;
  const now = Date.now();
  const entry = store.get(key) ?? { timestamps: [] };

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.ceil((oldest + windowMs - now) / 1000);
    store.set(key, entry);
    return { allowed: false, retryAfterSeconds };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return { allowed: true };
}
