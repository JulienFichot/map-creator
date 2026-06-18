const cache = new Map<string, { data: unknown; ts: number }>();
const TTL = 1000 * 60 * 60 * 24; // 24 hours

export function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

export async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getCache<T>(key);
  if (cached) return cached;
  const data = await fetcher();
  setCache(key, data);
  return data;
}
