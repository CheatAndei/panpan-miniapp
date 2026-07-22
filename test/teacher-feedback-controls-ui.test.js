const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'teacher-feedback', 'index.vue'), 'utf8');

test('class feedback uses an observation note instead of a numeric score', () => {
  assert.match(page, /v-model="se\._cf\.performanceNote"/);
  assert.doesNotMatch(page, /se\._cf\.perfScore/);
  assert.doesNotMatch(page, /课堂表现\s*\{\{[^}]+\}\}\/10/);
});

test('exit quiz is controlled once for the whole class', () => {
  assert.match(page, /本次有出门测/);
  assert.match(page, /:checked="se\._hasExitQuiz"/);
  assert.match(page, /v-if="se\._hasExitQuiz"/);
  assert.match(page, /本次不使用出门测信息，反馈只写课堂表现/);
  assert.doesNotMatch(page, /本次没有安排出门测/);
  assert.match(page, /hasExitQuiz:se\._hasExitQuiz/);
});

test('expanded feedback session cannot trigger swipe-delete', () => {
  assert.match(page, /!se\._open&&se\._swiped/);
  assert.match(page, /if\(se\._open\|\|se\._publishing\)/);
  assert.match(page, /if\(!se\._swiping\|\|se\._open\|\|se\._publishing\)return/);
  assert.match(page, /if\(se\._open\|\|se\._publishing\)return;/);
});

test('each student has a 1-10 classroom performance slider', () => {
  assert.match(page, /课堂表现\s*\{\{\s*s\._performanceScore\s*\}\}/);
  assert.match(page, /<slider :value="s\._performanceScore" @change="e=>s\._performanceScore=e\.detail\.value" min="1" max="10"/);
  assert.match(page, /performanceScore:s\._performanceScore/);
});
