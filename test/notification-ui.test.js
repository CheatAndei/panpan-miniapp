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

test('五类模板分批向微信申请，每批不超过三类且提示实际授权数量', () => {
  const source = read('utils/subscribe.js');
  assert.match(source, /index \+= 3/u);
  assert.match(source, /ids\.slice\(index, index \+ 3\)/u);
  assert.match(source, /已开启 \$\{result\.accepted\}\/\$\{result\.total\} 类/u);
});

test('教师端明确列出缺失的通知配置项', () => {
  const mine = read('pages/mine/index.vue');
  assert.match(mine, /notifyMissingLabels/u);
  assert.match(mine, /作业提醒/u);
  assert.match(mine, /缺少：\$\{this\.notifyMissingLabels\.join\('、'\)\}/u);
});

test('生产部署链路会写入作业通知模板及字段映射', () => {
  const workflow = read('.github/workflows/backend-docker-image.yml');
  assert.match(workflow, /PANPAN_TPL_HOMEWORK/u);
  assert.match(workflow, /upsert_env TPL_HOMEWORK/u);
  assert.match(workflow, /TPL_FIELD_HOMEWORK_TITLE thing1/u);
  assert.match(workflow, /TPL_FIELD_HOMEWORK_TIME time2/u);
  assert.match(workflow, /TPL_FIELD_HOMEWORK_NOTE thing3/u);
});
