const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('global theme uses the light education palette with a strong action color', () => {
  const app = read('App.vue');
  const main = read('main.js');
  const pages = read('pages.json');
  const ui = read('utils/ui.js');

  for (const token of [
    '--primary: #527CC9',
    '--primary-strong: #315EA8',
    '--accent: #65BFA8',
    '--gold: #F4C75B',
    '--coral: #E98577',
    '--bg: #F6FAFF',
    '--page-bg: var(--bg)',
    '--motion-fast: 120ms',
  ]) {
    assert.match(app, new RegExp(escapeRegExp(token)));
  }

  assert.doesNotMatch(app, /--primary:\s*#183A36/i);
  assert.match(main, /primary:\s*'#527CC9'/);
  assert.match(pages, /"selectedColor":\s*"#315EA8"/);
  assert.match(pages, /"backgroundColor":\s*"#F6FAFF"/);
  assert.match(ui, /confirmColor:\s*danger\s*\?\s*'#D66D62'\s*:\s*'#315EA8'/);
});

test('education icons stay local and state feedback respects reduced motion', () => {
  const iconNames = [
    'exam',
    'trophy',
    'report',
    'target',
    'history',
    'pencil',
    'calculator',
    'lightbulb',
  ];

  for (const name of iconNames) {
    assert.equal(
      fs.existsSync(path.join(root, 'static', 'icons', `${name}.svg`)),
      true,
      `${name}.svg should exist`,
    );
  }

  const icon = read('components/pp-icon/pp-icon.vue');
  const state = read('components/pp-state/pp-state.vue');
  assert.match(icon, /aria-label/);
  assert.match(icon, /safeName/);
  assert.match(state, /prefers-reduced-motion:\s*reduce/);
  assert.match(state, /pp-state--error/);
  assert.match(state, /pp-state--success/);
  assert.match(state, /var\(--primary-strong,\s*#315EA8\)/);
  assert.match(state, /\.pp-state__action[\s\S]*?min-height:\s*112rpx/);
});

test('pilot pages keep every business entry and remove the old deep green theme', () => {
  const tools = read('pages/teacher-tools/index.vue');
  const learning = read('pages/learning-center/index.vue');

  assert.doesNotMatch(tools + learning, /#183A36|#2F6E61|#173A36/i);

  for (const route of [
    '/pages/practice-teacher/index',
    '/pages/exam-library/index?grade=g9',
    '/pages/weekly-review/index',
    '/pages/choice-reports/index',
    '/pages/mental-goals/index',
    '/pages/teacher-classes/index',
  ]) {
    assert.match(tools, new RegExp(escapeRegExp(route)));
  }

  for (const copy of ['今日', '学习', '成长', '七年级', '八年级', '冲刺中考', '选择刷题王']) {
    assert.match(learning, new RegExp(copy));
  }

  assert.match(tools + learning, /prefers-reduced-motion:\s*reduce/);
  assert.match(learning, /\.pp-state__action[\s\S]*?background:\s*#FFFFFF/);
  assert.match(learning, /\.nav-item[\s\S]*?min-height:\s*112rpx/);
  assert.match(learning, /\.grade-tab[\s\S]*?min-height:\s*112rpx/);
});
