export const WELCOME_PENDING_KEY = 'ppWelcomePendingV1';
export const ENTRANCE_TARGET_KEY = 'ppEntranceTargetV1';
export const RETURN_WELCOME_AFTER_MS = 30 * 60 * 1000;

const SHARE_TARGETS = Object.freeze({
  home: { path: '/pages/index/index', params: ['from'] },
  guest: { path: '/pages/guest-experience/index', params: [] },
  bind: { path: '/pages/bind/bind', params: ['code', 'source'] },
});

function hasShareTarget(key) {
  return Object.prototype.hasOwnProperty.call(SHARE_TARGETS, key);
}

function storageApi() {
  return typeof uni !== 'undefined' ? uni : null;
}

function cleanParam(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, 160);
}

function appendAllowedParams(target, source = {}) {
  const query = target.params
    .map((name) => [name, cleanParam(source[name])])
    .filter(([, value]) => value)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&');
  return query ? `${target.path}?${query}` : target.path;
}

export function buildShareEntryPath(targetKey, params = {}) {
  const target = SHARE_TARGETS[targetKey] || SHARE_TARGETS.home;
  const query = [`target=${encodeURIComponent(hasShareTarget(targetKey) ? targetKey : 'home')}`];
  target.params.forEach((name) => {
    const value = cleanParam(params[name]);
    if (value) query.push(`${encodeURIComponent(name)}=${encodeURIComponent(value)}`);
  });
  return `/pages/share-entry/index?${query.join('&')}`;
}

export function resolveShareTarget(query = {}) {
  const key = cleanParam(query.target);
  const safeKey = hasShareTarget(key) ? key : 'home';
  const target = SHARE_TARGETS[safeKey];
  return { key: safeKey, url: appendAllowedParams(target, query) };
}

export function isShareEntryLaunch(options = {}) {
  return String(options?.path || '').replace(/^\/+/, '') === 'pages/share-entry/index';
}

export function markWelcomePending(reason = 'cold', details = {}) {
  const phrase = cleanParam(details.phrase);
  const pending = { reason, at: Date.now(), ...(phrase ? { phrase } : {}) };
  storageApi()?.setStorageSync(WELCOME_PENDING_KEY, pending);
  return pending;
}

export function consumeWelcomePending(role = '') {
  const storage = storageApi();
  const pending = storage?.getStorageSync(WELCOME_PENDING_KEY) || null;
  if (!pending) return null;
  storage?.removeStorageSync(WELCOME_PENDING_KEY);
  if (role === 'teacher') return null;
  return pending;
}

export function setEntranceTarget(url = '') {
  const safeUrl = String(url || '').trim();
  if (safeUrl.length <= 600 && safeUrl.startsWith('/pages/')) {
    storageApi()?.setStorageSync(ENTRANCE_TARGET_KEY, safeUrl);
  } else {
    clearEntranceTarget();
  }
}

export function peekEntranceTarget() {
  const storage = storageApi();
  const value = String(storage?.getStorageSync(ENTRANCE_TARGET_KEY) || '').trim();
  return value.length <= 600 && value.startsWith('/pages/') ? value : '';
}

export function clearEntranceTarget() {
  storageApi()?.removeStorageSync(ENTRANCE_TARGET_KEY);
}

export function consumeEntranceTarget() {
  const value = peekEntranceTarget();
  clearEntranceTarget();
  return value;
}

export function shouldShowAfterBackground(hiddenAt, now = Date.now()) {
  const timestamp = Number(hiddenAt || 0);
  return timestamp > 0 && now - timestamp >= RETURN_WELCOME_AFTER_MS;
}

export function serializePageTarget(page) {
  const route = cleanParam(page?.route);
  if (!route || route === 'pages/index/index' || route === 'pages/share-entry/index' || route === 'pages/maintenance/index') return '';
  const options = page?.options && typeof page.options === 'object' ? page.options : {};
  const query = Object.entries(options)
    .filter(([, value]) => value !== undefined && value !== null && String(value).length <= 160)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return `/${route}${query ? `?${query}` : ''}`;
}

export function waitForMinimum(startedAt, minimumMs) {
  const remaining = Math.max(0, Number(minimumMs || 0) - (Date.now() - Number(startedAt || 0)));
  return new Promise((resolve) => setTimeout(resolve, remaining));
}
