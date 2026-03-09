// ─── lib/local-cache.ts ───────────────────────────────────────────────────────
// Persistent localStorage cache with:
// - Stale-while-revalidate pattern
// - 10MB total size guard
// - Per-key TTL
// - Auto-cleanup of expired entries

const CACHE_PREFIX = "app_cache_";
const MAX_CACHE_BYTES = 10 * 1024 * 1024; // 10MB

// Default TTLs (ms)
export const CACHE_TTL = {
  SEMESTERS:  60 * 60 * 1000,      // 1 hour  — basically static
  SUBJECTS:   30 * 60 * 1000,      // 30 min
  UNITS:      30 * 60 * 1000,      // 30 min
  MATERIALS:  30 * 60 * 1000,      // 30 min
  QUIZZES:    10 * 60 * 1000,      // 10 min  — changes more often
  PROFILE:    60 * 60 * 1000,      // 1 hour
  NOTICES:     5 * 60 * 1000,      // 5 min   — time-sensitive
  ATTEMPTS:    5 * 60 * 1000,      // 5 min
};

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  expiresAt: number;
}

// ─── Estimate size of a value in bytes ───────────────────────────────────────
function estimateBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

// ─── Get total cache size in bytes ───────────────────────────────────────────
export function getCacheSizeBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    const val = localStorage.getItem(key);
    if (val) total += val.length * 2; // UTF-16
  }
  return total;
}

export function getCacheSizeMB(): number {
  return getCacheSizeBytes() / (1024 * 1024);
}

// ─── Evict oldest expired entries until under limit ──────────────────────────
function evictIfNeeded(newEntryBytes: number): void {
  const currentSize = getCacheSizeBytes();
  if (currentSize + newEntryBytes <= MAX_CACHE_BYTES) return;

  // Collect all cache entries with their ages
  const entries: { key: string; expiresAt: number; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry: CacheEntry<unknown> = JSON.parse(raw);
      entries.push({ key, expiresAt: entry.expiresAt, size: raw.length * 2 });
    } catch {
      localStorage.removeItem(key!);
    }
  }

  // Sort by expiresAt ascending (evict soonest-to-expire first)
  entries.sort((a, b) => a.expiresAt - b.expiresAt);

  let freed = 0;
  const needed = currentSize + newEntryBytes - MAX_CACHE_BYTES;
  for (const entry of entries) {
    localStorage.removeItem(entry.key);
    freed += entry.size;
    if (freed >= needed) break;
  }
}

// ─── Write to cache ───────────────────────────────────────────────────────────
export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    const serialized = JSON.stringify(entry);
    const bytes = serialized.length * 2;
    evictIfNeeded(bytes);
    localStorage.setItem(CACHE_PREFIX + key, serialized);
  } catch (e) {
    // localStorage full or unavailable — fail silently
    console.warn("Cache write failed:", key, e);
  }
}

// ─── Read from cache ──────────────────────────────────────────────────────────
export interface CacheResult<T> {
  data: T;
  isStale: boolean; // true if expired but still returned for stale-while-revalidate
  cachedAt: number;
}

export function cacheGet<T>(key: string): CacheResult<T> | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const isStale = Date.now() > entry.expiresAt;
    return { data: entry.data, isStale, cachedAt: entry.cachedAt };
  } catch {
    localStorage.removeItem(CACHE_PREFIX + key);
    return null;
  }
}

// ─── Delete specific key ──────────────────────────────────────────────────────
export function cacheDelete(key: string): void {
  localStorage.removeItem(CACHE_PREFIX + key);
}

// ─── Delete all keys matching a prefix ───────────────────────────────────────
export function cacheDeletePrefix(prefix: string): void {
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX + prefix)) toDelete.push(key);
  }
  toDelete.forEach((k) => localStorage.removeItem(k));
}

// ─── Clear all app cache ──────────────────────────────────────────────────────
export function cacheClearAll(): void {
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) toDelete.push(key);
  }
  toDelete.forEach((k) => localStorage.removeItem(k));
}

// ─── Clean up expired entries (call on app start) ─────────────────────────────
export function cacheCleanExpired(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CACHE_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const entry: CacheEntry<unknown> = JSON.parse(raw);
      if (now > entry.expiresAt) toDelete.push(key);
    } catch {
      toDelete.push(key!);
    }
  }
  toDelete.forEach((k) => localStorage.removeItem(k));
}
