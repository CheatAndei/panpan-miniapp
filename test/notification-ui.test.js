const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('通知状态只说明配置就绪，不把环境变量存在误报为运行正常', () => {
  const mine = read('pages/mine/index.vue');
  assert.match(mine, /通知配置已就绪/u);
  assert.doesNotMatch(mine, /通知服务运行正常/u);
});

test('课程发布失败提示会展示后端返回的具体通知原因', () => {
  const schedule = read('pages/teacher-schedule/index.vue');
  assert.match(schedule, /notify\.error\|\|notify\.errors\?\.\[0\]/u);
});

test('家长订阅入口覆盖签到、签退、上课、反馈和作业五类通知', () => {
  for (const file of ['pages/index/index.vue', 'pages/parent-home/index.vue']) {
    const source = read(file);
    assert.match(source, /tplRes\.checkin/u, file);
    assert.match(source, /tplRes\.checkout/u, file);
    assert.match(source, /tplRes\.reminder/u, file);
    assert.match(source, /tplRes\.feedback/u, file);
    assert.match(source, /tplRes\.homework/u, file);
  }
});
