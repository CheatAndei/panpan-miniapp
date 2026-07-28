const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const pages = [
  'pages/choice-king/index.vue',
  'pages/choice-king/leaderboard.vue',
  'pages/choice-reports/index.vue',
  'pages/knowledge-challenge/index.vue',
  'pages/learning-center/index.vue',
  'pages/learning-session/index.vue',
  'pages/mental-arena/index.vue',
  'pages/mental-arena/challenge.vue',
  'pages/mental-arena/result.vue',
  'pages/mental-arena/leaderboard.vue',
  'pages/mental-goals/index.vue',
  'pages/growth/index.vue',
  'pages/achievements/index.vue',
  'pages/weekly-challenge/index.vue',
  'pages/weekly-review/index.vue',
];

const replacedPalette =
  /#20B486|#15946D|#FF7468|#F8FCF9|#26352F|rgba?\(\s*32\s*,\s*180\s*,\s*134/i;

test('all student challenge pages use the unified pale-blue teaching theme', () => {
  const sources = pages.map((file) => [file, read(file)]);

  for (const [file, source] of sources) {
    assert.match(source, /student-challenge-page/, `${file} should opt into the shared theme`);
    assert.match(
      source,
      /Student challenge theme v3:/,
      `${file} should include the visible v3 theme`,
    );
    assert.equal(
      (source.match(/<style\b/g) || []).length,
      1,
      `${file} should keep a single scoped style block`,
    );
    assert.doesNotMatch(source, replacedPalette, `${file} should not retain the replaced green-coral palette`);
    assert.doesNotMatch(source, /radial-gradient/i, `${file} should not use decorative orbs`);
    const trackingSurface = file === 'pages/mental-arena/result.vue'
      ? source.replace(/[^{}]*\.poster[^{}]*\{[^{}]*\}/g, '')
      : source;
    assert.doesNotMatch(
      trackingSurface,
      /letter-spacing\s*:\s*-/i,
      `${file} should not use negative tracking outside the restored poster interface`,
    );
    assert.match(source, /#F6FAFF/i, `${file} should define the pale blue paper background`);
    assert.match(source, /#527CC9/i, `${file} should define the learning blue`);
    assert.match(source, /#315EA8/i, `${file} should define the strong action blue`);
    assert.match(source, /#24324A/i, `${file} should define blue-charcoal body text`);
    assert.match(source, /#5C6C84/i, `${file} should define secondary blue-gray text`);
    assert.match(source, /prefers-reduced-motion:\s*reduce/, `${file} should respect motion settings`);

    const v3 = source.slice(source.indexOf('Student challenge theme v3:'));
    const layoutV3 = file === 'pages/mental-arena/result.vue'
      ? v3.replace(/[^{}]*\.poster[^{}]*\{[^{}]*\}/g, '')
      : v3;
    assert.doesNotMatch(
      layoutV3,
      /border-radius:\s*(?:1[7-9]|[2-9]\d)rpx/i,
      `${file} v3 cards outside the restored poster interface should not exceed 16rpx radius`,
    );
  }

  const combined = sources.map(([, source]) => source).join('\n');
  for (const token of ['var(--primary)', 'var(--primary-soft)', 'var(--coral)', 'var(--coral-soft)']) {
    assert.match(combined, new RegExp(token.replace(/[()]/g, '\\$&')));
  }
  assert.doesNotMatch(combined, /background:\s*#26352F/i);
  assert.doesNotMatch(combined, /linear-gradient\([^;]*#26352F/i);
});

test('v3 removes height-plus-padding stretch from the main visible work areas', () => {
  const choice = read('pages/choice-king/index.vue');
  const arena = read('pages/mental-arena/challenge.vue');
  const result = read('pages/mental-arena/result.vue');
  const session = read('pages/learning-session/index.vue');
  const knowledge = read('pages/knowledge-challenge/index.vue');

  assert.match(choice, /\.student-challenge-page \.hero \{[\s\S]*?min-height:\s*0;/);
  assert.match(arena, /\.student-challenge-page \.question-stem \{[\s\S]*?min-height:\s*0;/);
  assert.match(result, /\.student-challenge-page \.result-hero \{[\s\S]*?min-height:\s*0;/);
  assert.match(session, /\.student-challenge-page \.question-stem \{[\s\S]*?min-height:\s*0;/);
  assert.match(knowledge, /\.student-challenge-page \.topic-card \{[\s\S]*?min-height:\s*0;/);
});

test('game feeling comes from progress, rank, and feedback structure', () => {
  const choice = read('pages/choice-king/index.vue');
  const arena = read('pages/mental-arena/challenge.vue');
  const result = read('pages/mental-arena/result.vue');
  const knowledge = read('pages/knowledge-challenge/index.vue');

  assert.match(choice, /class="summary-strip"/);
  assert.match(choice, /class="option-list"/);
  assert.match(arena, /class="progress-fill"/);
  assert.match(arena, /class="number-map"/);
  assert.match(result, /\['metrics','motion-panel'/);
  assert.match(result, /\['review-card','motion-panel'/);
  assert.match(
    result,
    /\.student-challenge-page \.hero-grid,[\s\S]*?\.student-challenge-page \.orbit-ring \{[\s\S]*?display: none;/,
  );
  assert.match(result, /\.student-challenge-page \.answer-row-motion \{[\s\S]*?result-row-in/);
  assert.match(result, /@keyframes result-row-in/);
  assert.match(knowledge, /class="quiz-progress"/);
  assert.match(knowledge, /\['answer-card'/);
});

test('local icons and restrained semantic motion stay visible across student challenge pages', () => {
  const allowedMotions = new Set(['pop', 'bob', 'shine', 'ring', 'breathe']);
  const sources = pages.map((file) => [file, read(file)]);

  for (const [file, source] of sources) {
    const icons = source.match(/<pp-icon\b/g) || [];
    const literalMotions = [...source.matchAll(/\smotion="([^"]+)"/g)].map((match) => match[1]);

    assert.ok(icons.length >= 2, `${file} should show at least two local icon anchors`);
    assert.ok(literalMotions.length >= 1, `${file} should animate at least one meaningful icon`);
    assert.ok(literalMotions.length <= 7, `${file} should not animate every card icon`);
    for (const motion of literalMotions) {
      assert.ok(allowedMotions.has(motion), `${file} should use a semantic pp-icon motion`);
    }
  }

  const combined = sources.map(([, source]) => source).join('\n');
  for (const motion of allowedMotions) {
    assert.match(combined, new RegExp(`motion="${motion}"`), `student pages should use ${motion} motion`);
  }
  assert.match(combined, /:delay="\d+"/, 'icon entrances should use visible delays');
  assert.match(combined, /:stagger="\d+"/, 'metric icon entrances should use stagger');

  const learningCenter = read('pages/learning-center/index.vue');
  assert.match(learningCenter, /name="pencil"[^>]*motion="pop"/);
  assert.match(learningCenter, /name="calculator"[^>]*motion="bob"/);
  assert.match(learningCenter, /name="exam"[^>]*motion="shine"/);
});

test('student challenge business events and question states remain wired', () => {
  const expected = new Map([
    [
      'pages/choice-king/index.vue',
      ['@tap="submitAnswer', '@tap="loadNext"', '@tap="openLeaderboard"', '<pp-question-reader'],
    ],
    [
      'pages/choice-king/leaderboard.vue',
      ["switchPeriod('week')", "switchPeriod('history')", '@action="goPractice"'],
    ],
    [
      'pages/mental-arena/index.vue',
      ["startBattle('primary')", "startBattle('junior')", 'openLeaderboard'],
    ],
    [
      'pages/mental-arena/challenge.vue',
      ['v-model="answers[currentQuestion.id]"', '@tap="jumpTo(index)"', '@tap="confirmSubmit"'],
    ],
    [
      'pages/mental-arena/result.vue',
      ['revealStage>=4', '@tap="playAgain"', '@tap="openPoster"', '@tap="openLeaderboard"'],
    ],
    [
      'pages/mental-arena/leaderboard.vue',
      ["switchBattle('primary')", "switchPeriod('week')", 'board.entries'],
    ],
    [
      'pages/learning-session/index.vue',
      ['v-model="answers[currentQuestion.id]"', '@tap="confirmExit"', '@tap="nextOrSubmit"'],
    ],
    [
      'pages/weekly-challenge/index.vue',
      ['@tap="claim(item.value)"', '@tap="changeQuestion"', '@tap="chooseAndUpload"'],
    ],
    [
      'pages/knowledge-challenge/index.vue',
      ['@tap="openTopic(topic)"', '@tap="answer(key)"', '@tap="restart"'],
    ],
  ]);

  for (const [file, signatures] of expected) {
    const source = read(file);
    for (const signature of signatures) {
      assert.ok(source.includes(signature), `${file} should keep ${signature}`);
    }
  }
});
