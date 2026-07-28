const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadPosterModule(uni) {
  const file = path.join(root, 'utils', 'achievement-poster.js');
  const source = fs.readFileSync(file, 'utf8')
    .replace(
      "import { isAlbumPermissionError, saveImageToAlbum } from './photo-album';",
      'const isAlbumPermissionError = () => false; const saveImageToAlbum = async (filePath) => filePath;',
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
    `${source}\nmodule.exports = { renderAchievementPoster, ACHIEVEMENT_POSTER_WIDTH, ACHIEVEMENT_POSTER_HEIGHT };`,
    context,
    { filename: file },
  );
  return context.module.exports;
}

function createPosterHarness() {
  const colors = [];
  const texts = [];
  let exportOptions = null;
  const context = {
    setFillStyle(value) { colors.push(String(value)); },
    fillRect() {},
    setFontSize() {},
    setTextAlign() {},
    fillText(value) { texts.push(String(value)); },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    fill() {},
    drawImage() {},
    measureText(value) { return { width: String(value).length * 24 }; },
    draw(_reserve, callback) { callback(); },
  };
  const uni = {
    getImageInfo({ src, success }) {
      success({ path: src });
    },
    createCanvasContext() {
      return context;
    },
    canvasToTempFilePath(options) {
      exportOptions = options;
      options.success({ tempFilePath: 'wxfile://achievement-light.png' });
    },
  };
  return {
    uni,
    colors,
    texts,
    getExportOptions: () => exportOptions,
  };
}

async function renderCategory(category, overrides = {}) {
  const harness = createPosterHarness();
  const module = loadPosterModule(harness.uni);
  const filePath = await module.renderAchievementPoster({
    achievement: {
      category,
      title: '学习成就',
      display_name: '陈同学',
      headline: '真实完成新的学习里程碑',
      completed_count: 30,
      correct_count: 28,
      source_count: 3,
      accuracy: 95,
      elapsed_seconds: 46,
      score: 980,
      rank: 1,
      passed_count: 2,
      source_label: '潘潘老师精选',
      question_title: '一道值得反复思考的压轴题',
      ...overrides,
    },
    codePath: 'wxfile://code.png',
  });
  return { ...harness, module, filePath };
}

test('通用成就工作台使用暖白青绿教学风并保留三类选择', () => {
  const page = read('pages/achievements/index.vue');
  assert.match(page, /PANPAN · LEARNING NOTES/);
  assert.match(page, /background-color:\s*var\(--page-bg\)/);
  assert.match(page, /#F8FCF9/);
  assert.match(page, /#20B486/);
  assert.match(page, /#15946D/);
  assert.match(page, /#26352F/);
  assert.match(page, /category-choice/);
  assert.match(page, /category-mental/);
  assert.match(page, /category-challenge/);
  assert.match(page, /选择刷题王/);
  assert.match(page, /口算王/);
  assert.match(page, /压轴挑战/);
  assert.doesNotMatch(page, /#173A36|#183A36|#315D56|#2F7D6B|#3268D6|#527CC9|#F2C94C|#FFC94A/);
});

test('工作台覆盖加载、空、错误、生成、保存、禁用与相册拒权恢复', () => {
  const page = read('pages/achievements/index.vue');
  assert.match(page, /v-if="loading"/);
  assert.match(page, /!items\.length/);
  assert.match(page, /type="error"/);
  assert.match(page, /v-if="generating"/);
  assert.match(page, /v-else-if="saving"/);
  assert.match(page, /:disabled="busy/);
  assert.match(page, /albumPermissionBlocked/);
  assert.match(page, /scope\.writePhotosAlbum/);
  assert.match(page, /openAlbumSettings/);
  assert.match(page, /返回后会自动重试/);
  assert.match(page, /\.student-challenge-page \.achievement-card,[\s\S]*?min-height:\s*0;/);
  assert.match(page, /prefers-reduced-motion:\s*reduce/);
});

test('公开隐私文案、匿名名、小程序码与真实数据 API 链路保持不变', () => {
  const page = read('pages/achievements/index.vue');
  const poster = read('utils/achievement-poster.js');
  assert.match(page, /只显示“姓＋同学”，不展示学校和班级/);
  assert.match(page, /不含学生照片、全名、学校、班级/);
  assert.match(page, /api\.downloadPrivate/);
  assert.match(page, /\/code\?student_id=/);
  assert.match(page, /\/seen/);
  assert.match(poster, /achievement\.display_name/);
  assert.match(poster, /真实学习数据/);
  assert.match(poster, /公开海报仅显示匿名学习数据/);
  assert.match(poster, /扫码免费体验/);
  assert.match(poster, /saveImageToAlbum/);
});

test('Canvas 保持 750×1000 到 1080×1440，并按三类应用独立浅色强调色', async () => {
  const choice = await renderCategory('choice');
  const mental = await renderCategory('mental');
  const challenge = await renderCategory('challenge');
  for (const rendered of [choice, mental, challenge]) {
    assert.equal(rendered.filePath, 'wxfile://achievement-light.png');
    assert.equal(rendered.module.ACHIEVEMENT_POSTER_WIDTH, 750);
    assert.equal(rendered.module.ACHIEVEMENT_POSTER_HEIGHT, 1000);
    assert.equal(rendered.getExportOptions().width, 750);
    assert.equal(rendered.getExportOptions().height, 1000);
    assert.equal(rendered.getExportOptions().destWidth, 1080);
    assert.equal(rendered.getExportOptions().destHeight, 1440);
    assert.ok(rendered.colors.includes('#F8FCF9'));
    assert.ok(rendered.colors.includes('#FFFFFF'));
    assert.ok(rendered.texts.includes('陈同学'));
    assert.ok(rendered.texts.includes('真实学习数据 · 隐私友好展示'));
    assert.ok(rendered.texts.includes('扫码免费体验'));
  }
  assert.ok(choice.colors.includes('#15946D'));
  assert.ok(choice.colors.includes('#FF7468'));
  assert.ok(mental.colors.includes('#20B486'));
  assert.ok(mental.colors.includes('#D94B45'));
  assert.ok(challenge.colors.includes('#D94B45'));
  assert.ok(challenge.colors.includes('#E7F8F1'));
});

test('较长的成就指标按实际宽度截断，不会越出指标卡', async () => {
  const sourceLabel = '广州市越秀区七年级第二学期期末质量检测压轴精选';
  const challenge = await renderCategory('challenge', { source_label: sourceLabel });
  assert.ok(!challenge.texts.includes(sourceLabel));
  assert.ok(challenge.texts.some((text) => text.endsWith('…')));
});
