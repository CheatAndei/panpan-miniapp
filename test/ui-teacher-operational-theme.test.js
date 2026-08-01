const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const marker = '/* Teacher operations theme: bright learning studio v2. */';

const files = [
  'pages/teacher-checkin/index.vue',
  'pages/teacher-classes/index.vue',
  'pages/teacher-feedback/index.vue',
  'pages/teacher-leaves/index.vue',
  'pages/teacher-schedule/index.vue',
  'pages/teacher-tools/index.vue',
  'pages/class-history/index.vue',
  'pages/student-detail/index.vue',
];

const heroSelectors = {
  'pages/teacher-checkin/index.vue': '.hero',
  'pages/teacher-classes/index.vue': '.hero',
  'pages/teacher-feedback/index.vue': '.hero',
  'pages/teacher-leaves/index.vue': '.inbox-hero',
  'pages/teacher-schedule/index.vue': '.hero',
  'pages/teacher-tools/index.vue': '.hero',
  'pages/class-history/index.vue': '.archive-hero',
  'pages/student-detail/index.vue': '.hero.hero-navy',
};

function finalTheme(source, file) {
  const index = source.lastIndexOf(marker);
  assert.notEqual(index, -1, `${file} should include the bright teacher theme layer`);
  return source.slice(index);
}

function ruleBody(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `${selector} should have a final theme rule`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function cssRules(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

test('teacher operational pages use the Panpan candy learning palette', () => {
  for (const file of files) {
    const source = read(file);
    const theme = finalTheme(source, file);

    for (const token of [
      '--primary: #0B789A',
      '--primary-strong: #050505',
      '--gold: #FFF48A',
      '--coral: #F79BC0',
      '--info: #0B789A',
      '--ink: #050505',
      '--page-bg: #F7FCFE',
    ]) {
      assert.match(theme, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${file} should define ${token}`);
    }

    assert.doesNotMatch(theme, /#20B486|#15946D|#FF7468|#F8FCF9|#26352F|#183A36|#173A35/i, `${file} final theme should not retain the replaced green-coral palette or deep green`);
    assert.doesNotMatch(theme, /radial-gradient|orb/i, `${file} should not use decorative orbs`);
    assert.doesNotMatch(theme, /align-items:\s*stretch/i, `${file} should not stretch short content`);

    const letterSpacing = [...theme.matchAll(/letter-spacing:\s*([^;}]+)/g)]
      .map((match) => match[1].trim());
    assert.ok(letterSpacing.every((value) => value === '0'), `${file} should keep letter spacing at zero`);

    const radii = [...theme.matchAll(/border-radius:\s*(\d+)rpx/g)]
      .map((match) => Number(match[1]));
    assert.ok(radii.every((value) => value <= 16), `${file} card radii should stay at or below 16rpx`);

    const hero = ruleBody(theme, heroSelectors[file]);
    assert.match(hero, /#FFFFFF/i, `${file} hero should be paper white`);
    assert.doesNotMatch(hero, /background:\s*#(?:315EA8|527CC9)/i, `${file} hero should stay paper white`);
  }
});

test('single-line controls are compact and do not stack min-height with vertical padding', () => {
  const controlSelector = /button|\.btn|\.tab|\.chip|\.tool-card|\.filter|\.back-to-list|\.load-more|\.attachment-btn|\.course-chip/i;

  for (const file of files) {
    const theme = finalTheme(read(file), file);
    for (const { selector, body } of cssRules(theme)) {
      if (!controlSelector.test(selector)) continue;

      const heights = [...body.matchAll(/(?:min-)?height:\s*(\d+)rpx/g)]
        .map((match) => Number(match[1]));
      assert.ok(heights.every((value) => value <= 112), `${file} ${selector} should not exceed 112rpx`);

      const minHeight = Number(body.match(/min-height:\s*(\d+)rpx/)?.[1] || 0);
      const padding = body.match(/padding:\s*(\d+)rpx(?:\s+(\d+)rpx)?/);
      const verticalPadding = padding ? Number(padding[1]) : 0;
      assert.ok(
        minHeight === 0 || verticalPadding === 0,
        `${file} ${selector} should not stack min-height with vertical padding`,
      );
    }
  }
});

test('teacher operation layouts use coherent blue-coral roles', () => {
  const checkin = finalTheme(read('pages/teacher-checkin/index.vue'), 'teacher-checkin');
  const tools = finalTheme(read('pages/teacher-tools/index.vue'), 'teacher-tools');
  const history = finalTheme(read('pages/class-history/index.vue'), 'class-history');
  const student = finalTheme(read('pages/student-detail/index.vue'), 'student-detail');

  assert.match(checkin, /\.stat:nth-child|\.stat\.green[\s\S]*?#E5F8FE/);
  assert.match(checkin, /\.stat\.gray[\s\S]*?#FFF0F6/);
  assert.match(tools, /\.tool-card-2,[\s\S]*?\.tool-card-3,[\s\S]*?#0B789A/);
  assert.match(tools, /\.tool-card-4[\s\S]*?#F79BC0/);
  assert.match(history, /\.summary-cell\.tone-mint[\s\S]*?#0B789A/);
  assert.match(history, /\.summary-cell\.tone-practice[\s\S]*?#050505/);
  assert.doesNotMatch(tools + history, /#5B9DF7|#FFC94A|#B27600/);
  assert.match(student, /grid-template-areas:[\s\S]*?"avatar status"/);
  assert.match(student, /\.hero\.hero-navy[\s\S]*?background:\s*#FFFFFF !important/);
});

test('all teacher operational actions and state selectors remain wired', () => {
  const expectations = {
    'pages/teacher-classes/index.vue': [
      '@tap="toggleClass(c)"',
      '@tap="openStudent(s)"',
      '@tap="openCreateClass"',
      '@tap="transferStudent"',
    ],
    'pages/teacher-feedback/index.vue': [
      '@tap="genClassFeedback(se)"',
      '@tap="genAllStu(se)"',
      '@tap="saveAllFeedbackCards(se)"',
      '@tap="publishFeedback(se)"',
    ],
    'pages/teacher-schedule/index.vue': [
      '@tap="publishChecked"',
      '@tap="toggleCheck(s.id)"',
      '@tap="saveSched"',
      '@tap="specialPublish"',
    ],
    'pages/teacher-checkin/index.vue': [
      '@tap="checkInAll(se)"',
      '@tap="checkIn(se,s)"',
      '@tap="markLeave(se,s)"',
      '@tap="checkOut(se,s)"',
    ],
    'pages/teacher-leaves/index.vue': [
      "@tap=\"handle(item,'approved')\"",
      "@tap=\"handle(item,'rejected')\"",
      '@tap="sendReply"',
      '@tap="deleteItem(item)"',
    ],
    'pages/teacher-tools/index.vue': [
      '@tap="go(item.url)"',
      '/pages/student-records/index',
      '/pages/teacher-classes/index',
    ],
    'pages/class-history/index.vue': [
      '@tap="openAttachment(item.attachment_url)"',
      '@tap="loadHistory(false)"',
    ],
    'pages/student-detail/index.vue': [
      '@tap="delTrait(i)"',
      '@tap="toggleCat(cat.name)"',
      '@tap="genAI"',
      '@tap="save"',
    ],
  };

  for (const [file, snippets] of Object.entries(expectations)) {
    const source = read(file);
    for (const snippet of snippets) {
      assert.ok(source.includes(snippet), `${file} should retain ${snippet}`);
    }
  }
});
