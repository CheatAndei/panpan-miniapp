const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pages = [
  'pages/bind/bind.vue',
  'pages/exam-library/index.vue',
  'pages/guest-experience/index.vue',
  'pages/maintenance/index.vue',
  'pages/mine/index.vue',
  'pages/parent-feedback/index.vue',
  'pages/parent-homework/index.vue',
  'pages/parent-leave/index.vue',
  'pages/parent-opinions/index.vue',
  'pages/parent-profile/index.vue',
  'pages/parent-schedule/index.vue',
  'pages/practice-parent/index.vue',
  'pages/practice-teacher/index.vue',
];

const forbiddenPalette = /#20B486|#15946D|#FF7468|#F8FCF9|#26352F|#172033|#1E4EA8|#3268D6|#0F5B4A|#154C3D|#173F35|#0B3D33|#5B9DF7|#337BD8|#FFC94A|#B27600|rgba?\(\s*32\s*,\s*180\s*,\s*134/i;
const iconPages = [
  'pages/bind/bind.vue',
  'pages/exam-library/index.vue',
  'pages/guest-experience/index.vue',
  'pages/maintenance/index.vue',
  'pages/mine/index.vue',
  'pages/parent-feedback/index.vue',
  'pages/parent-homework/index.vue',
  'pages/parent-leave/index.vue',
  'pages/parent-opinions/index.vue',
  'pages/parent-profile/index.vue',
  'pages/parent-schedule/index.vue',
  'pages/practice-parent/index.vue',
];

function styleRules(source) {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({ selector: match[1].trim(), body: match[2] }));
}

function assertCompactControls(source, file) {
  for (const { selector, body } of styleRules(source)) {
    if (!/(?:button|btn|action|tab|chip|picker|input|control|toggle)/i.test(selector)) continue;

    const minHeight = body.match(/min-height:\s*(\d+)rpx/i);
    if (minHeight) {
      assert.ok(Number(minHeight[1]) <= 92, `${file} ${selector} should keep a compact touch height`);
    }

    const verticalPadding = body.match(/padding:\s*(\d+)rpx(?:\s+\d+rpx)?/i);
    if (minHeight && verticalPadding) {
      assert.ok(Number(verticalPadding[1]) <= 20, `${file} ${selector} should not stack a tall min-height with large padding`);
    }

    assert.doesNotMatch(
      body,
      /align-(?:items|self):\s*stretch/i,
      `${file} ${selector} should not stretch controls into blank space`,
    );
  }
}

