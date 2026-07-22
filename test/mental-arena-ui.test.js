const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('口算王四个页面已注册且家长首页有入口', () => {
  const pages = read('pages.json');
  const home = read('pages/index/index.vue');
  for (const page of ['index', 'challenge', 'result', 'leaderboard']) {
    assert.match(pages, new RegExp(`pages/mental-arena/${page}`));
  }
  assert.match(home, /pages\/mental-arena\/index\?student_id=/);
  assert.match(home, />口算王</);
});

test('战场、答题、计分结果和双排行榜形成完整闭环', () => {
  const hub = read('pages/mental-arena/index.vue');
  const challenge = read('pages/mental-arena/challenge.vue');
  const result = read('pages/mental-arena/result.vue');
  const leaderboard = read('pages/mental-arena/leaderboard.vue');
  assert.match(hub, /小学战场/);
  assert.match(hub, /初中战场/);
  assert.match(hub, /\/mental-arena\/challenges/);
  assert.match(challenge, /20/);
  assert.match(challenge, /\/submit/);
  assert.match(result, /speed_bonus/);
  assert.match(result, /查看排行榜/);
  assert.match(leaderboard, /本周榜/);
  assert.match(leaderboard, /历史榜/);
  assert.match(leaderboard, /炸鱼选手/);
});

test('成绩按奖项、分数、指标和题目顺序入场，且可以跳过', () => {
  const result = read('pages/mental-arena/result.vue');
  assert.match(result, /revealStage>=1/);
  assert.match(result, /revealStage>=2/);
  assert.match(result, /revealStage>=3/);
  assert.match(result, /revealStage>=4/);
  assert.match(result, /rowDelayStyle\(index \+ 1\)/);
  assert.match(result, /跳过动画/);
  assert.match(result, /function skipIntro/);
  assert.match(result, /transform:translateY/);
  assert.match(result, /opacity/);
});

test('动画结束自动生成口算王专属海报，并提供关闭、保存和分享', () => {
  const result = read('pages/mental-arena/result.vue');
  const poster = read('utils/mental-arena-poster.js');
  const achievement = read('backend/services/achievements.js');
  assert.match(result, /generatePoster\(true\)/);
  assert.match(result, /class="poster-close"/);
  assert.match(result, />×<\/button>/);
  assert.match(result, /saveMentalArenaPoster/);
  assert.match(result, /open-type="share"/);
  assert.match(result, /onShareAppMessage/);
  assert.match(poster, /mentalArenaAward/);
  assert.match(poster, /kind: 'crown'/);
  assert.match(poster, /kind: 'trophy'/);
  assert.match(poster, /kind: 'medal'/);
  assert.match(poster, /canvasToTempFilePath/);
  assert.match(poster, /saveImageToPhotosAlbum/);
  assert.match(poster, /1080/);
  assert.match(poster, /1440/);
  assert.match(achievement, /challenge_id:Number\(row\.id\)/);
});
