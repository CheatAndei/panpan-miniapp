const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAuthModule(initialStorage = {}) {
  const storage = new Map(Object.entries(initialStorage));
  const uni = {
    getStorageSync: (key) => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  };
  const filename = path.join(__dirname, '..', 'utils', 'auth.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export\s+/g, '')
    + '\nmodule.exports = { sanitizeUser, saveUser, getUser, clearLocalSession };';
  const context = { module: { exports: {} }, exports: {}, uni, api: {}, Promise, Error, Set };
  vm.runInNewContext(source, context, { filename });
  return { ...context.module.exports, storage };
}

test('读取历史用户缓存时只保留公开账户白名单并重写缓存', () => {
  const oldUser = {
    id: 7,
    nickname: '测试家长',
    avatar_url: '',
    role: 'parent',
    roles: ['parent', 'parent', 'invalid'],
    legacy_extra: '不应保留',
    openid: '不应下发到前端',
  };
  const auth = loadAuthModule({ user: JSON.stringify(oldUser) });
  const user = auth.getUser();
  assert.deepEqual(JSON.parse(JSON.stringify(user)), {
    id: 7,
    nickname: '测试家长',
    avatar_url: '',
    role: 'parent',
    roles: ['parent'],
  });
  assert.deepEqual(JSON.parse(auth.storage.get('user')), JSON.parse(JSON.stringify(user)));
});

test('登录修复清理令牌、用户与旧孩子选择', () => {
  const auth = loadAuthModule({ token: 'old', user: '{}', activeChildId: '99', unrelated: 'keep' });
  auth.clearLocalSession();
  assert.equal(auth.storage.has('token'), false);
  assert.equal(auth.storage.has('user'), false);
  assert.equal(auth.storage.has('activeChildId'), false);
  assert.equal(auth.storage.get('unrelated'), 'keep');
});
