const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const posterFile = path.join(root, 'utils', 'weekend-mastery-poster.js');

function loadPosterModule(uni, albumHarness = {}) {
  const source = fs.readFileSync(posterFile, 'utf8')
    .replace(
      "import { isAlbumPermissionError, saveImageToAlbum } from './photo-album';",
      `const saveImageToAlbum = async (filePath) => {
        albumHarness.savedPath = filePath;
        return filePath;
      };
      const isAlbumPermissionError = (error) => /permission/i.test(String(error?.message || error || ''));`,
    )
    .replace(/\bexport\s+(?=(?:async\s+)?function|const)/g, '');
  const context = {
    module: { exports: {} },
    exports: {},
    albumHarness,
    uni,
    setTimeout(callback) {
      callback();
      return 0;
    },
  };
  vm.runInNewContext(
    `${source}\nmodule.exports = {
      renderWeekendMasteryPoster,
      saveWeekendMasteryPoster,
      albumPermissionDenied,
      WEEKEND_MASTERY_POSTER_WIDTH,
      WEEKEND_MASTERY_POSTER_HEIGHT,
    };`,
    context,
    { filename: posterFile },
  );
  return context.module.exports;
}

function createCanvasHarness() {
  const texts = [];
  const colors = [];
  let exportOptions = null;
  const context = {
    setFillStyle(value) { colors.push(String(value)); },
    setStrokeStyle(value) { colors.push(String(value)); },
    setLineWidth() {},
    setFontSize() {},
    setTextAlign() {},
    fillRect() {},
    fillText(value) { texts.push(String(value)); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    arc() {},
    fill() {},
    stroke() {},
    measureText(value) { return { width: String(value).length * 20 }; },
    draw(_reserve, callback) { callback(); },
  };
  const uni = {
    createCanvasContext() {
      return context;
    },
    canvasToTempFilePath(options) {
      exportOptions = options;
      options.success({ tempFilePath: 'wxfile://weekend-mastery.png' });
    },
  };
  return {
    uni,
    texts,
    colors,
    getExportOptions: () => exportOptions,
  };
}

test('周末攻坚战海报保留学生完整姓名并展示双关信息', async () => {
  const harness = createCanvasHarness();
  const poster = loadPosterModule(harness.uni);
  const filePath = await poster.renderWeekendMasteryPoster({
    studentName: '欧阳严木',
    periodLabel: '2026.08.14 — 2026.08.20',
    stages: [
      { topic: '找规律与字母式', difficulty: '适中' },
      { topic: '配对规律综合应用', difficulty: '偏难' },
    ],
  });

  assert.equal(filePath, 'wxfile://weekend-mastery.png');
  assert.ok(harness.texts.includes('欧阳严木'));
  assert.ok(harness.texts.includes('周末攻坚战'));
  assert.ok(harness.texts.includes('两关均通过'));
  assert.ok(harness.texts.includes('2026.08.14 — 2026.08.20'));
  assert.ok(harness.texts.includes('找规律与字母式'));
  assert.ok(harness.texts.includes('配对规律综合应用'));
  assert.ok(harness.texts.includes('适中'));
  assert.ok(harness.texts.includes('偏难'));
  assert.ok(harness.texts.includes('训练营通关证书'));
});

test('海报以 720×960 画布导出 1080×1440 高清图片', async () => {
  const harness = createCanvasHarness();
  const poster = loadPosterModule(harness.uni);
  await poster.renderWeekendMasteryPoster({
    studentName: '严木',
    periodStart: '2026-08-14T01:00:00+08:00',
    periodEnd: '2026-08-21T00:59:59+08:00',
  });

  const options = harness.getExportOptions();
  assert.equal(poster.WEEKEND_MASTERY_POSTER_WIDTH, 720);
  assert.equal(poster.WEEKEND_MASTERY_POSTER_HEIGHT, 960);
  assert.equal(options.width, 720);
  assert.equal(options.height, 960);
  assert.equal(options.destWidth, 1080);
  assert.equal(options.destHeight, 1440);
  assert.equal(options.fileType, 'png');
  assert.ok(harness.colors.includes('#FFF48A'));
  assert.ok(harness.colors.includes('#050505'));
  assert.ok(harness.colors.includes('#99DEF4'));
});

test('独立训练营海报不复用其他战报文案、题图或扫码模块', async () => {
  const harness = createCanvasHarness();
  const poster = loadPosterModule(harness.uni);
  await poster.renderWeekendMasteryPoster({ studentName: '严木' });
  const renderedText = harness.texts.join('\n');
  const source = fs.readFileSync(posterFile, 'utf8');

  for (const forbidden of [
    '压轴挑战',
    'BREAKTHROUGH REPORT',
    'VERIFIED',
    '累计通关',
    '扫码',
    '二维码',
  ]) {
    assert.doesNotMatch(renderedText, new RegExp(forbidden));
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
  assert.doesNotMatch(source, /questionImage|drawImage|codePath|#F39A6B|#FFE2D1|#D66D62/);
});

test('保存与相册拒权判断复用统一相册工具', async () => {
  const harness = createCanvasHarness();
  const albumHarness = {};
  const poster = loadPosterModule(harness.uni, albumHarness);
  const saved = await poster.saveWeekendMasteryPoster('wxfile://weekend-mastery.png');

  assert.equal(saved, 'wxfile://weekend-mastery.png');
  assert.equal(albumHarness.savedPath, 'wxfile://weekend-mastery.png');
  assert.equal(poster.albumPermissionDenied(new Error('permission denied')), true);
  assert.equal(poster.albumPermissionDenied(new Error('network error')), false);
  const source = fs.readFileSync(posterFile, 'utf8');
  assert.match(source, /saveImageToAlbum/);
  assert.match(source, /isAlbumPermissionError/);
  assert.match(source, /\.\/photo-album/);
});
