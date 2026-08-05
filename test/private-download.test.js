const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApi(uni, contextOverrides = {}) {
  const filename = path.join(__dirname, '..', 'utils', 'api.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export\s+default\s+BASE;?/g, '')
    .replace(/export\s+/g, '')
    + '\nmodule.exports = { downloadPrivateFile };';
  const context = {
    module: { exports: {} }, exports: {}, uni, wx: { env: { USER_DATA_PATH: '/wx-user' } },
    BASE: 'https://panpan.xpytt.com/api', ASSET_BASE: 'https://panpan.xpytt.com',
    Map, Promise, Error, Set, Object, String, RegExp, Date, Math, JSON, setTimeout, clearTimeout,
    ...contextOverrides,
  };
  vm.runInNewContext(source, context, { filename });
  return context.module.exports;
}

test('私有照片优先经 request 域名读取为数组缓冲并写入微信临时文件', async () => {
  let requestOptions;
  let downloadCalls = 0;
  let written;
  const uni = {
    env: { USER_DATA_PATH: '/wx-user' },
    getStorageSync: () => 'teacher-token',
    removeStorageSync: () => {},
    getFileSystemManager: () => ({
      writeFile(options) { written = options; options.success(); }
    }),
    request(options) {
      requestOptions = options;
      options.success({ statusCode: 200, data: new ArrayBuffer(8), header: { 'Content-Type': 'image/png' } });
    },
    downloadFile() { downloadCalls++; },
  };
  const { downloadPrivateFile } = loadApi(uni);
  const result = await downloadPrivateFile('/api/private-files/abc');
  assert.equal(requestOptions.url, 'https://panpan.xpytt.com/api/private-files/abc');
  assert.equal(requestOptions.responseType, 'arraybuffer');
  assert.equal(requestOptions.header.Authorization, 'Bearer teacher-token');
  assert.match(result, /^\/wx-user\/panpan-private-.+\.png$/);
  assert.ok(written.data instanceof ArrayBuffer);
  assert.equal(downloadCalls, 0);
});

test('request 通道不可用时回退到 downloadFile', async () => {
  const uni = {
    env: { USER_DATA_PATH: '/wx-user' },
    getStorageSync: () => 'teacher-token',
    removeStorageSync: () => {},
    getFileSystemManager: () => ({ writeFile() {} }),
    request(options) { options.fail({ errMsg: 'request:fail' }); },
    downloadFile(options) { options.success({ statusCode: 200, tempFilePath: '/tmp/fallback.jpg' }); },
  };
  const { downloadPrivateFile } = loadApi(uni);
  assert.equal(await downloadPrivateFile('/api/private-files/abc'), '/tmp/fallback.jpg');
});

test('private photo download must reject instead of hanging when the native callback never arrives', async () => {
  const uni = {
    env: { USER_DATA_PATH: '/wx-user' },
    getStorageSync: () => 'teacher-token',
    removeStorageSync: () => {},
    getFileSystemManager: () => ({ writeFile() {} }),
    request() {},
    downloadFile() {},
  };
  const immediateTimers = {
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
  };
  const { downloadPrivateFile } = loadApi(uni, immediateTimers);
  const outcome = await Promise.race([
    downloadPrivateFile('/api/private-files/abc').then(() => 'resolved', () => 'rejected'),
    new Promise((resolve) => setTimeout(() => resolve('hung'), 40)),
  ]);
  assert.equal(outcome, 'rejected');
});

test('private photo download falls back when writing the request buffer never completes', async () => {
  const uni = {
    env: { USER_DATA_PATH: '/wx-user' },
    getStorageSync: () => 'teacher-token',
    removeStorageSync: () => {},
    getFileSystemManager: () => ({ writeFile() {} }),
    request(options) {
      options.success({ statusCode: 200, data: new ArrayBuffer(8), header: { 'Content-Type': 'image/jpeg' } });
    },
    downloadFile(options) {
      options.success({ statusCode: 200, tempFilePath: '/tmp/write-timeout-fallback.jpg' });
    },
  };
  const immediateTimers = {
    setTimeout(callback) { queueMicrotask(callback); return 1; },
    clearTimeout() {},
  };
  const { downloadPrivateFile } = loadApi(uni, immediateTimers);
  assert.equal(
    await downloadPrivateFile('/api/private-files/abc'),
    '/tmp/write-timeout-fallback.jpg',
  );
});

test('private photo download preserves HTTP errors instead of retrying the same URL through downloadFile', async () => {
  let downloadCalls = 0;
  const uni = {
    env: { USER_DATA_PATH: '/wx-user' },
    getStorageSync: () => 'teacher-token',
    removeStorageSync: () => {},
    getFileSystemManager: () => ({ writeFile() {} }),
    request(options) {
      options.success({ statusCode: 404, data: {}, header: {} });
    },
    downloadFile() { downloadCalls += 1; },
  };
  const { downloadPrivateFile } = loadApi(uni);
  await assert.rejects(
    downloadPrivateFile('/api/private-files/missing'),
    (error) => Number(error.statusCode) === 404,
  );
  assert.equal(downloadCalls, 0);
});
