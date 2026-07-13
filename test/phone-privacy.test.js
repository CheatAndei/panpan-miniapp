const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sourceRoots = ['pages', 'components', 'stores', 'utils'];
const sourceFiles = ['App.vue', 'main.js'];
const forbidden = /\bphone\b|teacher_phone|teacherPhone|手机号|手机号码|联系电话|联系方式|电话/i;

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    return /\.(vue|js|json)$/.test(entry.name) ? [fullPath] : [];
  });
}

test('小程序源码不包含电话采集、展示或提交逻辑', () => {
  const files = [
    ...sourceRoots.flatMap((directory) => collectFiles(path.join(root, directory))),
    ...sourceFiles.map((file) => path.join(root, file)),
  ];
  const violations = files.filter((file) => forbidden.test(fs.readFileSync(file, 'utf8')));
  assert.deepEqual(violations.map((file) => path.relative(root, file)), []);
});