test('parent-adjacent pages use the restored blue-coral Panpan identity', () => {
  for (const file of pages) {
    const source = read(file);
    const styleBlocks = source.match(/<style scoped>/g) || [];
    const letterSpacing = [...source.matchAll(/letter-spacing:\s*([^;}]+)/g)]
      .map((match) => match[1].trim());
    const oversizedRadius = [...source.matchAll(/border-radius:\s*(\d+)rpx/gi)]
      .map((match) => Number(match[1]))
      .filter((value) => value > 16);

    assert.equal(styleBlocks.length, 1, `${file} should have one scoped style block`);
    assert.match(source, /#527CC9/i, `${file} should visibly use the restored learning blue`);
    assert.match(source, /#315EA8/i, `${file} should visibly use strong blue actions`);
    assert.match(source, /#F6FAFF/i, `${file} should use the pale blue paper background`);
    assert.match(source, /#24324A/i, `${file} should use blue-charcoal text`);
    assert.match(source, /#E98577|#D66D62|#FFF0ED/i, `${file} should reserve coral for feedback or emphasis`);
    assert.doesNotMatch(source, forbiddenPalette, `${file} should not retain the replaced green-coral palette or stale saturated blue`);
    assert.doesNotMatch(source, /border-radius:\s*var\(--r/i, `${file} should not hide oversized global radii behind tokens`);
    assert.doesNotMatch(source, /radial-gradient|(?:hero|card|page)::after[^}]*border-radius:\s*50%/is, `${file} should not use radial or orb decoration`);
    assert.doesNotMatch(source, /letter-spacing:\s*-/i, `${file} should not use negative spacing`);
    assert.ok(letterSpacing.every((value) => value === '0'), `${file} should keep letter spacing at zero`);
    assert.deepEqual(oversizedRadius, [], `${file} should keep card/control radii at or below 16rpx`);
    assertCompactControls(source, file);
  }
});

test('remaining functional pages keep compact records instead of nested cards', () => {
  const schedule = read('pages/parent-schedule/index.vue');
  const feedback = read('pages/parent-feedback/index.vue');
  const homework = read('pages/parent-homework/index.vue');
  const guest = read('pages/guest-experience/index.vue');
  const mine = read('pages/mine/index.vue');

  assert.match(schedule, /\.fb-card\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*transparent/s);
  assert.match(feedback, /\.stu-fb-card\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*transparent/s);
  assert.match(homework, /\.answer-card\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*transparent/s);
  assert.doesNotMatch(guest, /\.hero::after|\.contact-card::after/);
  assert.doesNotMatch(mine, /\.user-card::after/);
});

test('parent and public pages use compact local icons for titles, states, and actions', () => {
  const titleIconPatterns = {
    'pages/bind/bind.vue': /hero-title-row[\s\S]*?<pp-icon name="brand" :size="40"/,
    'pages/exam-library/index.vue': /hero-title-row[\s\S]*?<pp-icon name="exam" :size="34"/,
    'pages/guest-experience/index.vue': /hero-title-row[\s\S]*?<pp-icon name="calculator" :size="34"/,
    'pages/maintenance/index.vue': /class="title"[\s\S]*?<pp-icon name="pencil" :size="30"/,
    'pages/mine/index.vue': /class="name"[\s\S]*?<pp-icon/,
    'pages/parent-feedback/index.vue': /hero-title-row[\s\S]*?<pp-icon name="message" :size="34"/,
    'pages/parent-homework/index.vue': /hero-title-row[\s\S]*?<pp-icon name="clipboard" :size="34"/,
    'pages/parent-leave/index.vue': /hero-title-row[\s\S]*?<pp-icon name="calendar" :size="34"/,
    'pages/parent-opinions/index.vue': /hero-title-row[\s\S]*?<pp-icon name="message" :size="34"/,
    'pages/parent-profile/index.vue': /hero-title-row[\s\S]*?<pp-icon name="user" :size="34"/,
    'pages/parent-schedule/index.vue': /hero-title-row[\s\S]*?<pp-icon name="calendar" :size="34"/,
    'pages/practice-parent/index.vue': /hero-title-row[\s\S]*?<pp-icon name="calculator" :size="34"/,
  };

  for (const file of iconPages) {
    const source = read(file);
    const sizes = [...source.matchAll(/<pp-icon\b[^>]*:size="(\d+)"/g)]
      .map((match) => Number(match[1]));

    assert.match(source, titleIconPatterns[file], `${file} should pair its page title with a local icon`);
    assert.match(source, /<pp-icon\b[^>]*(?:motion|:motion)=/, `${file} should animate one semantic icon`);
    assert.ok(sizes.length >= 5, `${file} should use icons across more than one UI role`);
    assert.ok(
      sizes.every((size) => size >= 20 && size <= 40),
      `${file} should keep pp-icon sizes between 20rpx and 40rpx`,
    );
    assert.doesNotMatch(source, /<svg\b|[✓□★⭐🔒📌📚🎯✨💡]/u, `${file} should not use inline SVG or symbol stand-ins`);
  }
});

test('business actions and navigation hooks remain wired', () => {
  const expectations = {
    'pages/bind/bind.vue': [
      '@tap="doBind"',
      '@tap="goHome"',
    ],
    'pages/guest-experience/index.vue': [
      '@tap="nextChoice"',
      '@tap="nextMental"',
      '@tap="copyWechat"',
      '@tap="goBind"',
    ],
    'pages/parent-schedule/index.vue': [
      '@tap="openClass(s)"',
      '@tap="openFb(fb)"',
      '@tap="showStuFb(s)"',
    ],
    'pages/parent-feedback/index.vue': [
      '@tap="showDetail(fb)"',
      '@tap.stop="openPdf(fb.notes_pdf_url)"',
    ],
    'pages/parent-homework/index.vue': [
      '@tap="openBatch(item.id)"',
      '@tap="detail=null"',
    ],
    'pages/parent-leave/index.vue': [
      '@change="e=>form.date=e.detail.value"',
      '@tap="submit"',
    ],
    'pages/exam-library/index.vue': [
      '@tap="search"',
      "@tap=\"downloadPaper(paper,'paper')\"",
    ],
    'pages/mine/index.vue': [
      '@tap.stop="unbind(kid)"',
      '@change="changeMaintenance"',
      '@tap="logout"',
    ],
    'pages/practice-parent/index.vue': [
      '@tap="chooseAndUpload"',
      '@tap="confirmSavedUpload"',
    ],
    'pages/practice-teacher/index.vue': [
      '@tap="openReview"',
      '@tap="previewPlan"',
      '@tap="publishPlan"',
    ],
  };

  for (const [file, snippets] of Object.entries(expectations)) {
    const source = read(file);
    for (const snippet of snippets) {
      assert.ok(source.includes(snippet), `${file} should retain ${snippet}`);
    }
  }
});
