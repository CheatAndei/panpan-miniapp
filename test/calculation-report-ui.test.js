const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('口算和学习计算题作答页、结果页都有报错入口', () => {
  for (const file of [
    'pages/mental-arena/challenge.vue',
    'pages/mental-arena/result.vue',
    'pages/learning-session/index.vue',
  ]) {
    const source = read(file);
    assert.match(source, /question-report-sheet/u, file);
    assert.match(source, /题目有问题/u, file);
  }
  const learning = read('pages/learning-session/index.vue');
  assert.match(learning, /reportQuestion=currentQuestion/u);
  assert.match(learning, /reportQuestion=item/u);
});

test('报错面板限制 200 字且不会调用暂停计时', () => {
  const source = read('components/question-report-sheet/question-report-sheet.vue');
  assert.match(source, /:maxlength="200"/u);
  assert.match(source, /sign_bracket/u);
  assert.match(source, /\/calculation-reports/u);
  assert.doesNotMatch(source, /stopTimer|pause/u);
});

test('教师报错队列统一支持三类题目和停题', () => {
  const source = read('pages/choice-reports/index.vue');
  assert.match(source, /题目报错处理/u);
  assert.match(source, /mental_challenge/u);
  assert.match(source, /learning_attempt/u);
  assert.match(source, /stop_question/u);
  assert.match(source, /多人反馈/u);
});
