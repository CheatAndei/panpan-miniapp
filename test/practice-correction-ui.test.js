const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const review = read('pages/practice-review/index.vue');
const parent = read('pages/practice-parent/index.vue');
const home = read('pages/index/index.vue');

test('手机批改台使用上下布局并在原页支持双指缩放与照片切换', () => {
  assert.ok(review.indexOf('photo-pane') < review.indexOf('answer-pane'), '照片应排在答案前面');
  assert.match(review, /\.workbench\{display:flex;flex-direction:column/);
  assert.match(review, /<movable-area[\s\S]*?<movable-view/u);
  assert.match(review, /:scale-min="1"/);
  assert.match(review, /:scale-max="4"/);
  assert.match(review, /:direction="\(activeSubmission\._photoScales\[index\] \|\| 1\) > 1 \? 'all' : 'none'"/);
  assert.match(review, /双指缩放 1×–4×/);
  assert.match(review, /<swiper[\s\S]*?@change="changePhoto"/u);
  assert.match(review, /左右滑动切换/);
  assert.match(review, /changePhotoBy/);
  assert.doesNotMatch(review, /function previewPhoto/);
  assert.doesNotMatch(review, /@tap="previewPhoto/);
});

test('批改台只在首次 onShow 取队列并明确点击下一位才移走已保存学生', () => {
  assert.match(review, /const hasShown = ref\(false\)/);
  assert.match(review, /onShow\(\(\) => \{[\s\S]*?if \(hasShown\.value\) return;[\s\S]*?loadQueue\(\)/u);
  assert.match(review, /currentSubmissionId/);
  assert.match(review, /current\?\._saved[\s\S]*?return/u);
  assert.match(review, /submission\._saved = true/);
  assert.match(review, /@tap="nextAfterSave">下一位/);
  assert.match(review, /async function nextAfterSave\(\)[\s\S]*?submissions\.value\.splice/u);
});

test('订正批改只展示上一轮错题并把轮次带入保存与海报', () => {
  for (const field of ['is_correction', 'correction_round', 'needs_correction', 'focus_item_ids']) {
    assert.match(review, new RegExp(field));
  }
  assert.match(review, /只看新照片 \/ 上一轮错题/);
  assert.match(review, /focusSet\.has\(String\(item\.id\)\)/);
  assert.match(review, /round_no: submission\._correctionRound/);
  assert.match(review, /submission\.status = result\.status/);
  assert.match(review, /保存并打回/);
  assert.match(review, /已打回 \$\{wrongCount\.value\} 题/);
  assert.match(review, /已保存通过/);
  assert.match(review, /isCorrection: submission\._isCorrection/);
  assert.match(review, /correctionRound: submission\._correctionRound/);
});

test('家长页明确待订正状态且照片数只取当前轮', () => {
  assert.match(parent, /老师已打回/);
  assert.match(parent, /待上传订正照片/);
  assert.match(parent, /待订正/);
  assert.match(parent, /本轮新增 \{\{ attachmentCount \}\} 张/);
  assert.match(parent, /submission\.value\.attachment_count/);
  assert.match(parent, /if \(!submission\.value \|\| needsCorrection\.value\) return 0/);
  assert.match(parent, /上传订正照片/);
  assert.match(parent, /订正已提交/);
  assert.match(parent, /correction_required/);
  assert.match(parent, /upload_complete=\$\{uploadComplete\}/);
  assert.match(parent, /index === files\.length - 1 \? 1 : 0/);
  assert.match(home, /task\.status === 'correction_required'/);
  assert.match(home, /return '去订正'/);
});
