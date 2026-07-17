const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApi(uni) {
  const filename = path.join(__dirname, '..', 'utils', 'api.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export\s+default\s+BASE;?/g, '')
    .replace(/export\s+/g, '')
    + '\nmodule.exports = { downloadPrivateFile };';
  const context = {
    module: { exports: {} }, exports: {}, uni, wx: { env: { USER_DATA_PATH: '/wx-user' } },
    BASE: 'https://panpan.xpytt.com/api', ASSET_BASE: 'https://panpan.xpytt.com',
    Map, Promise, Error, Set, Object, String, RegExp, Date, Math, JSON, setTimeout,
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
