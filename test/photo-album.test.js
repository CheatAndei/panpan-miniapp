const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadPhotoAlbum() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'utils', 'photo-album.js'), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

function asyncSuccess(methods, calls) {
  return (options) => {
    calls.push(options);
    methods.push(options);
    options.success({});
  };
}

test('saveImageToAlbum requests album access once before saving', async () => {
  const calls = [];
  global.uni = {
    getSetting: asyncSuccess([], calls),
    authorize: asyncSuccess([], calls),
    saveImageToPhotosAlbum: asyncSuccess([], calls),
  };
  const { saveImageToAlbum } = await loadPhotoAlbum();
  await saveImageToAlbum('wxfile://tmp/card.png');
  assert.deepEqual(calls.map((item) => item.scope || item.filePath), [undefined, 'scope.writePhotosAlbum', 'wxfile://tmp/card.png']);
  delete global.uni;
});

test('saveImageToAlbum skips authorization when album access already exists', async () => {
  const calls = [];
  global.uni = {
    getSetting(options) {
      calls.push(options);
      options.success({ authSetting: { 'scope.writePhotosAlbum': true } });
    },
    authorize() { throw new Error('authorization should be skipped'); },
    saveImageToPhotosAlbum: asyncSuccess([], calls),
  };
  const { saveImageToAlbum } = await loadPhotoAlbum();
  await saveImageToAlbum('wxfile://tmp/card.png');
  assert.deepEqual(calls.map((item) => item.scope || item.filePath), [undefined, 'wxfile://tmp/card.png']);
  delete global.uni;
});

test('privacy authorization failures are routed to the permission recovery UI', async () => {
  const { isAlbumPermissionError } = await loadPhotoAlbum();
  assert.equal(isAlbumPermissionError({ errMsg: 'saveImageToPhotosAlbum:fail privacy permission is not authorized' }), true);
});

test('mini program does not declare unsupported photo-album APIs in requiredPrivateInfos', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
  assert.equal(manifest['mp-weixin'].requiredPrivateInfos, undefined);
});
