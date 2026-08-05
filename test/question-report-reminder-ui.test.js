const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('教师首页将所有待处理题目报错纳入红点、待办和十五秒增量提醒', () => {
  const home = read('pages/index/index.vue');
  const view = read('components/home/TeacherHomeView.vue');
  assert.match(home, /pendingQuestionReportCount/);
  assert.match(home, /\/choice-king\/reports\?status=pending&limit=3/);
  assert.match(home, /\/calculation-reports\?status=pending&limit=3/);
  assert.match(home, /收到 \$\{nextCount - previousCount\} 条新题目报错/);
  assert.match(home, /loadTeacherQuestionReports\(\{ announce: true \}\)/);
  assert.match(view, /approvalCount/);
  assert.match(view, /题目报错审批/);
  assert.match(view, /pendingQuestionReports/);
});

test('审批中心显示题目报错入口并合并待处理数量', () => {
  const page = read('pages/teacher-leaves/index.vue');
  assert.match(page, /审批中心/);
  assert.match(page, /reportCount/);
  assert.match(page, /题目报错审批/);
  assert.match(page, /\/pages\/choice-reports\/index/);
  assert.match(page, /this\.pending\.length\+Number\(this\.reportCount\|\|0\)/);
});

