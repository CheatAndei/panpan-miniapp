const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('家长作业页先带鉴权下载私图，再使用本地临时路径展示和预览', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'parent-homework', 'index.vue'), 'utf8');
  assert.match(page, /api\.downloadPrivate\(answer\.question_image_url\)/);
  assert.match(page, /answer\.local_image_path/);
  assert.doesNotMatch(page, /:src="api\.assetUrl\(answer\.question_image_url\)"/);
  assert.doesNotMatch(page, /preview\(answer\.question_image_url\)/);
});
