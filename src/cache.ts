import Redis from "ioredis";

// ── TTL presets per endpoint path prefix ──────────────────────────────
// AppTweak fetches data daily. Short TTLs cover a single conversation;
// longer TTLs apply to static or historical data.
const TTL_PRESETS: [string, number][] = [
  // Static — 24h
  ["/api/public/apptweak/countries", 24 * 3600],
  ["/api/public/apptweak/languages", 24 * 3600],
  ["/api/public/apptweak/dnas", 24 * 3600],
  // History — 1h (data never changes, but query params vary)
  ["/api/public/store/apps/metrics/history", 3600],
  ["/api/public/store/apps/category-rankings/history", 3600],
  ["/api/public/store/apps/keywords-rankings/history", 3600],
  ["/api/public/store/keywords/metrics/history", 3600],
  ["/api/public/store/keywords/search-results/history", 3600],
  ["/api/public/store/charts/top-results/history", 3600],
  // Charts & metadata — 4h
  ["/api/public/store/charts/top-results/current", 4 * 3600],
  ["/api/public/store/charts/dna/current", 4 * 3600],
  ["/api/public/store/categories/benchmarks", 4 * 3600],
  ["/api/public/store/categories/metrics", 4 * 3600],
  ["/api/public/store/featured_content", 4 * 3600],
  ["/api/public/store/apps/metadata", 4 * 3600],
  ["/api/public/store/apps/twin", 3600],
  ["/api/public/store/cpps", 3600],
  // Suggestions — 1h
  ["/api/public/store/keywords/suggestions", 3600],
  // Current rankings & metrics — 15min
  ["/api/public/store/apps/metrics/current", 900],
  ["/api/public/store/apps/category-rankings/current", 900],
  ["/api/public/store/apps/keywords-rankings/current", 900],
  ["/api/public/store/keywords/metrics/current", 900],
  ["/api/public/store/apps/events", 900],
  ["/api/public/store/in_app_events", 900],
  ["/api/public/store/apps/keywords/bids", 900],
  ["/api/public/store/keywords/apps/bids", 900],
  // Search & reviews — 5min
  ["/api/public/store/keywords/search-results", 300],
  ["/api/public/store/apps/reviews", 300],
  // Account data — no cache
  ["/api/public/integrations", 0],
  ["/api/public/apptweak/usage", 0],
  ["/api/public/apptweak/user", 0],
];

const DEFAULT_TTL = 300; // 5min

function resolveTtl(path: string): number {
  for (const [prefix, ttl] of TTL_PRESETS) {
    if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) {
      return ttl;
    }
  }
  return DEFAULT_TTL;
}

function cacheKey(path: string, params?: Record<string, unknown>): string {
  const sorted = params
    ? Object.keys(params)
        .sort()
        .map((k) => `${k}=${JSON.stringify(params[k])}`)
        .join("&")
    : "";
  return `apptweak:${path}?${sorted}`;
}

// ── Cache interface ──────────────────────────────────────────────────

export interface AppCache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec: number): Promise<void>;
  stats(): Promise<{ provider: string; entries: number }>;
}

// ── Redis cache ───────────────────────────────────────────────────────

class RedisCache implements AppCache {
  private redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });
    this.redis.on("error", (err) => {
      console.error("[CACHE] Redis error:", err.message);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSec: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSec);
    } catch (err) {
      console.error("[CACHE] Redis set failed:", (err as Error).message);
    }
  }

  async stats(): Promise<{ provider: string; entries: number }> {
    try {
      const keys = await this.redis.keys("apptweak:*");
      return { provider: "redis", entries: keys.length };
    } catch {
      return { provider: "redis", entries: -1 };
    }
  }
}

// ── In-memory fallback ────────────────────────────────────────────────

class MemoryCache implements AppCache {
  private store = new Map<string, { data: unknown; expiresAt: number }>();
  private order: string[] = [];
  private maxEntries = 500;

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.order = this.order.filter((k) => k !== key);
      return null;
    }
    return entry.data as T;
  }

  async set(key: string, value: unknown, ttlSec: number): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.order.shift();
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { data: value, expiresAt: Date.now() + ttlSec * 1000 });
    this.order.push(key);
  }

  async stats(): Promise<{ provider: string; entries: number }> {
    return { provider: "memory", entries: this.store.size };
  }
}

// ── Factory ──────────────────────────────────────────────────────────

let cacheInstance: AppCache | null = null;

export function initCache(redisUrl?: string): AppCache {
  if (redisUrl) {
    console.log("[CACHE] Using Redis at", redisUrl.replace(/:[^:@]+@/, ":***@"));
    cacheInstance = new RedisCache(redisUrl);
  } else {
    console.log("[CACHE] Redis URL not set, using in-memory cache");
    cacheInstance = new MemoryCache();
  }
  return cacheInstance;
}

export function getCache(): AppCache {
  if (!cacheInstance) {
    cacheInstance = initCache(process.env.REDIS_URL);
  }
  return cacheInstance;
}

export { cacheKey, resolveTtl };