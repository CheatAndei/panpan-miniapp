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

test('首页按角色进入每日打卡与打卡计划', () => {
  assert.match(home, /pages\/practice-parent\/index\?student_id=/);
  assert.match(home, /<text class="practice-entry-title">每日打卡<\/text>/);
  assert.match(home, /pages\/practice-teacher\/index/);
  assert.match(home, /打卡计划与复核/);
  const parentBranch = home.indexOf('<!-- 家长端 -->');
  assert.ok(home.indexOf("navTo('/pages/practice-teacher/index')") < parentBranch, '教师打卡入口必须位于教师分支');
  assert.ok(home.indexOf("navTo('/pages/practice-parent/index?student_id='+child.id)") > parentBranch, '家长每日打卡入口必须位于家长分支');
  assert.doesNotMatch(home, /parent-homework\/index\?student_id=/);
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

test('教师页使用固定初中计算题库并支持左右对照式极速批改', () => {
  assert.match(teacher, /固定题库 · 初中计算/);
  assert.match(teacher, /统一训练层级，无需选择难度/);
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
  assert.match(api, /export function downloadPrivateFile/);
  assert.match(api, /uni\.downloadFile/);
  assert.match(api, /header:\s*authHeader\(\)/);
  assert.match(teacher, /api\.downloadPrivate\(file\.url\)/);
});
