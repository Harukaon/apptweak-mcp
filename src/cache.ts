// TTL presets per endpoint path prefix (seconds).
// AppTweak fetches data daily; these control how long DB snapshots are reused.
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

export function resolveTtl(path: string): number {
  for (const [prefix, ttl] of TTL_PRESETS) {
    if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) {
      return ttl;
    }
  }
  return DEFAULT_TTL;
}
