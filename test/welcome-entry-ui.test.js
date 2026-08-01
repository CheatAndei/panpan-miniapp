const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

async function loadSourceModule(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(url);
}

test('returning-parent copy pool has 100 unique phrases and avoids boundary repeats', async () => {
  const copy = await loadSourceModule('utils/welcome-copy.js');
  assert.equal(copy.WELCOME_COPY.length, 100);
  assert.equal(new Set(copy.WELCOME_COPY).size, 100);

  let state = {};
  let previous = '';
  const seen = new Set();
  for (let index = 0; index < 205; index += 1) {
    const result = copy.drawWelcomeCopy(state, () => 0.37);
    assert.notEqual(result.value, previous);
    if (index < 100) seen.add(result.value);
    previous = result.value;
    state = result.state;
  }
  assert.equal(seen.size, 100);
});

test('share entry resolves only allowlisted targets and parameters', async () => {
  const entry = await loadSourceModule('utils/welcome-entry.js');
  assert.equal(
    entry.buildShareEntryPath('bind', { code: 'A B', path: '/pages/mine/index' }),
    '/pages/share-entry/index?target=bind&code=A%20B',
  );
  assert.deepEqual(
    entry.resolveShareTarget({ target: 'bind', code: 'A B', redirect: '/pages/mine/index' }),
    { key: 'bind', url: '/pages/bind/bind?code=A%20B' },
  );
  assert.deepEqual(
    entry.resolveShareTarget({ target: '__proto__', code: 'unsafe' }),
    { key: 'home', url: '/pages/index/index' },
  );
});

test('30-minute return gate and page target serialization are deterministic', async () => {
  const entry = await loadSourceModule('utils/welcome-entry.js');
  const now = 2_000_000;
  assert.equal(entry.shouldShowAfterBackground(now - entry.RETURN_WELCOME_AFTER_MS + 1, now), false);
  assert.equal(entry.shouldShowAfterBackground(now - entry.RETURN_WELCOME_AFTER_MS, now), true);
  assert.equal(entry.isShareEntryLaunch({ path: 'pages/share-entry/index' }), true);
  assert.equal(entry.isShareEntryLaunch({ path: '/pages/share-entry/index' }), true);
  assert.equal(entry.isShareEntryLaunch({ path: 'pages/index/index' }), false);
  assert.equal(entry.serializePageTarget({ route: 'pages/index/index', options: {} }), '');
  assert.equal(
    entry.serializePageTarget({ route: 'pages/growth/index', options: { student_id: 8 } }),
    '/pages/growth/index?student_id=8',
  );
});

test('entrance target keeps long internal URLs until explicit completion', async (t) => {
  const storage = new Map();
  globalThis.uni = {
    getStorageSync: (key) => storage.get(key),
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  };
  t.after(() => { delete globalThis.uni; });

  const entry = await loadSourceModule('utils/welcome-entry.js');
  const target = `/pages/growth/index?note=${'a'.repeat(260)}`;
  entry.setEntranceTarget(target);
  entry.markWelcomePending('share');
  assert.equal(entry.consumeWelcomePending('teacher'), null);
  assert.equal(entry.peekEntranceTarget(), target);
  assert.equal(entry.peekEntranceTarget(), target);
  entry.clearEntranceTarget();
  assert.equal(entry.peekEntranceTarget(), '');
  entry.setEntranceTarget(`/pages/growth/index?note=${'b'.repeat(601)}`);
  assert.equal(entry.peekEntranceTarget(), '');
});

test('welcome UI exposes confirmed timing, transition, reduced-motion, and share wiring', () => {
  const index = fs.readFileSync(path.join(root, 'pages/index/index.vue'), 'utf8');
  const entrance = fs.readFileSync(path.join(root, 'components/home/BrandEntrance.vue'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'App.vue'), 'utf8');
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'pages.json'), 'utf8'));

  assert.match(index, /entranceMode\.value === 'new' \? 1500 : 600/);
  assert.match(index, /Promise\.allSettled\(\[notifyPromise, parentPromise\]\)/);
  assert.match(entrance, /is-leaving/);
  assert.match(entrance, /prefers-reduced-motion:\s*reduce/);
  assert.match(entrance, /#99DEF4/);
  assert.match(entrance, /#F79BC0/);
  assert.match(entrance, /#FFF48A/);
  assert.match(app, /shouldShowAfterBackground/);
  assert.match(app, /getUser\(\)/);
  assert.match(app, /!shareEntryLaunch && shouldShowAfterBackground/);
  assert.match(index, /peekEntranceTarget/);
  assert.match(index, /onUnload/);
  assert.match(index, /bypassHomeLoadForTarget/);
  assert.ok(pages.pages.some((page) => page.path === 'pages/share-entry/index'));

  for (const file of [
    'pages/growth/index.vue',
    'pages/mental-arena/result.vue',
    'pages/practice-parent/index.vue',
    'pages/promotion-posters/index.vue',
    'pages/teacher-classes/index.vue',
  ]) {
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /buildShareEntryPath/);
  }
});
