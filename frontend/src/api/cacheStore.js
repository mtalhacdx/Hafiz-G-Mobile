const CACHE_KEY = "hafizg_data_cache_v1";
const CACHE_VERSION = 1;

const isBrowser = typeof window !== "undefined";
const listeners = new Set();

const safeParse = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const loadPersistedCache = () => {
  if (!isBrowser) {
    return { entries: {}, updatedAt: null };
  }

  const raw = window.localStorage.getItem(CACHE_KEY);
  const parsed = safeParse(raw);

  if (!parsed || parsed.version !== CACHE_VERSION || typeof parsed.entries !== "object") {
    return { entries: {}, updatedAt: null };
  }

  return {
    entries: parsed.entries || {},
    updatedAt: parsed.updatedAt || null,
  };
};

let { entries: cacheEntries, updatedAt: cacheUpdatedAt } = loadPersistedCache();
let status = {
  refreshing: false,
  lastUpdated: cacheUpdatedAt,
  error: null,
};

const persistCache = () => {
  if (!isBrowser) {
    return;
  }

  const payload = {
    version: CACHE_VERSION,
    entries: cacheEntries,
    updatedAt: cacheUpdatedAt,
  };

  window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
};

const notify = () => {
  listeners.forEach((listener) => listener(status));
};

export const subscribeCacheStatus = (listener) => {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
};

export const setCacheStatus = (next) => {
  status = { ...status, ...next };
  notify();
};

export const getCacheStatus = () => status;

export const buildCacheKey = (url, params = {}) => {
  const safeUrl = url || "";
  const keys = Object.keys(params || {}).sort();
  const search = keys.map((key) => `${key}=${JSON.stringify(params[key])}`).join("&");
  return search ? `${safeUrl}?${search}` : safeUrl;
};

export const getCacheEntry = (key) => {
  if (!key) {
    return null;
  }

  return cacheEntries[key] || null;
};

export const setCacheEntry = (key, data) => {
  if (!key) {
    return;
  }

  cacheEntries = {
    ...cacheEntries,
    [key]: {
      data,
      savedAt: new Date().toISOString(),
    },
  };

  persistCache();
};

export const updateCacheTimestamp = (timestamp) => {
  cacheUpdatedAt = timestamp || new Date().toISOString();
  status = { ...status, lastUpdated: cacheUpdatedAt };
  persistCache();
  notify();
};

export const clearCacheStorage = () => {
  cacheEntries = {};
  cacheUpdatedAt = null;

  if (isBrowser) {
    window.localStorage.removeItem(CACHE_KEY);
  }

  setCacheStatus({ refreshing: false, lastUpdated: null, error: null });
};

export const shouldCacheRequest = (url) => {
  if (!url) {
    return false;
  }

  const normalized = url.startsWith("http") ? new URL(url).pathname : url;
  if (normalized.startsWith("/auth")) {
    return false;
  }

  const cacheable = [
    "/products",
    "/categories",
    "/brands",
    "/customers",
    "/suppliers",
    "/sales",
    "/purchases",
    "/returns",
    "/claims",
  ];

  return cacheable.some((path) => normalized.startsWith(path));
};
