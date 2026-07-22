const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pages = read('pages.json');
const parent = read('pages/practice-parent/index.vue');
const teacher = read('pages/practice-teacher/index.vue');
const home = read('pages/index/index.vue');
const api = read('utils/api.js');

test('每日打卡家长教师页面已注册', () => {
  assert.match(pages, /pages\/practice-parent\/index/);
  assert.match(pages, /pages\/practice-teacher\/index/);
});

test('首页按角色进入今日专属练习与打卡计划', () => {
  assert.match(home, /pages\/practice-parent\/index\?student_id=/);
  assert.match(home, /learningToday\.tasks/);
  assert.match(home, /task\.route === 'practice'/);
  assert.match(home, /今日学习任务/);
  assert.match(home, /pages\/practice-teacher\/index/);
  assert.match(home, /打卡计划与复核/);
  const parentBranch = home.indexOf('<!-- 家长端 -->');
  assert.ok(home.indexOf("navTo('/pages/practice-teacher/index')") < parentBranch, '教师打卡入口必须位于教师分支');
  assert.ok(home.indexOf("if (task.route === 'practice')") > parentBranch, '家长每日练习入口必须位于家长分支');
  assert.match(home, /async function openHomeworkNotice/);
});

test('家长页领取结构化题目并上传照片', () => {
  assert.match(parent, /\/practice\/today\?student_id=/);
  assert.match(parent, /assignment\.items/);
  assert.match(parent, /chooseMedia|chooseImage/);
  assert.match(parent, /\/practice\/assignments\/\$\{assignment\.value\.id\}\/upload/);
  assert.match(parent, /min-height:92rpx/);
  assert.doesNotMatch(parent, /难度 \{\{ item\.difficulty \}\}/);
  assert.match(parent, /照片会对应今天题单和标准答案/);
  assert.match(parent, /open-type="share"/);
  assert.match(parent, /一起坚持每天多练一点/);
  assert.match(parent, /不包含学生作业照片/);
});

test('教师页使用四类可选初中计算题库并支持左右对照式极速批改', () => {
  assert.match(teacher, /固定题库 · 初中计算/);
  assert.match(teacher, /按学生当前进度勾选模块/);
  for (const topicKey of ['rational_numbers', 'absolute_value', 'algebra', 'linear_equation']) {
    assert.match(teacher, new RegExp(topicKey));
  }
  assert.match(teacher, /至少保留一个计算模块/);
  assert.doesNotMatch(teacher, /<slider[^>]+difficulty/);
  assert.doesNotMatch(teacher, /学生个性化范围/);
  assert.doesNotMatch(teacher, /changeSettingDifficulty/);
  assert.match(teacher, /compare-workspace/);
  assert.match(teacher, /photo-pane/);
  assert.match(teacher, /answer-pane/);
  assert.ok(teacher.indexOf('photo-pane') < teacher.indexOf('answer-pane'), '照片必须位于答案左侧');
  assert.match(teacher, /只点错题/);
  assert.match(teacher, /默认正确/);
  assert.match(teacher, /toggleWrong/);
  assert.match(teacher, /item\._correct = item\._correct === false/);
  assert.match(teacher, /保存并下一位/);
  assert.match(teacher, /moveToNextSubmission/);
  assert.match(teacher, /grid-template-columns:minmax\(0,1\.08fr\) minmax\(0,\.92fr\)/);
  assert.match(teacher, /min-height:88rpx/);
  assert.doesNotMatch(teacher, />正确<\/button>/);
  assert.doesNotMatch(teacher, />需巩固<\/button>/);
  assert.match(teacher, /\/practice\/submissions\/\$\{submission\.id\}\/review/);
  assert.match(teacher, /\/api\/practice\/plans\/\$\{item\.id\}\/pdf/);
  assert.match(teacher, /上一页/);
  assert.match(teacher, /下一页/);
  assert.match(teacher, /page=\$\{submissionPage\.value\}/);
  assert.match(teacher, /\/practice\/todos\?limit=20/);
  assert.match(teacher, />批改<\/button>/);
  assert.match(teacher, /openTodo\(item\)/);
  assert.match(home, /学生打卡待批改/);
  assert.match(home, /\/practice\/todos\?limit=3/);
  assert.match(home, /submission_id=\$\{item\.submission_id\}/);
});

test('私有图片先带 Authorization 下载到临时路径再预览', () => {
  assert.match(api, /export async function downloadPrivateFile/);
  assert.match(api, /downloadPrivateByRequest/);
  assert.match(api, /responseType:\s*'arraybuffer'/);
  assert.match(api, /fs\.writeFile/);
  assert.match(api, /downloadPrivateByFileApi/);
  assert.match(api, /uni\.downloadFile/);
  assert.match(api, /header:\s*authHeader\(\)/);
  assert.match(teacher, /api\.downloadPrivate\(file\.url\)/);
  assert.match(teacher, /Promise\.allSettled/);
  assert.match(teacher, /重新读取/);
  assert.match(teacher, /photosReady\(activeSubmission\)/);
});

test('教师首页工作概览展示三个可操作指标且不会被通用白卡覆盖', () => {
  assert.match(home, /pendingPracticeCount[\s\S]*待批改/u);
  assert.match(home, /pendingLeaves[\s\S]*待审批/u);
  assert.match(home, /todaySessions\.length[\s\S]*今日课程/u);
  assert.match(home, /\.page \.focus-card\s*\{/u);
  assert.match(home, /linear-gradient\(145deg,#173A36,#315D56\)/u);
  assert.doesNotMatch(home, /totalStudents/u);
});
