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
