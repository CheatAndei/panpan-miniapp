const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('教师首页有宣传海报工作台，新事件会自动打开', () => {
  const pages = read('pages.json');
  const home = read('pages/index/index.vue');
  assert.match(pages, /pages\/promotion-posters\/index/);
  assert.match(home, /宣传海报工作台/);
  assert.match(home, /\/promotions\?limit=12/);
  assert.match(home, /newestPromotion/);
  assert.match(home, /event_id=\$\{newestPromotion\.id\}/);
});

test('压轴挑战批改正确后立即打开对应宣传海报', () => {
  const review = read('pages/weekly-review/index.vue');
  assert.match(review, /result\.promotion\?\.id/);
  assert.match(review, /promotion-posters\/index\?event_id=/);
});

test('口算登顶与压轴通关使用两套主题，并生成高清可保存海报', () => {
  const page = read('pages/promotion-posters/index.vue');
  const poster = read('utils/promotion-poster.js');
  assert.match(page, /mental_first/);
  assert.match(page, /challenge_pass/);
  assert.match(page, /本周榜首播报/);
  assert.match(page, /压轴通关喜报/);
  assert.match(page, /保存到相册/);
  assert.match(page, /open-type="share"/);
  assert.match(page, /公开海报不展示全名、学校和班级/);
  assert.match(poster, /drawMentalPoster/);
  assert.match(poster, /drawChallengePoster/);
  assert.match(poster, /destWidth: 1080/);
  assert.match(poster, /destHeight: 1440/);
  assert.match(poster, /saveImageToPhotosAlbum/);
});

test('压轴通关海报下载并放大绘制题目原图', () => {
  const page = read('pages/promotion-posters/index.vue');
  const poster = read('utils/promotion-poster.js');
  const service = read('backend/services/promotions.js');
  assert.match(service, /question_asset_id/);
  assert.match(service, /question_url/);
  assert.match(page, /questionImagePath/);
  assert.match(page, /api\.downloadPrivate\(selected\.value\.question_url\)/);
  assert.match(page, /:src="questionImagePath"/);
  assert.match(poster, /questionImagePath/);
  assert.match(poster, /drawChallengeQuestion/);
  assert.match(poster, /drawCover/);
});
