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

test('压轴挑战按孩子班级年级初始化并持久记忆手动切换', () => {
  const page = read('pages/weekly-challenge/index.vue');
  assert.match(page, /\{value:'g7',label:'七年级'\}/);
  assert.match(page, /\{value:'g8',label:'八年级'\}/);
  assert.match(page, /\{value:'g9',label:'九年级'\}/);
  assert.match(page, /const gradeCode=ref\(''\)/);
  assert.doesNotMatch(page, /const gradeCode=ref\('g7'\)/);
  assert.match(page, /\/learning\/catalog\?student_id=\$\{studentId\.value\}/);
  assert.match(page, /data\.grade_code\|\|data\.detected_grade_code/);
  assert.match(page, /api\.put\('\/learning\/preferences',\{student_id:studentId\.value,grade:nextGrade,subject:'math'\}\)/);
  assert.match(page, /gradeCode\.value=nextGrade/);
  assert.match(page, /\/weekly-challenge\/v2\/current\?student_id=\$\{studentId\.value\}&grade=\$\{gradeCode\.value\}/);
  assert.match(page, /广州\$\{gradeLabel\}数学真题精选/);
  assert.match(page, /切换后会记住该孩子的选择/);
});

test('教师首页纳入压轴挑战待批阅数量、待办列表和直达入口', () => {
  const homePage = read('pages/index/index.vue');
  const teacherHome = read('components/home/TeacherHomeView.vue');
  const home = homePage + teacherHome;
  assert.match(home, /pendingChallengeCount/);
  assert.match(home, /pendingChallengeTodos/);
  assert.match(home, /\/weekly-challenge\/v2\/teacher\/submissions\?status=submitted&limit=3/);
  assert.doesNotMatch(home, /api\.get\('\/weekly-challenge\/teacher\/submissions\?status=submitted&limit=3'\)/);
  assert.match(teacherHome, /压轴挑战/);
  assert.match(teacherHome, /待批阅/);
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

test('压轴批阅只保留待批阅和最近已批阅，默认展示三份并按需加载照片', () => {
  const review = read('pages/weekly-review/index.vue');
  assert.match(review, /最近已批阅/);
  assert.doesNotMatch(review, /value:'all',label:'全部'/);
  assert.match(review, /status\.value==='reviewed'\?10:30/);
  assert.match(review, /items\.value\.slice\(0,3\)/);
  assert.match(review, /async function loadPhotos/);
  assert.doesNotMatch(review, /items\.value=await Promise\.all/);
  assert.match(review, /align-items:flex-start/);
  assert.match(review, /justify-content:center/);
});

test('教学工具入口统一使用压轴挑战名称', () => {
  const tools = read('pages/teacher-tools/index.vue');
  assert.match(tools, /压轴挑战批阅/);
  assert.doesNotMatch(tools, /每周挑战/);
});
