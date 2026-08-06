const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeChoiceExplanation } = require('../utils/choice-explanation');

const AD_NOISE = '小初高期中末 中考高考真题 加微咨询 天猫：hece.tmall.com';
const AD_NOISE_ALIAS = '小初高期中末 中考高考真题 加微咨询 天猫(禾册) hece.tmall.com';
const COPYRIGHT_NOISE = '1 原创精品资源学科网独家享有版权，侵权必究！ {#{QQABAQqUogCgAgBA=}#}';

test('选择题解析净化广告但保留前后数学步骤', () => {
  const result = sanitizeChoiceExplanation(
    `【解析】10 < x < 50，${AD_NOISE} ${AD_NOISE_ALIAS}只有选项 B 符合要求，故选 B。`,
  );

  assert.equal(result.includes('10 < x < 50'), true);
  assert.equal(result.includes('只有选项 B 符合要求'), true);
  assert.doesNotMatch(result, /hece\.tmall\.com|加微咨询|小初高期中末/u);
});

test('选择题解析净化版权尾注和编码残片但保留尾部推导', () => {
  const result = sanitizeChoiceExplanation(
    `解：5 − 2 < x < 5 + 2，${COPYRIGHT_NOISE}即：3 < x < 7，故选 C。`,
  );

  assert.equal(result.includes('5 − 2 < x < 5 + 2'), true);
  assert.equal(result.includes('3 < x < 7'), true);
  assert.doesNotMatch(result, /学科网|侵权必究|\{#\{/u);
});

test('选择题解析净化可重复执行且不改干净内容', () => {
  const clean = '解：点 M(1,2) 关于 x 轴的对称点是 (1,−2)，故选 C。';
  const once = sanitizeChoiceExplanation(clean);
  assert.equal(once, clean);
  assert.equal(sanitizeChoiceExplanation(once), once);
});
