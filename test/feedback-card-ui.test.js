const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'pages', 'teacher-feedback', 'index.vue'), 'utf8');
const renderer = fs.readFileSync(path.join(root, 'utils', 'feedback-card.js'), 'utf8');

test('teacher can preview, save one, save all, and retry feedback cards', () => {
  assert.match(page, /previewStudentFeedbackCard\(se,s\)/);
  assert.match(page, /saveStudentFeedbackCard\(se,s\)/);
  assert.match(page, /saveAllFeedbackCards\(se\)/);
  assert.match(page, /retryFailedCards\(se\)/);
  assert.match(page, /for\(let index=0;index<selected\.length;index\+=1\)/);
  assert.match(page, /uni\.previewImage\(\{current:filePath,urls:\[filePath\]\}\)/);
  assert.match(page, /uni\.openSetting/);
});

test('feedback card is private, full-name, 3:4, and supports up to three photos', () => {
  assert.match(page, /studentName:s\.name/);
  assert.match(page, /images:\(s\._images\|\|\[\]\)\.slice\(0,3\)/);
  assert.match(page, /每位学生单独生成一张，仅保存到老师手机后私发家长/);
  assert.match(renderer, /destWidth:\s*1080/);
  assert.match(renderer, /destHeight:\s*1440/);
  assert.match(renderer, /FEEDBACK_CARD_MAX_TEXT = 180/);
  assert.match(renderer, /slice\(0, 3\)/);
  assert.match(renderer, /仅供学生家长查看/);
  assert.match(renderer, /panpan-feedback-line\.jpg/);
});

test('feedback card assets exist and stay lightweight', () => {
  for (const name of ['panpan-feedback-line.jpg', 'panpan-feedback-line.webp']) {
    const file = path.join(root, 'static', 'brand', name);
    assert.equal(fs.existsSync(file), true, `${name} should exist`);
    assert.ok(fs.statSync(file).size < 100 * 1024, `${name} should be below 100 KiB`);
  }
});
