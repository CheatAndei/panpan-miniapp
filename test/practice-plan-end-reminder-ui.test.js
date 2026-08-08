const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('pages/index/index.vue');
const teacherHome = read('components/home/TeacherHomeView.vue');

test('教师首页只显示当天结束且尚未确认的打卡计划提醒', () => {
  assert.match(home, /api\.get\('\/practice\/plans\?status=current&limit=100'\)/);
  assert.match(home, /plan\.end_date === todayKey && !isPracticePlanEndReminderDismissed\(plan\)/);
  assert.match(home, /panpan:practice-plan-end:/);
  assert.match(home, /uni\.setStorageSync\(practicePlanEndReminderKey\(plan\), '1'\)/);
  assert.match(home, /:ending-practice-plans="endingPracticePlans"/);
  assert.match(home, /@dismiss-plan-ending="dismissEndingPracticePlan"/);
});

test('到期提醒展示班级与计划名称并可明确关闭', () => {
  assert.match(teacherHome, /v-if="endingPracticePlans\.length"/);
  assert.match(teacherHome, /今天有 \{\{ endingPracticePlans\.length \}\} 个打卡计划结束/);
  assert.match(teacherHome, /plan\.class_name \|\| '学习小组'/);
  assert.match(teacherHome, /\$emit\('dismiss-plan-ending', plan\)/);
  assert.match(teacherHome, />知道了<\/button>/);
  assert.match(teacherHome, /prefers-reduced-motion|plan-end-row/);
});
