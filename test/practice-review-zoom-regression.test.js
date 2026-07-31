const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const review = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'practice-review', 'index.vue'),
  'utf8',
);
const movableView = review.match(/<movable-view[\s\S]*?<\/movable-view>/u)?.[0] || '';

test('照片缩放由原生视图层持有，中间倍率不实时回写受控属性', () => {
  assert.match(movableView, /:scale="true"/u);
  assert.match(movableView, /:scale-min="1"/u);
  assert.match(movableView, /:scale-max="4"/u);
  assert.doesNotMatch(movableView, /:scale-value=/u);
  assert.doesNotMatch(movableView, /:x=|:y=/u);
  assert.doesNotMatch(movableView, /@scale=|@change=/u);
  assert.match(movableView, /:key="activePhotoViewKey"/u);
  assert.match(review, /function resetCurrentPhoto\(\)[\s\S]*?_photoResetKeys\[index\]/u);
});
