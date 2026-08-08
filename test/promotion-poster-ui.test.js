const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('教师首页有宣传海报工作台，新事件会自动打开', () => {
  const pages = read('pages.json');
  const home = read('pages/index/index.vue') + read('components/home/TeacherHomeView.vue');
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
  assert.match(page, /本周口算王/);
  assert.match(page, /压轴通关喜报/);
  assert.match(page, /保存到相册/);
  assert.match(page, /open-type="share"/);
  assert.match(page, /公开海报不展示全名、学校和班级/);
  assert.match(poster, /drawMentalPoster/);
  assert.match(poster, /drawChallengePoster/);
  assert.match(poster, /destWidth: 1080/);
  assert.match(poster, /destHeight: 1440/);
  assert.match(poster, /saveImageToAlbum/);
  assert.match(poster, /photo-album/);
  assert.match(page, /PANPAN · MATH LEAGUE/);
  assert.match(page, /PANPAN · BREAKTHROUGH REPORT/);
  assert.match(page, /Light poster studio/);
  assert.match(page, /mental-motto/);
  assert.match(page, /score-aside/);
  assert.match(page, /score-aside-detail/);
  assert.match(page, /font-variant-numeric:tabular-nums/);
  assert.match(page, /Score dashboard/);
  assert.match(poster, /#FFF9EC/);
  assert.match(poster, /#6FA9E6/);
  assert.match(poster, /#DDEEFF/);
  assert.match(poster, /#FFF8EE/);
  assert.match(poster, /#F39A6B/);
  assert.match(poster, /#FFE2D1/);
  assert.doesNotMatch(poster, /#111C3D|#080F24|#3B241C|#C84E32/);
  assert.doesNotMatch(poster, /panpan-feedback-line|pantouxiang/);
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

test('周末攻坚通关进入宣传台并复用黑金双关海报', () => {
  const page = read('pages/promotion-posters/index.vue');
  const masteryReview = read('pages/weekend-mastery-review/index.vue');
  const masteryPoster = read('utils/weekend-mastery-poster.js');
  const promotionService = read('backend/services/promotions.js');
  const masteryRoutes = read('backend/routes/weekend-mastery.js');
  const schema = read('backend/db/schema.sql');
  const dbInit = read('backend/db/init.js');

  assert.match(schema, /'weekend_mastery_pass'/);
  assert.match(dbInit, /migratePromotionEventsV2/);
  assert.match(promotionService, /recordWeekendMasteryPass/);
  assert.match(promotionService, /backfillWeekendMasteryPromotions/);
  assert.match(masteryRoutes, /recordWeekendMasteryPass/);
  assert.match(masteryRoutes, /promotion:event\?serializeEvent\(event\):null/);
  assert.match(masteryReview, /result\?\.promotion\?\.id/);
  assert.match(masteryReview, /promotion-posters\/index\?event_id=/);

  assert.match(page, /weekend_mastery_pass/);
  assert.match(page, /renderWeekendMasteryPoster/);
  assert.match(page, /weekendMasteryPromotionCanvas/);
  assert.match(page, /攻坚海报显示学生全名/);
  assert.match(masteryPoster, /PANPAN \/\/ WEEKEND MASTERY/);
  assert.match(masteryPoster, /双关制霸/);
});
