const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const review = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'practice-review', 'index.vue'),
  'utf8',
);
const style = review.match(/<style scoped>([\s\S]*?)<\/style>/u)?.[1] || '';
const cssRules = [...style.matchAll(/([^{}]+)\{([^{}]*)\}/gu)];

function declarationsFor(selector) {
  return cssRules
    .filter(([, selectors]) => selectors.split(',').map((item) => item.trim()).includes(selector))
    .map(([, , declarations]) => declarations)
    .join('\n');
}

test('翻页与图片操作按钮只保留单一触控高度，不再叠加垂直 padding', () => {
  for (const selector of [
    '.queue-controls button',
    '.photo-nav button',
    '.photo-actions button',
  ]) {
    const declarations = declarationsFor(selector);
    assert.match(declarations, /min-height:\s*88rpx;/u, `${selector} 应保留 44px 左右触控目标`);
    assert.match(declarations, /padding:\s*0\s+\d+rpx;/u, `${selector} 不应再叠加垂直 padding`);
    assert.match(declarations, /display:\s*flex;/u);
    assert.match(declarations, /align-items:\s*center;/u);
    assert.match(declarations, /justify-content:\s*center;/u);
    assert.doesNotMatch(declarations, /min-height:\s*112rpx;/u);
  }

  assert.doesNotMatch(
    style,
    /\.queue-controls button,\s*\.photo-nav button,\s*\.footer-actions button\s*\{[\s\S]*?min-height:/u,
  );
  assert.match(declarationsFor('.photo-actions button'), /min-width:\s*0;/u);
  assert.match(declarationsFor('.photo-actions button'), /white-space:\s*nowrap;/u);
});

test('标准答案短题卡显式重置原生按钮高度并按内容顶部对齐', () => {
  const trackDeclarations = declarationsFor('.answer-track');
  const rowDeclarations = declarationsFor('.answer-row');

  assert.match(trackDeclarations, /align-items:\s*flex-start;/u);
  assert.doesNotMatch(trackDeclarations, /align-items:\s*stretch;/u);
  assert.match(rowDeclarations, /height:\s*auto\s*!important;/u);
  assert.match(rowDeclarations, /min-height:\s*0\s*!important;/u);
  assert.match(rowDeclarations, /align-self:\s*flex-start;/u);
  assert.match(rowDeclarations, /display:\s*flex;/u);
  assert.match(rowDeclarations, /flex-direction:\s*column;/u);
  assert.match(rowDeclarations, /justify-content:\s*flex-start;/u);
  assert.match(rowDeclarations, /padding:\s*14rpx 16rpx\s*!important;/u);
  assert.match(rowDeclarations, /width:\s*316rpx;/u);
  assert.match(rowDeclarations, /flex:\s*0 0 316rpx;/u);
});

test('历史批改没有照片时压缩空态，只有有图时保留稳定画布高度', () => {
  assert.match(
    review,
    /:class="\['photo-stage',\{empty:!activeSubmission\._photoPaths\.length\}\]"/u,
  );

  const stageDeclarations = declarationsFor('.photo-stage');
  const emptyDeclarations = declarationsFor('.photo-stage.empty');
  assert.match(stageDeclarations, /height:\s*720rpx;/u);
  assert.match(stageDeclarations, /box-sizing:\s*border-box;/u);
  assert.match(stageDeclarations, /padding:\s*0;/u);
  assert.match(emptyDeclarations, /height:\s*280rpx;/u);
  assert.match(emptyDeclarations, /min-height:\s*0;/u);

  const emptyHeight = Number(emptyDeclarations.match(/height:\s*(\d+)rpx/u)?.[1] || 0);
  assert.ok(
    emptyHeight >= 240 && emptyHeight <= 320,
    `空照片区应约为 120–160px，当前为 ${emptyHeight}rpx`,
  );
});

test('学生前后切换使用可收缩两列网格且按钮不会横向溢出', () => {
  const cardDeclarations = declarationsFor('.queue-card');
  const controlsDeclarations = declarationsFor('.queue-controls');
  const buttonDeclarations = declarationsFor('.queue-controls button');

  assert.match(cardDeclarations, /min-width:\s*0;/u);
  assert.match(cardDeclarations, /overflow:\s*hidden;/u);
  assert.match(controlsDeclarations, /display:\s*grid;/u);
  assert.match(
    controlsDeclarations,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/u,
  );
  assert.match(controlsDeclarations, /max-width:\s*100%;/u);
  assert.match(controlsDeclarations, /min-width:\s*0;/u);
  assert.match(controlsDeclarations, /overflow:\s*hidden;/u);
  assert.match(buttonDeclarations, /width:\s*100%;/u);
  assert.match(buttonDeclarations, /max-width:\s*100%;/u);
  assert.match(buttonDeclarations, /min-width:\s*0;/u);
  assert.match(buttonDeclarations, /box-sizing:\s*border-box;/u);
});

test('批改台恢复浅蓝珊瑚教学色板，同时保持紧凑圆角与无装饰光斑', () => {
  for (const color of ['#E5F8FE', '#0B789A', '#F79BC0', '#F7FCFE', '#050505']) {
    assert.match(style, new RegExp(color, 'u'));
  }
  assert.doesNotMatch(style, /#20B486|#15946D|#FF7468|#F8FCF9|#26352F/iu);
  assert.doesNotMatch(style, /radial-gradient/iu);

  const radii = [...style.matchAll(/border-radius:\s*([0-9.]+)rpx/gu)]
    .map((match) => Number(match[1]));
  assert.ok(radii.length > 0);
  assert.ok(Math.max(...radii) <= 16, `最大圆角不应超过 16rpx，当前为 ${Math.max(...radii)}rpx`);

  for (const [, value] of style.matchAll(/letter-spacing:\s*([^;]+);/gu)) {
    assert.equal(value.trim(), '0');
  }
});

test('布局修复未改变图片缩放拖动和旋转入口', () => {
  assert.match(review, /<movable-area[\s\S]*?<movable-view/u);
  assert.match(review, /direction="all"/u);
  assert.match(review, /:scale-min="1"/u);
  assert.match(review, /:scale-max="4"/u);
  assert.match(review, /@tap="resetCurrentPhoto"/u);
  assert.match(review, /@tap="rotateCurrentPhoto"/u);
});

test('照片放大后可拖动且松手不再惯性滑动或越界回弹', () => {
  assert.match(review, /:inertia="false"/u);
  assert.match(review, /:animation="false"/u);
  assert.match(review, /:out-of-bounds="false"/u);
  assert.match(review, /放大后拖动，松手停在当前位置/u);
  assert.doesNotMatch(review, /拖动松手后自然回弹/u);
});

test('批改台使用跨计划全局待批队列，顶部数量与前后翻页口径一致', () => {
  assert.match(review, /\/practice\/todos\?limit=\$\{pageSize\}&page=\$\{page\}&include_review=1/u);
  assert.match(review, /while \(queued\.length < expectedCount\)/u);
  assert.match(review, /new Map\(queued\.map\(\(item\) => \[Number\(item\.submission_id\), item\]\)\)/u);
  assert.match(review, /todoCount\.value = todos\.value\.length;/u);
  assert.match(review, /const prepared = todos\.value\.map\(prepareSubmission\);/u);
  assert.match(review, /submissions\.value = prepared;/u);
  assert.doesNotMatch(review, /function loadPlanSubmissions/u);
  assert.doesNotMatch(review, /status=submitted&limit=50&page=1/u);
});
