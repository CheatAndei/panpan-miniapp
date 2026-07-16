const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'pages/teacher-feedback/index.vue'), 'utf8');

test('生成学习小组反馈后可复制', () => {
  assert.match(source, /v-if="se\._cf\._text" class="copy-feedback-btn"/u);
  assert.match(source, /copyFeedback\(se\._cf\._text,'学习小组反馈'\)/u);
});

test('生成学生个人反馈后可复制', () => {
  assert.match(source, /v-if="s\._text" class="copy-feedback-btn"/u);
  assert.match(source, /copyFeedback\(s\._text,s\.name\+'的反馈'\)/u);
});

test('复制使用微信小程序剪贴板能力并处理失败', () => {
  assert.match(source, /uni\.setClipboardData\(/u);
  assert.match(source, /data:value/u);
  assert.match(source, /feedback\.copy/u);
  assert.match(source, /复制失败，请重试/u);
});
