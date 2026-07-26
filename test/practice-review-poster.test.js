const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPosterModule(uni) {
  const file = path.join(__dirname, '..', 'utils', 'practice-review-poster.js');
  const source = fs.readFileSync(file, 'utf8')
    .replace(
      "import { saveImageToAlbum } from './photo-album';",
      'const saveImageToAlbum = async (filePath) => filePath;',
    )
    .replace(/\bexport\s+(?=(?:async\s+)?function|const)/g, '');
  const context = {
    module: { exports: {} },
    exports: {},
    uni,
    setTimeout(callback) {
      callback();
      return 0;
    },
  };
  vm.runInNewContext(
    `${source}\nmodule.exports = { renderPracticeReviewPoster };`,
    context,
    { filename: file },
  );
  return context.module.exports;
}

function createPosterHarness() {
  const texts = [];
  const context = {
    setFillStyle() {},
    fillRect() {},
    setFontSize() {},
    fillText(value) { texts.push(String(value)); },
    save() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate() {},
    rotate() {},
    scale() {},
    drawImage() {},
    restore() {},
    setStrokeStyle() {},
    setLineWidth() {},
    strokeRect() {},
    setShadow() {},
    measureText(value) { return { width: String(value).length * 24 }; },
    draw(_reserve, callback) { callback(); },
  };
  const uni = {
    getImageInfo({ src, success }) {
      success({ path: src, width: 600, height: 800, orientation: 'up' });
    },
    createCanvasContext() {
      return context;
    },
    canvasToTempFilePath({ success }) {
      success({ tempFilePath: 'wxfile://practice-review-poster.png' });
    },
  };
  return { uni, texts };
}

async function renderTexts(options = {}) {
  const harness = createPosterHarness();
  const { renderPracticeReviewPoster } = loadPosterModule(harness.uni);
  const filePath = await renderPracticeReviewPoster({
    studentName: '小满',
    practiceDate: '2026-07-26',
    photoPaths: ['wxfile://homework.jpg'],
    ...options,
  });
  assert.equal(filePath, 'wxfile://practice-review-poster.png');
  return harness.texts;
}

test('首次批改全对时保持原海报文案，新增参数向后兼容', async () => {
  const texts = await renderTexts();
  const rendered = texts.join('');

  assert.ok(rendered.includes('PANPAN · DAILY PRACTICE'));
  assert.ok(rendered.includes('小满的打卡记录'));
  assert.ok(rendered.includes('批改结果'));
  assert.ok(rendered.includes('全对'));
  assert.ok(rendered.includes('保持节奏'));
  assert.ok(rendered.includes('今天完成得很扎实'));
  assert.ok(rendered.includes('认真有回响，坚持会发光'));
  assert.ok(rendered.includes('学生记录'));
  assert.ok(!rendered.includes('本轮错题已订正'));
});

test('订正全对时按轮次生成及时订正海报', async () => {
  const texts = await renderTexts({
    isCorrection: true,
    correctionRound: 2,
  });
  const rendered = texts.join('');

  assert.ok(rendered.includes('PANPAN · TIMELY CORRECTION'));
  assert.ok(rendered.includes('小满的及时订正'));
  assert.ok(rendered.includes('及时订正'));
  assert.ok(rendered.includes('已订正'));
  assert.ok(rendered.includes('第 2 轮'));
  assert.ok(rendered.includes('本轮错题已订正'));
  assert.ok(rendered.includes('及时订正，进步看得见'));
  assert.ok(rendered.includes('订正记录'));
});

test('订正仍有错题时不误报本轮已订正', async () => {
  const texts = await renderTexts({
    isCorrection: true,
    correctionRound: 3,
    wrongNumbers: [3],
  });
  const rendered = texts.join('');

  assert.ok(rendered.includes('批改结果'));
  assert.ok(rendered.includes('错 1 题'));
  assert.ok(rendered.includes('错题号'));
  assert.ok(rendered.includes('3'));
  assert.ok(!rendered.includes('本轮错题已订正'));
  assert.ok(!rendered.includes('第 3 轮'));
});
