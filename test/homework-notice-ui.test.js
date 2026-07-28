const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'pages/index/index.vue'), 'utf8');
const notice = fs.readFileSync(path.join(root, 'components/home/HomeworkNoticeDialog.vue'), 'utf8');

test('家长首页读取作业未读提醒并显示批改完成弹窗', () => {
  assert.match(page, /\/homework\/notices\?unread=1&limit=50/);
  assert.match(page, /<HomeworkNoticeDialog/);
  assert.match(page, /:count="homeworkNoticeCount"/);
  assert.match(notice, /作业批改完成/);
  assert.match(notice, /已批改完成/);
  assert.match(notice, /另有 \{\{ count - 1 \}\} 份/);
  assert.match(notice, /知道了/);
  assert.match(notice, /'查看作业'/);
});

test('查看或确认会批量签收当前提醒，查看按钮直达对应作业', () => {
  assert.match(page, /api\.post\('\/homework\/notices\/seen', \{ notice_ids: homeworkNoticeIds\.value \}\)/);
  assert.match(page, /async function dismissHomeworkNotice/);
  assert.match(page, /async function openHomeworkNotice/);
  assert.match(page, /@dismiss="dismissHomeworkNotice"/);
  assert.match(page, /@open="openHomeworkNotice"/);
  assert.match(page, /student_id=\$\{notice\.student_id\}&batch_id=\$\{notice\.batch_id\}/);
});

test('作业提醒在长标题和矮屏下可以滚动看到操作按钮', () => {
  assert.match(notice, /max-height:\s*calc\(100vh - 120rpx\)/);
  assert.match(notice, /overflow-y:\s*auto/);
  assert.match(notice, /overflow-wrap:\s*anywhere/);
});
