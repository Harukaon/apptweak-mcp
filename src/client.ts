import axios, { AxiosInstance } from "axios";
import { getCache, cacheKey, resolveTtl } from "./cache.js";
import { persistSnapshot } from "./db.js";

export function createClient(apiKey?: string): AxiosInstance {
  const key = apiKey ?? process.env.APPTWEAK_API_KEY;
  if (!key) {
    throw new Error(
      "AppTweak API key is required. Set APPTWEAK_API_KEY env var or pass --api-key argument."
    );
  }
  return axios.create({
    baseURL: "https://public-api.apptweak.com",
    headers: {
      "x-apptweak-key": key,
    },
  });
}

export async function cachedGet<T>(
  client: AxiosInstance,
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const ttl = resolveTtl(path);
  if (ttl === 0) {
    console.log(`[CACHE] SKIP ${path} (no-cache endpoint)`);
    const { data } = await client.get<T>(path, { params });
    persistSnapshot(path, params, data);
    return data;
  }

  const key = cacheKey(path, params);
  const cache = getCache();
  const hit = await cache.get<T>(key);
  if (hit !== null) {
    console.log(`[CACHE] HIT  ${path} (ttl=${ttl}s)`);
    return hit;
  }

  console.log(`[CACHE] MISS ${path} (ttl=${ttl}s)`);
  const { data } = await client.get<T>(path, { params });
  await cache.set(key, data, ttl);
  persistSnapshot(path, params, data);
  return data;
}
