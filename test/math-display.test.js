const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadMathDisplay() {
  const filename = path.join(root, 'utils', 'math-display.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/export\s+/g, '')
    + '\nmodule.exports = { parseMathSegments };';
  const context = { module: { exports: {} }, exports: {}, String, RegExp };
  vm.runInNewContext(source, context, { filename });
  return context.module.exports;
}

test('数学展示把普通分数和负分数拆成上下结构数据', () => {
  const { parseMathSegments } = loadMathDisplay();
  const fractions = parseMathSegments('1/2 + (−3/4) = ?').filter((item) => item.type === 'fraction');
  assert.deepEqual(JSON.parse(JSON.stringify(fractions)), [
    { type: 'fraction', numerator: '1', denominator: '2', label: '2 分之 1' },
    { type: 'fraction', numerator: '−3', denominator: '4', label: '4 分之 −3' },
  ]);
});

test('数学展示支持复杂分母且不会误伤日期', () => {
  const { parseMathSegments } = loadMathDisplay();
  const complex = parseMathSegments('1/(1×2)+a/b');
  assert.equal(complex.filter((item) => item.type === 'fraction').length, 2);
  assert.equal(complex.find((item) => item.type === 'fraction').denominator, '1×2');
  assert.deepEqual(JSON.parse(JSON.stringify(parseMathSegments('2026-07-22'))), [
    { type: 'text', value: '2026-07-22' },
  ]);
});

test('分式组件使用真实分数线并保留原字符串无障碍标签', () => {
  const component = fs.readFileSync(path.join(root, 'components/pp-math-text/pp-math-text.vue'), 'utf8');
  assert.match(component, /math-numerator/);
  assert.match(component, /math-denominator/);
  assert.match(component, /border-bottom:2rpx solid currentColor/);
  assert.match(component, /:aria-label="source"/);
});

test('题目、答案和教师批改页统一使用分式组件，输入仍保留斜杠', () => {
  const pages = [
    'pages/mental-arena/challenge.vue',
    'pages/mental-arena/result.vue',
    'pages/learning-session/index.vue',
    'pages/practice-parent/index.vue',
    'pages/practice-teacher/index.vue',
    'pages/choice-king/index.vue',
    'pages/knowledge-challenge/index.vue',
    'pages/choice-reports/index.vue',
    'pages/weekly-review/index.vue',
  ];
  for (const page of pages) {
    const source = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(source, /pp-math-text/, page);
  }
  const challenge = fs.readFileSync(path.join(root, 'pages/mental-arena/challenge.vue'), 'utf8');
  assert.match(challenge, /分数可输入 1\/2/);
});
