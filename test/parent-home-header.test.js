const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const homeSource = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'index', 'index.vue'),
  'utf8'
);
const parentHomeSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'home', 'ParentHomeView.vue'),
  'utf8'
);

test('家长首页在异步头部渲染完成后回到页面顶部', () => {
  assert.match(homeSource, /loadParentData\(\)\.finally\(resetHomeScroll\)/);
  assert.match(homeSource, /uni\.pageScrollTo\(\{\s*scrollTop:\s*0,\s*duration:\s*0\s*\}\)/);
});

test('家长问候语使用稳定且不会裁字的行盒', () => {
  assert.match(homeSource, /<ParentHomeView/);
  assert.match(parentHomeSource, /\.child-greeting\s*\{[^}]*overflow:\s*visible[^}]*line-height:\s*1\.45[^}]*\}/s);
});

test('切换孩子不会被后台刷新吞掉，失败时旧孩子页面也有重试入口', () => {
  assert.match(homeSource, /let queuedParentChildId = null/);
  assert.match(homeSource, /if \(parentLoading\.value\)[\s\S]*?queuedParentChildId = explicitChildId/u);
  assert.match(homeSource, /nextTick\(\(\) => loadParentData\(nextChildId\)\)/);
  assert.match(homeSource, /setInterval\(\(\) => loadParentData\(\), 30000\)/);
  assert.match(parentHomeSource, /v-if="parentError && child"/);
  assert.match(parentHomeSource, /@tap="\$emit\('reload', child\.id\)"/);
  assert.match(parentHomeSource, /\.child-chip\s*\{[\s\S]*?min-height:\s*112rpx/u);
  assert.match(parentHomeSource, /\.parent-nav-item\s*\{[\s\S]*?min-height:\s*112rpx/u);
});
