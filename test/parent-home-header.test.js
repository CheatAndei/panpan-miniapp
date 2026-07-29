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
  assert.match(parentHomeSource, /\.child-chip\s*\{[\s\S]*?min-height:\s*78rpx/u);
  assert.match(parentHomeSource, /\.parent-nav-item\s*\{[\s\S]*?min-height:\s*78rpx/u);
  assert.doesNotMatch(parentHomeSource, /#(?:3268D6|1E4EA8|315EA8|527CC9)/iu);
});

test('家长首页用小图标组织任务、成长与家校服务，但不依赖符号占位', () => {
  const iconNames = [...parentHomeSource.matchAll(/<pp-icon\b[^>]*name="([^"]+)"/g)]
    .map((match) => match[1]);
  const iconSizes = [...parentHomeSource.matchAll(/<pp-icon\b[^>]*:size="(\d+)"/g)]
    .map((match) => Number(match[1]));

  assert.ok(iconNames.length >= 18);
  for (const name of [
    'user',
    'calculator',
    'calendar',
    'book',
    'trophy',
    'target',
    'bell',
    'message',
    'school',
    'clock',
    'document',
    'trend',
    'family',
  ]) {
    assert.ok(iconNames.includes(name), `家长首页应包含 ${name} 图标`);
  }
  assert.ok(iconSizes.every((size) => size >= 20 && size <= 48));
  assert.match(parentHomeSource, /<pp-icon[\s\S]{0,120}:name="task\.completed \? 'check' : taskIcon\(task\)"/);
  assert.match(parentHomeSource, /motion="(?:breathe|bob|pop|ring|shine)"/);
  assert.match(parentHomeSource, /:motion="task\.completed \? 'pop'/);
  assert.doesNotMatch(parentHomeSource, /#(?:5B9DF7|337BD8|FFC94A|B27600|FFF6D8|EDF4FF)/i);
  assert.doesNotMatch(parentHomeSource, /<svg\b|[✓□★⭐🔒📌📚🎯✨💡]/u);
});

test('家长首页以文具涂鸦、双状态卡和分组容器建立信息层级', () => {
  assert.match(parentHomeSource, /class="parent-hero-doodle"/);
  assert.match(parentHomeSource, /class="home-glance-grid"/);
  assert.equal((parentHomeSource.match(/class="home-section-block/g) || []).length, 2);
  assert.match(parentHomeSource, /COURSE TRACE/);
  assert.match(parentHomeSource, /LEARNING KIT/);
  assert.match(parentHomeSource, /\.home-section-block\s*>\s*\.home-card\s*\{[\s\S]*?box-shadow:\s*none/u);
  assert.match(parentHomeSource, /\.task-position\.done\s*\{[\s\S]*?background:\s*var\(--primary-soft\)/u);
});
