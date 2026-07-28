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
    `${source}\nmodule.exports = { renderPracticeReviewPoster, practicePhotoLayouts };`,
    context,
    { filename: file },
  );
  return context.module.exports;
}

function createPosterHarness() {
  const texts = [];
  const fillStyles = [];
  const imageSources = [];
  const drawImages = [];
  const exportOptions = [];
  const context = {
    setFillStyle(value) { fillStyles.push(value); },
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
    drawImage(...args) { drawImages.push(args); },
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
      imageSources.push(src);
      success({ path: src, width: 600, height: 800, orientation: 'up' });
    },
    createCanvasContext() {
      return context;
    },
    canvasToTempFilePath(options) {
      exportOptions.push(options);
      options.success({ tempFilePath: 'wxfile://practice-review-poster.png' });
    },
  };
  return {
    uni,
    texts,
    fillStyles,
    imageSources,
    drawImages,
    exportOptions,
  };
}

async function renderPoster(options = {}) {
  const harness = createPosterHarness();
  const { renderPracticeReviewPoster } = loadPosterModule(harness.uni);
  const filePath = await renderPracticeReviewPoster({
    studentName: '小满',
    practiceDate: '2026-07-26',
    photoPaths: ['wxfile://homework.jpg'],
    ...options,
  });
  assert.equal(filePath, 'wxfile://practice-review-poster.png');
  return harness;
}

async function renderTexts(options = {}) {
  const harness = await renderPoster(options);
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

test('1 至 4 张作业照片使用不同且不重叠的动态网格', () => {
  const { practicePhotoLayouts } = loadPosterModule(createPosterHarness().uni);

  for (let count = 1; count <= 4; count += 1) {
    const layouts = practicePhotoLayouts(count);
    assert.equal(layouts.length, count);
    assert.equal(new Set(layouts.map((item) => JSON.stringify(item))).size, count);
    for (const layout of layouts) {
      assert.ok(layout.x >= 48 && layout.y >= 234);
      assert.ok(layout.x + layout.w <= 486);
      assert.ok(layout.y + layout.h <= 872);
    }
    for (let left = 0; left < layouts.length; left += 1) {
      for (let right = left + 1; right < layouts.length; right += 1) {
        const a = layouts[left];
        const b = layouts[right];
        const overlaps = a.x < b.x + b.w
          && a.x + a.w > b.x
          && a.y < b.y + b.h
          && a.y + a.h > b.y;
        assert.equal(overlaps, false);
      }
    }
  }
});

test('海报只读取和绘制前四张照片', async () => {
  const photoPaths = Array.from({ length: 6 }, (_, index) => `wxfile://homework-${index + 1}.jpg`);
  const harness = await renderPoster({ photoPaths });

  assert.deepEqual(harness.imageSources, photoPaths.slice(0, 4));
  assert.equal(harness.drawImages.length, 4);
  assert.ok(harness.texts.join('').includes('展示前 4 / 6 张'));
});

test('首次有错时显示正确题数、总题数、轮次与待订正状态', async () => {
  const texts = await renderTexts({
    totalCount: 10,
    correctCount: 8,
    wrongNumbers: [2, 7],
  });
  const rendered = texts.join('');

  assert.ok(rendered.includes('正确 / 总题'));
  assert.ok(rendered.includes('8 / 10'));
  assert.ok(rendered.includes('首次批改'));
  assert.ok(rendered.includes('待订正'));
  assert.ok(rendered.includes('错 2 题'));
  assert.ok(!rendered.includes('本轮错题已订正'));
});

test('长姓名与长错题号会安全截断', async () => {
  const studentName = '这是一个非常非常长需要安全截断的小朋友姓名';
  const wrongNumbers = Array.from({ length: 30 }, (_, index) => index + 1);
  const texts = await renderTexts({
    studentName,
    totalCount: 40,
    correctCount: 10,
    wrongNumbers,
  });
  const rendered = texts.join('');
  const completeWrongList = wrongNumbers.join('、');

  assert.ok(rendered.includes('…'));
  assert.ok(!rendered.includes(studentName));
  assert.ok(!rendered.includes(completeWrongList));
});

test('海报使用浅蓝白练习册色系并保持 750×1000 逻辑画布与 2 倍导出', async () => {
  const file = path.join(__dirname, '..', 'utils', 'practice-review-poster.js');
  const source = fs.readFileSync(file, 'utf8');
  const harness = await renderPoster();
  const options = harness.exportOptions[0];

  assert.match(source, /#F6FAFF/);
  assert.match(source, /#527CC9/);
  assert.match(source, /#FFFFFF/);
  assert.match(source, /drawCover\([\s\S]*?'contain'/u);
  assert.doesNotMatch(source, /total === 1 \? 'cover'/);
  assert.doesNotMatch(source, /#173A35|#E9D8BC|#F7F0E5/);
  assert.equal(options.width, 750);
  assert.equal(options.height, 1000);
  assert.equal(options.destWidth, 1500);
  assert.equal(options.destHeight, 2000);
});
