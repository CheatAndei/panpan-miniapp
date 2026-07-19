const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('家长端将每周挑战改为压轴挑战且只可领取填空和解答题', () => {
  const page = read('pages/weekly-challenge/index.vue');
  assert.match(page, /压轴挑战/);
  assert.match(page, /最后一道填空/);
  assert.match(page, /最后两道大题/);
  assert.doesNotMatch(page, /每周挑战|value:'choice'|label:'选择题'/);
});

test('教师首页纳入压轴挑战待批阅数量、待办列表和直达入口', () => {
  const home = read('pages/index/index.vue');
  assert.match(home, /pendingChallengeCount/);
  assert.match(home, /pendingChallengeTodos/);
  assert.match(home, /\/weekly-challenge\/teacher\/submissions\?status=submitted&limit=3/);
  assert.match(home, /压轴挑战待批阅/);
  assert.match(home, /pages\/weekly-review\/index/);
  assert.match(home, /pendingLeaves\.value[\s\S]+pendingPracticeCount\.value[\s\S]+pendingChallengeCount\.value/);
});

test('教师批阅页用明确错误态代替接口失败后的空状态', () => {
  const review = read('pages/weekly-review/index.vue');
  assert.match(review, /const error=ref\(''\)/);
  assert.match(review, /v-else-if="error" type="error"/);
  assert.match(review, /error\.value=e\?\.error\|\|'加载失败'/);
  assert.match(review, /压轴挑战批阅/);
  assert.doesNotMatch(review, /每周挑战批阅/);
});

test('教学工具入口统一使用压轴挑战名称', () => {
  const tools = read('pages/teacher-tools/index.vue');
  assert.match(tools, /压轴挑战批阅/);
  assert.doesNotMatch(tools, /每周挑战/);
});
