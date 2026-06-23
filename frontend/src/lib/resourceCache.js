import { api } from "./api";

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();

const stableStringify = (value) => {
  if (!value || typeof value !== "object") return "";
  const sorted = Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      if (value[key] !== undefined && value[key] !== "") acc[key] = value[key];
      return acc;
    }, {});
  return JSON.stringify(sorted);
};

export const getCacheKey = (url, config = {}) =>
  `${url}?${stableStringify(config.params)}`;

export const cachedApiGet = async (url, config = {}, options = {}) => {
  const { ttl = DEFAULT_TTL_MS, force = false } = options;
  const key = getCacheKey(url, config);
  const now = Date.now();
  const cached = cache.get(key);

  if (!force && cached && now - cached.timestamp < ttl) {
    return cached.data;
  }

  if (!force && inFlight.has(key)) {
    return inFlight.get(key);
  }

  const request = api.get(url, config).then(({ data }) => {
    cache.set(key, { data, timestamp: Date.now() });
    inFlight.delete(key);
    return data;
  });

  inFlight.set(key, request);

  try {
    return await request;
  } catch (error) {
    inFlight.delete(key);
    throw error;
  }
};

export const invalidateCachedApi = (prefix) => {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
};
