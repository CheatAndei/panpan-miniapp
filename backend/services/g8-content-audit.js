const crypto = require('node:crypto');
const { choices, fills, subjectives, sample } = require('../resources/g8-content/bank');
const { topics, topicKeySet } = require('../resources/g8-content/topics');
const { hasMalformedSignedOperators } = require('../utils/math-expression');

const EXPECTED = Object.freeze({
  topics: 12,
  choice_per_topic: 60,
  fill_per_topic: 12,
  subjective_per_topic: 12,
  choice_total: 720,
  fill_total: 144,
  subjective_total: 144,
  total: 1008,
  sample_total: 48,
});

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function textFields(item) {
  return [
    item.stem,
    item.prompt,
    item.answer,
    item.answer_text,
    item.explanation,
    ...Object.values(item.options || {}),
  ].filter((value) => value !== undefined && value !== null).map(String);
}

function auditG8ContentBank() {
  const errors = [];
  const warnings = [];
  const all = [...choices, ...fills, ...subjectives];
  const stableKeys = new Set();
  const contentFingerprints = new Set();

  if (topics.length !== EXPECTED.topics) errors.push(`固定范围数量应为 ${EXPECTED.topics}，实际 ${topics.length}`);
  if (choices.length !== EXPECTED.choice_total) errors.push(`客观题应为 ${EXPECTED.choice_total}，实际 ${choices.length}`);
  if (fills.length !== EXPECTED.fill_total) errors.push(`填空题应为 ${EXPECTED.fill_total}，实际 ${fills.length}`);
  if (subjectives.length !== EXPECTED.subjective_total) errors.push(`解答题应为 ${EXPECTED.subjective_total}，实际 ${subjectives.length}`);
  if (all.length !== EXPECTED.total) errors.push(`总题量应为 ${EXPECTED.total}，实际 ${all.length}`);
  if (sample.length !== EXPECTED.sample_total) errors.push(`样板应为 ${EXPECTED.sample_total}，实际 ${sample.length}`);

  for (const topic of topics) {
    const topicChoices = choices.filter((item) => item.topic_key === topic.topic_key);
    const topicFills = fills.filter((item) => item.topic_key === topic.topic_key);
    const topicSubjectives = subjectives.filter((item) => item.topic_key === topic.topic_key);
    if (topicChoices.length !== EXPECTED.choice_per_topic) errors.push(`${topic.title} 客观题数量 ${topicChoices.length}`);
    if (topicFills.length !== EXPECTED.fill_per_topic) errors.push(`${topic.title} 填空题数量 ${topicFills.length}`);
    if (topicSubjectives.length !== EXPECTED.subjective_per_topic) errors.push(`${topic.title} 解答题数量 ${topicSubjectives.length}`);
    const topicSample = sample.filter((item) => item.topic_key === topic.topic_key);
    const sampleTypes = topicSample.map((item) => item.question_type || 'choice').sort();
    if (topicSample.length !== 4 || sampleTypes.join(',') !== 'choice,choice,fill,subjective') {
      errors.push(`${topic.title} 样板应为 2 客观 + 1 填空 + 1 解答`);
    }
  }

  for (const item of all) {
    const key = item.stable_code || item.source_key;
    if (!key) errors.push('题目缺少稳定键');
    else if (stableKeys.has(key)) errors.push(`稳定键重复：${key}`);
    else stableKeys.add(key);
    if (item.grade_code !== 'g8' || item.subject_code !== 'math') errors.push(`${key} 年级或学科错误`);
    if (!topicKeySet.has(item.topic_key)) errors.push(`${key} 主范围无效`);
    if (!Array.isArray(item.topic_keys) || !item.topic_keys.length
      || item.topic_keys[0] !== item.topic_key
      || item.topic_keys.some((topicKey) => !topicKeySet.has(topicKey))) {
      errors.push(`${key} 多范围标签无效`);
    }
    if (item.provenance !== 'self_authored') errors.push(`${key} 来源属性错误`);
    if (/广州(?:真题|中考真题)/u.test(String(item.source_label || ''))) errors.push(`${key} 原创题不得标为广州真题`);
    for (const text of textFields(item)) {
      if (!text.trim()) errors.push(`${key} 存在空文本`);
      if (/undefined|NaN/u.test(text)) errors.push(`${key} 存在未定义内容`);
      if (hasMalformedSignedOperators(text)) errors.push(`${key} 存在正负号连写：${text}`);
    }

    if (item.stable_code) {
      const optionKeys = Object.keys(item.options || {});
      if (optionKeys.join(',') !== 'A,B,C,D') errors.push(`${key} 选项必须完整为 A-D`);
      if (!optionKeys.includes(item.correct_option)) errors.push(`${key} 正确选项无效`);
      if (new Set(Object.values(item.options || {})).size !== 4) errors.push(`${key} 选项重复`);
      if (!String(item.explanation || '').trim()) errors.push(`${key} 缺少解析`);
    } else {
      if (!['fill', 'subjective'].includes(item.question_type)) errors.push(`${key} 压轴题型无效`);
      if (!String(item.prompt || '').trim() || !String(item.answer_text || '').trim()) errors.push(`${key} 题干或答案为空`);
      if (!['triangle', 'symmetry', 'algebra', 'parallel', 'one-line', 'rotation'].includes(item.diagram)) {
        errors.push(`${key} 示意图类型无效`);
      }
    }

    const content = item.stable_code
      ? [item.stem, item.options, item.correct_option]
      : [item.question_type, item.prompt, item.answer_text];
    const digest = fingerprint(content);
    if (contentFingerprints.has(digest)) errors.push(`${key} 与其他题完全重复`);
    contentFingerprints.add(digest);
  }

  const multiTagged = all.filter((item) => item.topic_keys.length > 1).length;
  if (multiTagged < 200) warnings.push(`多范围题仅 ${multiTagged} 道，低于建议 200 道`);

  return {
    ok: errors.length === 0,
    expected: EXPECTED,
    counts: {
      choice: choices.length,
      fill: fills.length,
      subjective: subjectives.length,
      total: all.length,
      sample: sample.length,
      multi_tagged: multiTagged,
    },
    errors,
    warnings,
    content_sha256: fingerprint(all),
    sample_sha256: fingerprint(sample),
  };
}

function assertG8ContentBank() {
  const report = auditG8ContentBank();
  if (!report.ok) {
    throw new Error(`八年级题库审计失败：${report.errors.length}\n${report.errors.slice(0, 30).join('\n')}`);
  }
  return report;
}

module.exports = {
  EXPECTED,
  auditG8ContentBank,
  assertG8ContentBank,
};
