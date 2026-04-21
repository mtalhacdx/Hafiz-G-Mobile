import client from "./client";
import { clearCacheStorage, setCacheStatus, updateCacheTimestamp } from "./cacheStore";

const PREFETCH_ENDPOINTS = [
  { url: "/products" },
  { url: "/categories", params: { includeInactive: true } },
  { url: "/brands", params: { includeInactive: true } },
  { url: "/customers", params: { includeInactive: true } },
  { url: "/suppliers", params: { includeInactive: true } },
  { url: "/sales" },
  { url: "/purchases" },
  { url: "/returns" },
  { url: "/claims" },
];

const getErrorMessage = (error, fallback) => {
  return error?.response?.data?.message || fallback;
};

export const prefetchAllData = async () => {
  setCacheStatus({ refreshing: true, error: null });

  const results = await Promise.allSettled(
    PREFETCH_ENDPOINTS.map((endpoint) =>
      client.get(endpoint.url, { params: endpoint.params, skipCache: true })
    )
  );

  const failures = results.filter((result) => result.status === "rejected");
  const timestamp = new Date().toISOString();

  if (failures.length > 0) {
    const message = getErrorMessage(failures[0].reason, "Some data failed to sync");
    setCacheStatus({ refreshing: false, error: message });
  } else {
    setCacheStatus({ refreshing: false, error: null });
  }

  updateCacheTimestamp(timestamp);
  return results;
};

export const refreshAllData = async () => {
  clearCacheStorage();
  return prefetchAllData();
};
