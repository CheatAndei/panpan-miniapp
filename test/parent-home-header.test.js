const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const homeSource = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'index', 'index.vue'),
  'utf8'
);

test('家长首页在异步头部渲染完成后回到页面顶部', () => {
  assert.match(homeSource, /loadParentData\(\)\.finally\(resetHomeScroll\)/);
  assert.match(homeSource, /uni\.pageScrollTo\(\{\s*scrollTop:\s*0,\s*duration:\s*0\s*\}\)/);
});

test('家长问候语使用稳定且不会裁字的行盒', () => {
  assert.match(homeSource, /\.child-greeting\s*\{[^}]*line-height:\s*1\.45[^}]*overflow:\s*visible[^}]*\}/s);
});
