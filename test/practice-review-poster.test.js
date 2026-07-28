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
    `${source}\nmodule.exports = {
      renderPracticeReviewPoster,
      practicePhotoLayouts,
      pickPracticeReviewMessage,
      PRACTICE_ALL_CORRECT_MESSAGES,
      PRACTICE_NEEDS_WORK_MESSAGES,
      PRACTICE_ENCOURAGEMENT_MESSAGES
    };`,
    context,
    { filename: file },
  );
  return context.module.exports;
}

function createPosterHarness() {
  const texts = [];
  const fillStyles = [];
  const fillRects = [];
  const imageSources = [];
  const drawImages = [];
  const exportOptions = [];
  let currentFillStyle = '';
  const context = {
    setFillStyle(value) {
      currentFillStyle = value;
      fillStyles.push(value);
    },
    fillRect(x, y, width, height) {
      fillRects.push({ color: currentFillStyle, x, y, width, height });
    },
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
    fillRects,
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

test('首次批改全对时使用全对随机池并保持参数向后兼容', async () => {
  const texts = await renderTexts();
  const rendered = texts.join('');
  const { PRACTICE_ALL_CORRECT_MESSAGES, PRACTICE_ENCOURAGEMENT_MESSAGES } = loadPosterModule(
    createPosterHarness().uni,
  );

  assert.ok(rendered.includes('PANPAN · DAILY PRACTICE'));
  assert.ok(rendered.includes('小满的打卡记录'));
  assert.ok(rendered.includes('批改结果'));
  assert.ok(rendered.includes('全对'));
  assert.ok(rendered.includes('作答情况'));
  assert.ok(rendered.includes('本次题目全部正确'));
  assert.ok(PRACTICE_ALL_CORRECT_MESSAGES.some((message) => rendered.includes(message)));
  assert.ok(PRACTICE_ENCOURAGEMENT_MESSAGES.some((message) => rendered.includes(message)));
  assert.ok(rendered.includes('任课老师批改'));
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
  assert.ok(rendered.includes('订正结果'));
  assert.ok(rendered.includes('已订正'));
  assert.ok(rendered.includes('第 2 轮'));
  assert.ok(rendered.includes('本轮错题已订正'));
  assert.ok(rendered.includes('订正轮次 2'));
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

test('全对、有错和底栏鼓励各有 100 条不重复文案，洗牌袋轮完前不复用', () => {
  const {
    pickPracticeReviewMessage,
    PRACTICE_ALL_CORRECT_MESSAGES,
    PRACTICE_NEEDS_WORK_MESSAGES,
    PRACTICE_ENCOURAGEMENT_MESSAGES,
  } = loadPosterModule(createPosterHarness().uni);

  for (const pool of [
    PRACTICE_ALL_CORRECT_MESSAGES,
    PRACTICE_NEEDS_WORK_MESSAGES,
    PRACTICE_ENCOURAGEMENT_MESSAGES,
  ]) {
    assert.equal(pool.length, 100);
    assert.equal(new Set(pool).size, 100);
  }

  const draws = Array.from(
    { length: 100 },
    () => pickPracticeReviewMessage(PRACTICE_ALL_CORRECT_MESSAGES, 'test-all-correct'),
  );
  assert.equal(new Set(draws).size, 100);
  const next = pickPracticeReviewMessage(PRACTICE_ALL_CORRECT_MESSAGES, 'test-all-correct');
  assert.notEqual(next, draws.at(-1));
});

test('海报移除隐私说明，左下角为随机鼓励，右下角为老师签名', async () => {
  const texts = await renderTexts({ teacherName: '潘潘老师' });
  const rendered = texts.join('');
  const { PRACTICE_ENCOURAGEMENT_MESSAGES } = loadPosterModule(createPosterHarness().uni);

  assert.ok(PRACTICE_ENCOURAGEMENT_MESSAGES.some((message) => rendered.includes(message)));
  assert.ok(rendered.includes('潘潘老师批改'));
  assert.ok(!rendered.includes('PRIVATE REVIEW'));
  assert.ok(!rendered.includes('私密批改记录'));
  assert.ok(!rendered.includes('仅供私下查看'));
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

test('海报使用暖白、青绿与少量珊瑚的统一配色并保持 750×1000 逻辑画布与 2 倍导出', async () => {
  const file = path.join(__dirname, '..', 'utils', 'practice-review-poster.js');
  const source = fs.readFileSync(file, 'utf8');
  const harness = await renderPoster();
  const options = harness.exportOptions[0];

  assert.match(source, /#F8FCF9/);
  assert.match(source, /#20B486/);
  assert.match(source, /#15946D/);
  assert.match(source, /#FF7468/);
  assert.match(source, /#FFF0EE/);
  assert.match(source, /#26352F/);
  assert.match(source, /#FFFFFF/);
  assert.match(source, /drawCover\([\s\S]*?'contain'/u);
  assert.doesNotMatch(source, /total === 1 \? 'cover'/);
  assert.doesNotMatch(source, /#3268D6|#1E4EA8|#315EA8|#527CC9|#24324A/iu);
  assert.doesNotMatch(source, /#FFC94A|#FFF4C2|#5B9DF7|#EAF3FF|#337BD8|#B27600/iu);
  assert.doesNotMatch(source, /#173A35|#E9D8BC|#F7F0E5/iu);
  assert.equal(options.width, 750);
  assert.equal(options.height, 1000);
  assert.equal(options.destWidth, 1500);
  assert.equal(options.destHeight, 2000);
});

test('海报使用明显青绿大色面，珊瑚只承担状态与签名，并区分全对与有错', async () => {
  const allCorrect = await renderPoster({ totalCount: 10, correctCount: 10 });
  const needsWork = await renderPoster({
    totalCount: 10,
    correctCount: 8,
    wrongNumbers: [2, 7],
  });
  const hasLargePanel = (harness, color, minimumArea = 20000) => harness.fillRects.some(
    (rect) => rect.color === color && rect.width * rect.height >= minimumArea,
  );

  for (const harness of [allCorrect, needsWork]) {
    assert.ok(hasLargePanel(harness, '#20B486'));
    assert.ok(hasLargePanel(harness, '#FF7468', 15000));
    assert.equal(harness.fillRects.some((rect) => ['#FFC94A', '#5B9DF7'].includes(rect.color)), false);
  }
  assert.ok(hasLargePanel(allCorrect, '#20B486', 24000));
  assert.ok(hasLargePanel(allCorrect, '#E7F8F1', 100000));
  assert.ok(hasLargePanel(needsWork, '#FF7468', 20000));
  assert.equal(
    allCorrect.fillRects.some((rect) => rect.color === '#FFF0EE' && rect.width === 202),
    false,
  );
  assert.equal(
    needsWork.fillRects.some((rect) => rect.color === '#FFF0EE' && rect.width === 202),
    true,
  );
});
