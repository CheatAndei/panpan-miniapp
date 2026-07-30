const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pages = read('pages.json');
const parent = read('pages/practice-parent/index.vue');
const teacher = read('pages/practice-teacher/index.vue');
const review = read('pages/practice-review/index.vue');
const homePage = read('pages/index/index.vue');
const teacherHome = read('components/home/TeacherHomeView.vue');
const parentHome = read('components/home/ParentHomeView.vue');
const noticeDialog = read('components/home/HomeworkNoticeDialog.vue');
const home = homePage + teacherHome + parentHome + noticeDialog;
const api = read('utils/api.js');

test('每日打卡家长教师页面已注册', () => {
  assert.match(pages, /pages\/practice-parent\/index/);
  assert.match(pages, /pages\/practice-teacher\/index/);
  assert.match(pages, /pages\/practice-review\/index/);
});

test('首页按角色进入今日专属练习与打卡计划', () => {
  assert.match(home, /pages\/practice-parent\/index\?student_id=/);
  assert.match(home, /learningToday\.tasks/);
  assert.match(home, /task\.route === 'practice'/);
  assert.match(home, /今日学习任务/);
  assert.match(home, /pages\/practice-teacher\/index/);
  assert.match(home, /打卡计划与复核/);
  assert.match(homePage, /<TeacherHomeView[\s\S]*?<ParentHomeView/u);
  assert.match(teacherHome, /navigate\('\/pages\/practice-teacher\/index'\)/);
  assert.doesNotMatch(parentHome, /pages\/practice-teacher\/index/);
  assert.match(homePage, /if \(task\.route === 'practice'\)/);
  assert.match(parentHome, /@tap="\$emit\('open-today-task', task\)"/);
  assert.match(homePage, /async function openHomeworkNotice/);
});

