const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadQueryBuilder() {
  const filename = path.join(root, 'utils', 'query.js');
  const source = fs.readFileSync(filename, 'utf8')
    .replace(/export\s+/g, '')
    + '\nmodule.exports = { buildQuery };';
  const context = {
    module: { exports: {} },
    exports: {},
    encodeURIComponent,
    Object,
    String,
  };
  vm.runInNewContext(source, context, { filename });
  return context.module.exports;
}

test('exam library builds encoded queries without the browser-only URLSearchParams global', () => {
  const page = read('pages/exam-library/index.vue');
  assert.doesNotMatch(page, /URLSearchParams/);
  assert.match(page, /buildQuery/);

  const { buildQuery } = loadQueryBuilder();
  assert.equal(
    buildQuery({ page: 1, limit: 20, keyword: '广州 中学', empty: '', omitted: undefined }),
    'page=1&limit=20&keyword=%E5%B9%BF%E5%B7%9E%20%E4%B8%AD%E5%AD%A6'
  );
});
