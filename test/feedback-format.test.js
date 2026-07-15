const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function loadFeedbackModule() {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shared', 'feedback-emojis.json'), 'utf8'));
  const source = fs.readFileSync(path.join(__dirname, '..', 'utils', 'feedback.js'), 'utf8')
    .replace("import feedbackEmojiConfig from '../shared/feedback-emojis.json';", `const feedbackEmojiConfig = ${JSON.stringify(config)};`);
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('小程序端反馈格式化不使用微信旧 JS 引擎不支持的 Unicode 属性正则', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'utils', 'feedback.js'), 'utf8');
  assert.equal(source.includes('\\p{'), false);
});

test('学生反馈统一使用兼容 emoji，并保留分段缩进', async () => {
  const { formatStudentFeedbackText } = await loadFeedbackModule();
  const text = formatStudentFeedbackText('小明', '🪄小明\n第一段。\n第二段。✨');
  assert.equal(text, '小明✨\n　　第一段。\n　　第二段。');
  assert.equal(text.includes('🪄'), false);
});

test('简洁反馈没有表情时补稳定的兼容 emoji，且不重复姓名', async () => {
  const { formatStudentFeedbackText } = await loadFeedbackModule();
  const text = formatStudentFeedbackText('小红', '小红：课堂计算步骤写得很清楚。');
  assert.equal(text, '小红🌟\n　　课堂计算步骤写得很清楚。');
});

test('反馈 emoji 池至少 30 个，且全部是无组合符的单码点', async () => {
  const { SUPPORTED_FEEDBACK_EMOJIS } = await loadFeedbackModule();
  assert.ok(SUPPORTED_FEEDBACK_EMOJIS.length >= 30);
  assert.equal(new Set(SUPPORTED_FEEDBACK_EMOJIS).size, SUPPORTED_FEEDBACK_EMOJIS.length);
  for (const emoji of SUPPORTED_FEEDBACK_EMOJIS) {
    assert.equal([...emoji].length, 1, `${emoji} 不是单码点 emoji`);
    assert.doesNotMatch(emoji, /[\u200D\uFE0F\u{1F3FB}-\u{1F3FF}]/u);
  }
});

test('历史反馈中的死占位符会转换为真实 emoji', async () => {
  const { formatStudentFeedbackText } = await loadFeedbackModule();
  const text = formatStudentFeedbackText('小刚', '[加油]小刚\n今天的列式很清楚。');
  assert.equal(text, '小刚💪\n　　今天的列式很清楚。');
  assert.equal(text.includes('[加油]'), false);
});

test('标题使用 AI 输出中第一个兼容 emoji，不被结尾表情抢占', async () => {
  const { formatStudentFeedbackText } = await loadFeedbackModule();
  const text = formatStudentFeedbackText('小明', '🏆小明\n今天主动讲清了思路。✨');
  assert.equal(text, '小明🏆\n　　今天主动讲清了思路。');
});

test('不兼容的组合 emoji 会移除，且保留后续可用的单码点 emoji', async () => {
  const { formatStudentFeedbackText } = await loadFeedbackModule();
  const text = formatStudentFeedbackText('小明', '🪄小明\n今天主动讲清了思路。🌱');
  assert.equal(text, '小明🌱\n　　今天主动讲清了思路。');
});

test('作业说明优先读取结构化字段，并从历史小组反馈中干净拆出', async () => {
  const { feedbackHomework, feedbackSummaryWithoutHomework } = await loadFeedbackModule();
  const legacy = `各位家长好📘\n五年级 分数\n---\n📖 本讲重点\n· 分数意义\n---\n📚 作业说明\n完成练习册第 12 页\n---\n今天的专注会变成明天的底气。`;
  assert.equal(feedbackHomework({ homework: '完成口算 20 题', summary: legacy }), '完成口算 20 题');
  assert.equal(feedbackHomework({ homework: '', summary: legacy }), '完成练习册第 12 页');
  const summary = feedbackSummaryWithoutHomework(legacy);
  assert.equal(summary.includes('作业说明'), false);
  assert.equal(summary.includes('完成练习册'), false);
  assert.match(summary, /本讲重点/u);
  assert.match(summary, /明天的底气/u);
});
