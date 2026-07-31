const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('练习与工具第 03 项进入八年级进度控制管理', () => {
  const tools = read('pages/teacher-tools/index.vue');
  const entries = [...tools.matchAll(/\{ title: '([^']+)'[\s\S]*?url: '([^']+)' \}/gu)]
    .map((match) => ({ title: match[1], url: match[2] }));
  assert.deepEqual(entries[2], {
    title: '进度控制管理',
    url: '/pages/content-progress/index',
  });
  assert.match(read('pages.json'), /pages\/content-progress\/index/);
});

test('进度控制支持班级切换、全开、全停和 12 讲多标签说明', () => {
  const page = read('pages/content-progress/index.vue');
  assert.match(page, /\/content-progress\/classes\/\$\{classId\.value\}/);
  assert.match(page, /function enableAll\(\)/);
  assert.match(page, /function disableAll\(\)/);
  assert.match(page, /topic_keys:\s*selectedKeys\.value/);
  assert.match(page, /必须所有相关范围都已开启/);
  assert.match(page, /试卷库始终开放/);
  assert.match(page, /未完成题目立即撤回/);
});

test('打卡计划按所选班级加载年级题库，历史计划不随班级年级修改', () => {
  const page = read('pages/practice-teacher/index.vue');
  assert.match(page, /\/content-progress\/practice-catalog\?class_id=/);
  assert.match(page, /调整班级年级后，新计划自动使用对应题库，历史计划不变/);
  assert.match(page, /practiceCatalog\?\.class\?\.grade_label/);
});

test('学生端按年级展示特色项目，八年级轻量练习恢复知识点大全、错题清零与口算王', () => {
  const page = read('pages/learning-center/index.vue');
  const service = read('backend/services/learning.js');
  const knowledge = read('pages/knowledge-challenge/index.vue');
  assert.match(page, /\{value:'g7',label:'七年级',sub:'口算王'\}/);
  assert.match(page, /\{value:'g8',label:'八年级',sub:'知识点大全'\}/);
  assert.match(page, /'wrong', 'practice', 'knowledge'/);
  assert.match(page, /item\.route === 'knowledge_challenge'/);
  assert.match(service, /type: 'knowledge', title: '知识点大全'/);
  assert.match(service, /type: 'wrong', \.\.\.TASKS\.wrong/);
  assert.match(service, /七、八年级混合排行/);
  assert.match(knowledge, /class="hero-title">知识点大全</);
});
