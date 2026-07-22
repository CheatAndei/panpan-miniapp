const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'pages/index/index.vue'), 'utf8');

test('家长首页读取作业未读提醒并显示批改完成弹窗', () => {
  assert.match(source, /\/homework\/notices\?unread=1&limit=50/);
  assert.match(source, /作业批改完成/);
  assert.match(source, /已批改完成/);
  assert.match(source, /另有 \{\{ homeworkNoticeCount - 1 \}\} 份/);
  assert.match(source, />知道了<\/button>/);
  assert.match(source, /'查看作业'/);
});

test('查看或确认会批量签收当前提醒，查看按钮直达对应作业', () => {
  assert.match(source, /api\.post\('\/homework\/notices\/seen', \{ notice_ids: homeworkNoticeIds\.value \}\)/);
  assert.match(source, /async function dismissHomeworkNotice/);
  assert.match(source, /async function openHomeworkNotice/);
  assert.match(source, /student_id=\$\{notice\.student_id\}&batch_id=\$\{notice\.batch_id\}/);
});
