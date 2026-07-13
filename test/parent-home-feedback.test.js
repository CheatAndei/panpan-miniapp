const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'pages', 'index', 'index.vue'), 'utf8');
const component = fs.readFileSync(path.join(root, 'components', 'pp-homework-brief', 'pp-homework-brief.vue'), 'utf8');
const feedbackRoute = fs.readFileSync(path.join(root, 'backend', 'routes', 'feedbacks.js'), 'utf8');
const notifyRoute = fs.readFileSync(path.join(root, 'backend', 'routes', 'notify.js'), 'utf8');

test('家长首页在最新反馈上方显示独立作业说明组件', () => {
  const briefAt = home.indexOf('<pp-homework-brief');
  const feedbackAt = home.indexOf('<!-- 最新反馈 -->');
  assert.ok(briefAt > 0 && briefAt < feedbackAt);
  assert.match(home, /:content="feedbackHomework\(latestFeedback\)"/);
  assert.match(home, /feedbackSummaryWithoutHomework\(latestFeedback\.summary\)/);
  assert.doesNotMatch(home, /class="hw-card"/);
});

test('作业说明组件有个性化标题、空态和非点击式大字排版', () => {
  assert.match(component, /今日课后任务/);
  assert.match(component, /老师还没有布置本讲作业/);
  assert.match(component, /pp-icon name="clipboard"/);
  assert.match(component, /line-height:\s*1\.[5-9]/);
  assert.doesNotMatch(component, /@tap|@click/);
});

test('新反馈不再把作业写进 summary，课后反馈通知回到家长首页', () => {
  assert.doesNotMatch(feedbackRoute, /📚 作业说明/);
  assert.match(feedbackRoute, /不要把作业写进反馈正文/);
  const notifyBlock = notifyRoute.match(/router\.notifyFeedback[\s\S]*?\n\};/u)?.[0] || '';
  assert.match(notifyBlock, /pages\/index\/index/);
  assert.doesNotMatch(notifyBlock, /pages\/parent-feedback\/index/);
});
