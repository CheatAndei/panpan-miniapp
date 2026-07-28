const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'components', 'pp-icon', 'pp-icon.vue'),
  'utf8',
);

test('pp-icon exposes opt-in motion with a stable default', () => {
  for (const motion of ['none', 'breathe', 'bob', 'pop', 'ring', 'shine']) {
    assert.match(source, new RegExp(`'${motion}'`));
  }

  assert.match(source, /motion:\s*\{[\s\S]*?default:\s*'none'/);
  assert.match(
    source,
    /validator:\s*\(value\)\s*=>\s*\['none',\s*'breathe',\s*'bob',\s*'pop',\s*'ring',\s*'shine'\]\.includes\(value\)/,
  );
  assert.match(source, /delay:\s*\{\s*type:\s*\[Number,\s*String\],\s*default:\s*0\s*\}/);
  assert.match(source, /stagger:\s*\{\s*type:\s*\[Number,\s*String\],\s*default:\s*0\s*\}/);
  assert.match(source, /index:\s*\{\s*type:\s*\[Number,\s*String\],\s*default:\s*0\s*\}/);
  assert.match(source, /delay\s*\+\s*stagger\s*\*\s*index/);
  assert.match(source, /safeMotion\.value\s*===\s*'none'\s*\?\s*''/);
});

test('pp-icon motion stays transform-and-opacity only and within timing guidance', () => {
  const style = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] || '';

  for (const motion of ['breathe', 'bob', 'pop', 'ring', 'shine']) {
    assert.match(style, new RegExp(`\\.pp-icon--motion-${motion}`));
    assert.match(style, new RegExp(`@keyframes pp-icon-${motion}`));
  }

  assert.match(style, /pp-icon-pop 420ms/);
  assert.match(style, /pp-icon-ring 560ms/);
  assert.match(style, /pp-icon-breathe 2400ms/);
  assert.match(style, /pp-icon-bob 2200ms/);
  assert.match(style, /pp-icon-shine 2800ms/);

  const keyframes = style.slice(style.indexOf('@keyframes'));
  assert.doesNotMatch(
    keyframes,
    /\b(?:top|right|bottom|left|width|height|margin|padding|filter|box-shadow|background)\s*:/,
  );
});

test('pp-icon preserves accessibility and fully disables motion on request', () => {
  assert.match(source, /:role="isDecorative \? undefined : 'img'"/);
  assert.match(source, /:aria-label="accessibleLabel"/);
  assert.match(source, /:aria-hidden="isDecorative"/);
  assert.match(source, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(source, /animation:\s*none !important/);
  assert.match(source, /opacity:\s*1 !important/);
  assert.match(source, /transform:\s*none !important/);
});
