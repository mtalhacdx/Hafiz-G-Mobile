import axios from "axios";
import {
  buildCacheKey,
  clearCacheStorage,
  getCacheEntry,
  setCacheEntry,
  shouldCacheRequest,
} from "./cacheStore";

const DEFAULT_API_PORT = "5000";
const browserHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const apiHost = import.meta.env.VITE_API_HOST || browserHost;
const apiPort = import.meta.env.VITE_API_PORT || DEFAULT_API_PORT;
const apiBaseUrl = import.meta.env.VITE_API_URL || `http://${apiHost}:${apiPort}/api`;

const client = axios.create({
  baseURL: apiBaseUrl,
});

const DEACTIVATED_NOTICE = "Your account has been deactivated by owner admin. Please contact owner for access.";

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = String(config.method || "get").toLowerCase();
  const canCache = method === "get" && shouldCacheRequest(config.url);

  if (canCache) {
    const cacheKey = buildCacheKey(config.url, config.params || {});
    const cached = config.skipCache ? null : getCacheEntry(cacheKey);

    config.metadata = { cacheKey, cacheHit: Boolean(cached) };

    if (cached) {
      config.adapter = () =>
        Promise.resolve({
          data: cached.data,
          status: 200,
          statusText: "OK",
          headers: { "x-cache": "HIT" },
          config,
          request: {},
        });
    }
  }

  return config;
});

client.interceptors.response.use(
  (response) => {
    const method = String(response.config?.method || "get").toLowerCase();
    const metadata = response.config?.metadata;

    if (method === "get" && metadata?.cacheKey && !metadata.cacheHit) {
      setCacheEntry(metadata.cacheKey, response.data);
    }

    if (method !== "get") {
      clearCacheStorage();
    }

    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || "").toLowerCase();
    const isDeactivated = status === 403 && message.includes("deactivated");

    if (isDeactivated) {
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
      localStorage.setItem("auth_notice", DEACTIVATED_NOTICE);

      if (window.location.pathname !== "/login") {
        window.location.assign("/login?status=deactivated");
      }
    }

    return Promise.reject(error);
  }
);

export default client;
