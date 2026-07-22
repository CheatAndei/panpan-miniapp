const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('删除学生要求确认姓名，并明确两端隐藏但历史保留', () => {
  const source = fs.readFileSync(path.join(root, 'pages/teacher-classes/index.vue'), 'utf8');
  assert.match(source, /@tap\.stop="delStu\(c,s\)"/);
  assert.match(source, /title:`删除\$\{student\.name\}`/);
  assert.match(source, /教师端和家长端将停止显示/);
  assert.match(source, /历史学习记录仍保留在服务器/);
  assert.match(source, /api\.del\('\/students\/'\+student\.id\)/);
});

