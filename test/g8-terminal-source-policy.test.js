const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('八年级压轴和填空挑战只抽取真题源并停用原创题卡', () => {
  const challenge = read('backend/services/challenge-v2.js');
  const seed = read('backend/services/g8-content-seed.js');
  const deploy = read('.github/workflows/backend-docker-image.yml');
  assert.match(challenge, /G8_REAL_SOURCE_PREFIX = 'gz8-terminal-GZ8-'/);
  assert.match(challenge, /realSourceSql\(grade,'q'\)/);
  assert.match(challenge, /retireUnsubmittedG8OriginalAssignments/);
  assert.match(seed, /source_key LIKE 'g8-original-%' AND is_active=1/);
  assert.match(seed, /difficulty=excluded\.difficulty,is_active=0/);
  assert.match(deploy, /g8_terminal_real:[\s\S]*source_key LIKE 'gz8-terminal-GZ8-%'/);
  assert.match(deploy, /g8_terminal_original:[\s\S]*source_key LIKE 'g8-original-%'/);
  assert.match(deploy, /counts\.g8_terminal_real !== 435/);
  assert.match(deploy, /counts\.g8_terminal_original !== 0/);
  assert.match(deploy, /counts\.g8_practice !== 1600/);
  assert.doesNotMatch(deploy, /counts\.g8_practice !== 480/);
});
