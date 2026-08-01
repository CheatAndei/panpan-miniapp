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
  assert.match(page, /还不如上一题/);
  assert.match(page, /可在这两题间反复切换/);
  assert.match(page, /data\.can_switch_back/);
  assert.match(page, /\(!canChange\.value&&!canSwitchBack\.value\)/);
  assert.match(page, /if\(loadPromise\)\{reloadCurrent=true;return loadPromise;\}/);
  assert.match(page, /if\(loadPromise\)await loadPromise/);
  assert.match(page, /v-if="!loading&&!assignment&&lastPassed&&nextQuestionType"/);
  assert.doesNotMatch(page, /claim\(lastPassed\.question_type\)/);
});

test('压轴挑战先暂存多张图片与选填文字，再由学生手动确认提交', () => {
  const reviewPage = fs.readFileSync(path.join(__dirname, '..', 'pages', 'weekly-review', 'index.vue'), 'utf8');
  assert.match(page, /upload_complete=0/);
  assert.match(page, /v-model="answerText"/);
  assert.match(page, /maxlength="500"/);
  assert.match(page, /@tap="submitChallenge"/);
  assert.match(page, /\/weekly-challenge\/v2\/assignments\/\$\{assignment\.value\.id\}\/submit/);
  assert.match(page, /student_note:answerText\.value\.trim\(\)/);
  const uploadHandler = page.match(/async function chooseAndUpload\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(uploadHandler, /挑战已提交/);
  assert.match(uploadHandler, /图片已暂存/);
  assert.match(reviewPage, /item\.submission\.student_note/);
});
