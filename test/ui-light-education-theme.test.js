const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const listVueFiles = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true })
  .flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return listVueFiles(relative);
    return entry.isFile() && entry.name.endsWith('.vue') ? [relative] : [];
  });

test('global theme uses the sky-pink-yellow Panpan candy palette', () => {
  const app = read('App.vue');
  const main = read('main.js');
  const pages = read('pages.json');
  const ui = read('utils/ui.js');

  for (const token of [
    '--brand-sky: #99DEF4',
    '--brand-pink: #F79BC0',
    '--brand-yellow: #FFF48A',
    '--primary: #0B789A',
    '--primary-strong: #050505',
    '--accent: #F79BC0',
    '--gold: #FFF48A',
    '--coral: #F79BC0',
    '--bg: #F7FCFE',
    '--page-bg: var(--bg)',
    '--motion-fast: 120ms',
  ]) {
    assert.match(app, new RegExp(escapeRegExp(token)));
  }

  assert.doesNotMatch(app, /--primary:\s*#(?:183A36|20B486|15946D)/i);
  assert.match(main, /primary:\s*'#0B789A'/);
  assert.match(main, /accent:\s*'#F79BC0'/);
  assert.match(pages, /"selectedColor":\s*"#050505"/);
  assert.match(pages, /"backgroundColor":\s*"#F7FCFE"/);
  assert.doesNotMatch(app + main, /#(?:20B486|15946D|FF7468|F8FCF9|26352F)/i);
  assert.match(ui, /confirmColor:\s*danger\s*\?\s*'#B53A52'\s*:\s*'#050505'/);
});

test('global box model prevents native button whitespace and width overflow regressions', () => {
  const app = read('App.vue');

  assert.match(app, /view,\s*scroll-view,\s*swiper,\s*movable-area,\s*movable-view,\s*button,\s*input,\s*textarea\s*\{[\s\S]*?box-sizing:\s*border-box/);
  assert.match(app, /button\s*\{[\s\S]*?display:\s*flex[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center/);
  assert.match(app, /button\s*\{[\s\S]*?padding-top:\s*0[\s\S]*?padding-bottom:\s*0/);
});

test('mini-program styles avoid universal selectors rejected by WeChat upload compiler', () => {
  for (const file of ['App.vue', ...listVueFiles('components'), ...listVueFiles('pages')]) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /(?:^|[,{]\s*|\.[\w-]+\s+)\*\s*(?:\{|,)/m,
      `${file} should use explicit mini-program element selectors instead of *`,
    );
  }
});

test('education icons stay local and state feedback respects reduced motion', () => {
  const iconNames = [
    'exam',
    'trophy',
    'report',
    'search',
    'target',
    'history',
    'pencil',
    'calculator',
    'lightbulb',
    'school',
    'clock',
    'document',
    'trend',
    'family',
  ];

  for (const name of iconNames) {
    assert.equal(
      fs.existsSync(path.join(root, 'static', 'icons', `${name}.svg`)),
      true,
      `${name}.svg should exist`,
    );
  }

  const svgIconDir = path.join(root, 'static', 'icons');
  const svgIcons = fs.readdirSync(svgIconDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => fs.readFileSync(path.join(svgIconDir, file), 'utf8'))
    .join('\n');

  assert.match(svgIcons, /#050505/i);
  assert.match(svgIcons, /#F79BC0/i);
  assert.doesNotMatch(svgIcons, /#(?:20B486|15946D|FF7468|F8FCF9)/i);

  const icon = read('components/pp-icon/pp-icon.vue');
  const tabIconBuild = read('scripts/build-tab-icons.js');
  const state = read('components/pp-state/pp-state.vue');
  assert.match(icon, /aria-label/);
  assert.match(icon, /safeName/);
  assert.match(icon, /motion:\s*\{/);
  assert.match(icon, /pp-icon--motion-(?:pop|ring|shine)/);
  assert.match(icon, /prefers-reduced-motion:\s*reduce/);
  assert.match(tabIconBuild, /home-tab-active\.png', color: '#050505'/);
  assert.match(tabIconBuild, /user-tab-active\.png', color: '#050505'/);
  assert.doesNotMatch(tabIconBuild, /#(?:20B486|15946D|3268D6|1E4EA8)/i);
  assert.match(state, /prefers-reduced-motion:\s*reduce/);
  assert.match(state, /pp-state--error/);
  assert.match(state, /pp-state--success/);
  assert.match(state, /var\(--primary,\s*#0B789A\)/);
  assert.match(state, /\.pp-state__action[\s\S]*?min-height:\s*80rpx/);
  assert.match(state, /\.pp-state__action[\s\S]*?padding:\s*0 28rpx/);
  assert.doesNotMatch(state, /\.pp-state\s*\{[\s\S]*?min-height:\s*236rpx/);
  assert.doesNotMatch(state, /#(?:20B486|15946D|3268D6|1E4EA8)/i);
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
    '/pages/student-records/index',
    '/pages/teacher-classes/index',
  ]) {
    assert.match(tools, new RegExp(escapeRegExp(route)));
  }

  for (const copy of ['今日', '学习', '成长', '七年级', '八年级', '冲刺中考', '选择刷题王']) {
    assert.match(learning, new RegExp(copy));
  }

  assert.match(tools + learning, /prefers-reduced-motion:\s*reduce/);
  assert.match(learning, /\.pp-state__action[\s\S]*?background:\s*#FFFFFF/);
  assert.match(learning, /\.student-challenge-page \.nav-item\s*\{[\s\S]*?min-height:\s*76rpx/);
  assert.match(learning, /\.student-challenge-page \.grade-tab\s*\{[\s\S]*?min-height:\s*76rpx/);
  assert.doesNotMatch(learning, /rgba\(32,\s*180,\s*134/);
});
