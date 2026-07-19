const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('家长首页、学习中心和成长页构成三段式导航且没有学生模式', () => {
  const pages = read('pages.json');
  const home = read('pages/index/index.vue');
  const learning = read('pages/learning-center/index.vue');
  const growth = read('pages/growth/index.vue');
  for (const page of ['pages/learning-center/index', 'pages/learning-session/index', 'pages/growth/index']) {
    assert.match(pages, new RegExp(page));
  }
  for (const source of [home, learning, growth]) {
    assert.match(source, />今日</);
    assert.match(source, />学习</);
    assert.match(source, />成长</);
    assert.doesNotMatch(source, /学生模式|学生账号|切换学生端/);
  }
});

test('今日三任务、学习内容与错题两次掌握规则均有明确呈现', () => {
  const home = read('pages/index/index.vue');
  const learning = read('pages/learning-center/index.vue');
  const learningService = read('backend/services/learning.js');
  const session = read('pages/learning-session/index.vue');
  assert.match(home, /今日学习任务/);
  assert.match(home, /learningToday\.tasks/);
  for (const copy of ['每日 5 题热身', '薄弱点刷题', '错题清零', '压轴挑战', '广州真题大全', '周末小测', '口算王']) {
    assert.match(learning + learningService, new RegExp(copy));
  }
  assert.match(session, /连续答对 2 次/);
  assert.match(session, /correct_answer/);
});

test('成长页包含日历、周统计、薄弱项、六徽章、周报和匿名分享', () => {
  const growth = read('pages/growth/index.vue');
  for (const copy of ['近 14 天', '本周概览', '错题掌握', '成长徽章', '本周学习周报', '匿名分享']) {
    assert.match(growth, new RegExp(copy));
  }
  assert.match(growth, /summary\.badges/);
  assert.match(growth, /open-type="share"/);
  assert.match(growth, /path: '\/pages\/index\/index'/);
});
