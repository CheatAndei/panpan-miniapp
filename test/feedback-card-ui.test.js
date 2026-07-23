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
  assert.match(renderer, /feedbackCardStudentLabel/);
  assert.match(renderer, /FALLBACK_FEEDBACK_EMOJI = '🌟'/u);
  assert.match(renderer, /resolvePackagedImage/);
  assert.match(renderer, /USER_DATA_PATH/);
  assert.match(renderer, /studentCardLayout/);
  assert.match(renderer, /drawCover\(ctx, photos\[0\]/);
  assert.match(renderer, /drawAvatarFallback/);
});

test('课堂反馈、学生反馈、作业是三套独立主题分享卡并都可预览保存', () => {
  assert.match(renderer, /renderFeedbackCard/);
  assert.match(renderer, /renderClassFeedbackCard/);
  assert.match(renderer, /renderHomeworkCard/);
  assert.match(renderer, /今日课堂简报/u);
  assert.match(renderer, /课后任务单/u);
  assert.match(renderer, /drawFittedText/);
  assert.match(renderer, /#F7F2E8/);
  assert.doesNotMatch(renderer, /for \(let x = 0; x <= 750; x \+= 62\)/);
  assert.match(renderer, /#D35F4D/);
  for (const handler of ['previewClassFeedbackCard', 'saveClassFeedbackCard', 'previewHomeworkCard', 'saveHomeworkCard']) {
    assert.match(page, new RegExp(`${handler}\\(se\\)`));
  }
  assert.match(page, /课堂简报分享卡/u);
  assert.match(page, /方格纸任务主题/u);
});

test('课堂反馈文字紧跟课后作业输入，分享卡操作放在文字之后', () => {
  const homeworkInput = page.indexOf('v-model="se._cf.homework"');
  const feedbackText = page.indexOf('v-model="se._cf._text"');
  const classBuilder = page.indexOf('class-share-builder');
  const homeworkBuilder = page.indexOf('homework-share-builder');
  assert.ok(homeworkInput >= 0 && feedbackText > homeworkInput);
  assert.ok(classBuilder > feedbackText);
  assert.ok(homeworkBuilder > classBuilder);
});

test('批量反馈生成放宽到 45 秒，避免模型正常响应被前端提前中断', () => {
  assert.match(page, /\{timeout:45000\}/);
});

test('feedback card assets exist and stay lightweight', () => {
  for (const name of ['panpan-feedback-line.jpg', 'panpan-feedback-line.webp']) {
    const file = path.join(root, 'static', 'brand', name);
    assert.equal(fs.existsSync(file), true, `${name} should exist`);
    assert.ok(fs.statSync(file).size < 100 * 1024, `${name} should be below 100 KiB`);
  }
});
