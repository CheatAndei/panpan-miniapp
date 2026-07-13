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
});

test('教师页可选题型、调整学生范围、复核并下载五日 PDF', () => {
  assert.match(teacher, /全部题型/);
  assert.match(teacher, /广州原创情境题/);
  assert.match(teacher, /toggleType/);
  assert.match(teacher, /学生个性化范围/);
  assert.match(teacher, /current_module/);
  assert.match(teacher, /auto_advance/);
  assert.match(teacher, /\/practice\/submissions\/\$\{submission\.id\}\/review/);
  assert.match(teacher, /\/api\/practice\/plans\/\$\{item\.id\}\/pdf/);
  assert.match(teacher, /上一页/);
  assert.match(teacher, /下一页/);
  assert.match(teacher, /page=\$\{submissionPage\.value\}/);
});

test('私有图片先带 Authorization 下载到临时路径再预览', () => {
  assert.match(api, /export function downloadPrivateFile/);
  assert.match(api, /uni\.downloadFile/);
  assert.match(api, /header:\s*authHeader\(\)/);
  assert.match(teacher, /api\.downloadPrivate\(file\.url\)/);
});
