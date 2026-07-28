const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'weekly-challenge', 'index.vue'), 'utf8');

test('压轴挑战明确展示同日交替题型，换题仍保持当前类型', () => {
  assert.match(page, /next_question_type/);
  assert.match(page, /claim\(nextQuestionType\)/);
  assert.match(page, /下一题将切换为/);
  assert.match(page, /换一道同类型题/);
  assert.match(page, /if\(loadPromise\)\{reloadCurrent=true;return loadPromise;\}/);
  assert.match(page, /if\(loadPromise\)await loadPromise/);
  assert.match(page, /v-if="!loading&&!assignment&&lastPassed&&nextQuestionType"/);
  assert.doesNotMatch(page, /claim\(lastPassed\.question_type\)/);
});
