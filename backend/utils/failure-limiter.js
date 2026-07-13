function createFailureLimiter({ limit, windowMs, maxKeys, now = () => Date.now() }) {
  const buckets = new Map();

  function pruneAll(currentTime = now()) {
    for (const [key, times] of buckets) {
      const recent = times.filter((time) => currentTime - time < windowMs);
      if (recent.length > 0) buckets.set(key, recent);
      else buckets.delete(key);
    }
  }

  function check(key) {
    const currentTime = now();
    pruneAll(currentTime);
    const times = buckets.get(key) || [];
    if (times.length >= limit) {
      return {
        limited: true,
        retryAfter: Math.max(1, Math.ceil((windowMs - (currentTime - times[0])) / 1000)),
      };
    }
    if (!buckets.has(key) && buckets.size >= maxKeys) {
      return { limited: true, retryAfter: Math.max(1, Math.ceil(windowMs / 1000)), saturated: true };
    }
    return { limited: false, retryAfter: 0 };
  }

  function fail(key) {
    const state = check(key);
    if (state.limited) return state;
    const times = buckets.get(key) || [];
    times.push(now());
    buckets.set(key, times);
    return { limited: times.length >= limit, retryAfter: 0 };
  }

  function clear(key) {
    buckets.delete(key);
  }

  return { check, fail, clear, size: () => buckets.size };
}

module.exports = { createFailureLimiter };
