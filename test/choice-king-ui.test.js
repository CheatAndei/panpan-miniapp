const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('选择刷题王页面已注册并从学习中心进入', () => {
  const pages = read('pages.json');
  const learning = read('pages/learning-center/index.vue');
  for (const page of ['pages/choice-king/index', 'pages/choice-king/leaderboard', 'pages/choice-reports/index']) {
    assert.match(pages, new RegExp(page));
  }
  assert.match(learning, />选择刷题王</);
  assert.match(learning, /pages\/choice-king\/index\?student_id=/);
});

test('学生端支持单题即时判题、幂等防连点、错题回归和题目报错', () => {
  const page = read('pages/choice-king/index.vue');
  assert.match(page, /\/choice-king\/next\?student_id=/);
  assert.match(page, /\/choice-king\/questions\/\$\{question\.value\.id\}\/answer/);
  assert.match(page, /selected_option/);
  assert.match(page, /client_request_id/);
  assert.match(page, /submitting\.value \|\| answerResult\.value/);
  assert.match(page, /错题回来啦/);
  assert.match(page, /question\.value\?\.is_review/);
  assert.match(page, /回答正确/);
  assert.match(page, /正确答案是/);
  assert.match(page, /答案解析/);
  assert.match(page, /\/choice-king\/reports/);
  assert.match(page, /题目或答案有问题/);
});

test('选择刷题榜提供本周榜、历史榜和空错加载状态', () => {
  const page = read('pages/choice-king/leaderboard.vue');
  assert.match(page, /本周刷题榜/);
  assert.match(page, /历史刷题榜/);
  assert.match(page, /period=\$\{period\.value\}/);
  assert.match(page, /首次答对/);
  assert.match(page, /v-if="loading"/);
  assert.match(page, /v-else-if="error"/);
  assert.match(page, /!entries\.length/);
});

test('教师报错页可筛选、核对并停用问题题目', () => {
  const page = read('pages/choice-reports/index.vue');
  assert.match(page, /待处理/);
  assert.match(page, /已处理/);
  assert.match(page, /\/choice-king\/reports\?status=/);
  assert.match(page, /\/choice-king\/reports\/\$\{item\.id\}/);
  assert.match(page, /stop_question/);
  assert.match(page, /停用题目/);
  assert.match(page, /processingId/);
  assert.match(page, /v-else-if="error/);
  assert.match(page, /!reports\.length/);
});