test('家长页领取结构化题目并上传照片', () => {
  assert.match(parent, /\/practice\/today\?student_id=/);
  assert.match(parent, /assignment\.items/);
  assert.match(parent, /chooseMedia|chooseImage/);
  assert.match(parent, /\/practice\/assignments\/\$\{assignment\.value\.id\}\/upload/);
  assert.match(parent, /\.primary-btn\s*\{\s*min-height:\s*86rpx/u);
  assert.doesNotMatch(parent, /难度 \{\{ item\.difficulty \}\}/);
  assert.match(parent, /照片会对应今天题单和标准答案/);
  assert.match(parent, /open-type="share"/);
  assert.match(parent, /一起坚持每天多练一点/);
  assert.match(parent, /不包含学生作业照片/);
});

test('作业图片使用长超时并在全部暂存后单独确认送达', () => {
  const uploadDraftFlow = parent.match(/async function chooseAndUpload\(\) \{[\s\S]*?\n\}/u)?.[0] || '';
  const manualSubmitFlow = parent.match(/async function confirmSavedUpload\(\) \{[\s\S]*?\n\}/u)?.[0] || '';
  assert.match(parent, /upload\?upload_complete=0/);
  assert.match(parent, /\/upload\/complete/);
  assert.match(parent, /已传好，确认送达老师/);
  assert.match(uploadDraftFlow, /图片已暂存/);
  assert.doesNotMatch(uploadDraftFlow, /completePracticeUpload/);
  assert.match(manualSubmitFlow, /completePracticeUpload/);
  assert.match(api, /request\('POST', path,[\s\S]*?\{ timeout: 60000 \}\)/u);
  assert.match(api, /uni\.uploadFile\(\{[\s\S]*?timeout:\s*60000/u);
});

test('计划页使用四类可选初中计算题库，批改台独立且只处理未批改提交', () => {
  assert.match(teacher, /固定题库 · 初中计算/);
  assert.match(teacher, /按学生当前进度勾选模块/);
  for (const topicKey of ['rational_numbers', 'absolute_value', 'algebra', 'linear_equation']) {
    assert.match(teacher, new RegExp(topicKey));
  }
  assert.match(teacher, /至少保留一个计算模块/);
  assert.doesNotMatch(teacher, /<slider[^>]+difficulty/);
  assert.doesNotMatch(teacher, /学生个性化范围/);
  assert.doesNotMatch(teacher, /changeSettingDifficulty/);
  assert.match(teacher, /搜索计划、班级或学生姓名/);
  assert.match(teacher, /reviewed&limit=50/);
  assert.match(teacher, /correction_required&limit=50/);
  assert.match(teacher, /\['published','student_curriculum'\]\.includes\(item\.status\)/);
  assert.match(teacher, /plans\/\$\{pdfPlan\.value\.id\}\/pdf\?student_id=/);
  assert.doesNotMatch(teacher, /api\.downloadPrivate/);
  assert.match(review, /status=submitted/);
  assert.match(review, /status=all&limit=50&page=1&submission_id=/);
  assert.match(review, /photo-pane/);
  assert.match(review, /answer-pane/);
  assert.ok(review.indexOf('photo-pane') < review.indexOf('answer-pane'), '照片必须位于答案上方');
  assert.match(review, /只点错题/);
  assert.match(review, /默认正确/);
  assert.match(review, /toggleWrong/);
  assert.match(review, /item\._correct = item\._correct === false/);
  assert.match(review, /activeSubmission\._saved/);
  assert.match(review, /activeSubmission\._saving[\s\S]{0,80}\? '保存中…'/u);
  assert.match(review, /保存并打回/);
  assert.match(review, /保存通过/);
  assert.match(review, /'预览'/);
  assert.match(review, /保存相册/);
  assert.match(review, /下一位/);
  assert.match(review, /rotateCurrentPhoto/);
  assert.match(review, /\.workbench\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/u);
  assert.doesNotMatch(review, />正确<\/button>/);
  assert.doesNotMatch(review, />需巩固<\/button>/);
  assert.match(review, /\/practice\/submissions\/\$\{submission\.id\}\/review/);
  assert.match(teacherHome, /学生打卡/);
  assert.match(teacherHome, /待批改/);
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
  assert.match(review, /api\.downloadPrivate\(file\.url\)/);
  assert.match(review, /Promise\.allSettled/);
  assert.match(review, /重读/);
  assert.match(review, /photosReady/);
});

test('教师首页工作概览展示三个可操作指标且不会被通用白卡覆盖', () => {
  assert.match(teacherHome, /pendingPracticeCount[\s\S]*打卡批改/u);
  assert.match(teacherHome, /pendingLeaves[\s\S]*待审批/u);
  assert.match(teacherHome, /todaySessionCount[\s\S]*今日课程/u);
  assert.match(teacherHome, /\.focus-card\s*\{/u);
  assert.match(teacherHome, /border-left:\s*8rpx solid var\(--primary\)/u);
  assert.match(teacherHome, /background:\s*#FFFFFF/u);
  assert.doesNotMatch(home, /totalStudents/u);
});

test('教师首页把快捷工作放在今日总览和高优先待办之前', () => {
  const quickWork = teacherHome.indexOf('<text class="section-title">快捷工作</text>');
  const overview = teacherHome.indexOf('<view class="focus-card">');
  const priority = teacherHome.indexOf('<text class="section-title">高优先待办</text>');
  assert.ok(quickWork >= 0, '应存在快捷工作区');
  assert.ok(quickWork < overview, '快捷工作应在今日总览之前');
  assert.ok(quickWork < priority, '快捷工作应在高优先待办之前');
});

test('教师首页快捷工作使用按列重复的三种等深语义色', () => {
  const actionTones = [...teacherHome.matchAll(/<button class="action-item ([^"]+)"/gu)]
    .slice(0, 6)
    .map((match) => match[1].split(/\s+/u).find((name) => name.startsWith('action-tone-')));

  assert.deepEqual(actionTones, [
    'action-tone-blue',
    'action-tone-coral',
    'action-tone-mint',
    'action-tone-blue',
    'action-tone-coral',
    'action-tone-mint',
  ]);
  assert.match(teacherHome, /\.action-tone-blue \.action-icon\s*\{[\s\S]*?color:\s*#315EA8/u);
  assert.match(teacherHome, /\.action-tone-coral \.action-icon\s*\{[\s\S]*?color:\s*#A94F48/u);
  assert.match(teacherHome, /\.action-tone-mint \.action-icon\s*\{[\s\S]*?color:\s*#2F796B/u);
  assert.doesNotMatch(teacherHome, /\.action-item:nth-child\(/u);
});

test('教师首页初次加载和失败时不会误报待办已清', () => {
  assert.match(teacherHome, /v-if="loading && classes\.length === 0"/);
  assert.match(teacherHome, /v-else-if="error"/);
  assert.match(teacherHome, /title="今日教务加载失败"/);
  assert.match(teacherHome, /@action="\$emit\('reload'\)"/);
  assert.match(teacherHome, /\.todo-row\s*\{[\s\S]*?min-height:\s*82rpx/u);
});

test('教师端独立轮询学生打卡并在到件时明确提醒', () => {
  assert.match(homePage, /async function loadTeacherPracticeTodos/);
  assert.match(homePage, /api\.get\('\/practice\/todos\?limit=3'\)/);
  assert.match(homePage, /setInterval\([\s\S]*?loadTeacherPracticeTodos\(\{\s*announce:\s*true\s*\}\)[\s\S]*?15000/u);
  assert.match(homePage, /收到 \$\{nextCount - previousCount\} 份新打卡/);
  assert.match(homePage, /Promise\.allSettled/);
  assert.match(homePage, /const practicePromise = loadTeacherPracticeTodos/);
});
