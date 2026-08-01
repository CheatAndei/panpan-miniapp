const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const page = read('pages/student-records/index.vue');
const pages = read('pages.json');
const teacherHome = read('components/home/TeacherHomeView.vue');
const teacherTools = read('pages/teacher-tools/index.vue');
const themeMarker = '/* Teacher operations theme: bright learning studio v2. */';
const finalTheme = page.slice(page.lastIndexOf(themeMarker));

test('教师快捷工作和工具页都能进入学生学习记录，原学习小组历史入口保留', () => {
  assert.match(pages, /"path":\s*"pages\/student-records\/index"/);
  assert.match(teacherHome, /学习记录/);
  assert.match(teacherHome, /\/pages\/student-records\/index/);
  assert.match(teacherTools, /学生学习记录/);
  assert.match(teacherTools, /\/pages\/student-records\/index/);
  assert.match(teacherTools, /学习小组历史/);
  assert.match(teacherTools, /\/pages\/teacher-classes\/index/);
  assert.match(teacherTools, /String\(tools\.length\)\.padStart\(2,\s*'0'\)/);
});

test('学习记录页展示累计题量、错误分布、选择题统计和学生题库', () => {
  for (const copy of [
    '累计题目',
    '总题量',
    '打卡题',
    '选择题',
    '累计错题',
    '待掌握',
    '做题分布',
    '每日打卡',
    '选择题王',
    '口算王',
    '学习中心',
    '知识闯关',
    '学生题库',
  ]) {
    assert.match(page, new RegExp(copy));
  }
  assert.match(page, /channels\.practice\?\.total/);
  assert.match(page, /channels\.choice\?\.total/);
  assert.match(page, /channels\.choice\?\.wrong/);
  assert.match(page, /question_bank\?\.items/);
  assert.match(page, /item\.status === 'open'/);
});

test('学习记录页连接教师汇总与单生详情接口并覆盖加载、错误、空状态', () => {
  assert.match(page, /api\.get\('\/students\/learning-records'\)/);
  assert.match(page, /api\.get\(`\/students\/\$\{selectedStudent\.value\.id\}\/learning-record`\)/);
  assert.match(page, /type="loading"/);
  assert.match(page, /type="error"/);
  assert.match(page, /没有找到学生/);
  assert.match(page, /当前没有待掌握题目/);
  assert.match(page, /onPullDownRefresh/);
});

test('学习记录页使用蓝色与珊瑚双色教学系统并支持窄屏与减弱动效', () => {
  for (const token of [
    '--primary: #0B789A',
    '--primary-strong: #050505',
    '--gold: #FFF48A',
    '--coral: #F79BC0',
    '--info: #0B789A',
    '--ink: #050505',
    '--page-bg: #F7FCFE',
  ]) {
    assert.match(finalTheme, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(finalTheme, /\.hero\s*\{[\s\S]*?background:\s*#FFFFFF !important/);
  assert.match(finalTheme, /\.overview-secondary > view:nth-child\(1\)[\s\S]*?#FFF0F6/);
  assert.match(finalTheme, /\.overview-secondary > view:nth-child\(2\)[\s\S]*?#F8FCFD/);
  assert.match(finalTheme, /\.overview-secondary > view:nth-child\(3\)[\s\S]*?#F8FCFD/);
  assert.match(finalTheme, /\.channel-card\.tone-mint[\s\S]*?#0B789A/);
  assert.match(finalTheme, /\.channel-card\.tone-yellow[\s\S]*?#0B789A/);
  assert.match(finalTheme, /\.channel-card\.tone-coral[\s\S]*?#F79BC0/);
  assert.match(page, /motion="pop"/);
  assert.match(finalTheme, /@keyframes learning-record-enter/);
  assert.match(page, /@media\(max-width:340px\)/);
  assert.match(page, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(finalTheme, /#20B486|#15946D|#FF7468|#F8FCF9|#26352F|#173A35|#183A36|#2F6E61|#3268D6|#1E4EA8|#5B9DF7|#337BD8|#FFC94A|#B27600/i);
  assert.doesNotMatch(finalTheme, /radial-gradient|orb|align-items:\s*stretch/i);

  const radii = [...finalTheme.matchAll(/border-radius:\s*(\d+)rpx/g)]
    .map((match) => Number(match[1]));
  assert.ok(radii.every((value) => value <= 16));
  assert.match(finalTheme, /\.student-record\s*\{[\s\S]*?display:\s*block/);

  const singleLineRules = [...finalTheme.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => /button|\.tab|\.chip|\.filter|\.student-record|\.back-to-list/i.test(match[1]));
  for (const [, selector, body] of singleLineRules) {
    const heights = [...body.matchAll(/(?:min-)?height:\s*(\d+)rpx/g)]
      .map((match) => Number(match[1]));
    assert.ok(heights.every((value) => value <= 112), `${selector.trim()} should stay compact`);
    const minHeight = Number(body.match(/min-height:\s*(\d+)rpx/)?.[1] || 0);
    const padding = body.match(/padding:\s*(\d+)rpx(?:\s+(\d+)rpx)?/);
    assert.ok(minHeight === 0 || !padding || Number(padding[1]) === 0, `${selector.trim()} should avoid stacked vertical whitespace`);
  }
});
