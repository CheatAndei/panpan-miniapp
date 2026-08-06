const test = require('node:test');
const assert = require('node:assert/strict');

const blueprint = require('../resources/practice/g8-calculation-v2-blueprint.json');
const {
  metadata,
  questions,
  verification,
  evaluateAlgebra,
  verifyQuestion,
  auditQuestionBank,
} = require('../resources/practice/g8-calculation-v2');

const TOPICS = ['幂的运算', '整式乘法', '乘法公式', '因式分解'];

test('v2 蓝图声明独立批次、原创许可与 4×(200+200) 分层结构', () => {
  assert.equal(blueprint.batch_key, 'panpan-g8-calculation-v2-20260806');
  assert.notEqual(blueprint.batch_key, 'panpan-g8-calculation-v1');
  assert.equal(blueprint.version, '2.0.0');
  assert.equal(blueprint.source_license, 'project-original');
  assert.equal(blueprint.provenance, 'self_authored');
  assert.equal(blueprint.copy_allowed, false);
  assert.equal(blueprint.questions_per_topic, 400);
  assert.equal(blueprint.standard_per_topic, 200);
  assert.equal(blueprint.enhanced_per_topic, 200);
  assert.deepEqual(blueprint.difficulty_distribution, { 3: 800, 4: 800 });
  assert.deepEqual(blueprint.topics, TOPICS);
  assert.match(metadata.source_snapshot_sha256, /^[a-f0-9]{64}$/u);
  assert.match(metadata.content_sha256, /^[a-f0-9]{64}$/u);
});

test('1600 道题按四题型各 200 普通 + 200 加强精确分布', () => {
  assert.equal(questions.length, 1600);
  assert.equal(questions.filter((question) => question.difficulty === 3).length, 800);
  assert.equal(questions.filter((question) => question.difficulty === 4).length, 800);
  for (const topic of TOPICS) {
    const rows = questions.filter((question) => question.question_type === topic);
    assert.equal(rows.length, 400, topic);
    assert.equal(rows.filter((question) => question.difficulty === 3).length, 200, `${topic}/普通`);
    assert.equal(rows.filter((question) => question.difficulty === 4).length, 200, `${topic}/加强`);
  }
});

test('题干、数学表达式与 signature 全局唯一，不存在跨难度复用', () => {
  const signatures = new Set(questions.map((question) => question.signature));
  const stems = new Set(questions.map((question) => question.stem));
  const expressions = new Set(verification.records.map((record) => record.expression.replace(/\s+/gu, '')));
  assert.equal(signatures.size, 1600);
  assert.equal(stems.size, 1600);
  assert.equal(expressions.size, 1600);

  const standardExpressions = new Set(verification.records
    .filter((record) => record.tier === 'standard')
    .map((record) => record.expression.replace(/\s+/gu, '')));
  for (const record of verification.records.filter((item) => item.tier === 'enhanced')) {
    assert.equal(standardExpressions.has(record.expression.replace(/\s+/gu, '')), false, record.signature);
  }
});

test('题目严格保持八年级四章范围、项目原创来源及分层用时', () => {
  for (const question of questions) {
    assert.equal(question.grade_band, '初中', question.signature);
    assert.equal(question.grade_code, 'g8', question.signature);
    assert.equal(question.subject, '数学', question.signature);
    assert.equal(question.module, '综合计算', question.signature);
    assert.equal(question.provenance, 'self_authored', question.signature);
    assert.ok(TOPICS.includes(question.question_type), question.signature);
    assert.doesNotMatch(question.stem, /√|sin|cos|tan|log|负指数|分式方程|二次根式/iu, question.signature);
    if (question.difficulty === 3) {
      assert.ok(question.estimated_seconds >= 85 && question.estimated_seconds <= 95, question.signature);
    } else {
      assert.ok(question.estimated_seconds >= 120 && question.estimated_seconds <= 130, question.signature);
    }
  }
});

test('加强层使用多层、多步、综合规则，不是普通层参数放大', () => {
  const records = new Map(verification.records.map((record) => [record.signature, record]));
  for (const topic of TOPICS) {
    const standard = questions.filter((question) => question.question_type === topic && question.difficulty === 3)
      .map((question) => records.get(question.signature).structural_steps);
    const enhanced = questions.filter((question) => question.question_type === topic && question.difficulty === 4)
      .map((question) => records.get(question.signature).structural_steps);
    assert.equal(enhanced.every((steps) => steps >= 3), true, topic);
    const standardAverage = standard.reduce((sum, value) => sum + value, 0) / standard.length;
    const enhancedAverage = enhanced.reduce((sum, value) => sum + value, 0) / enhanced.length;
    assert.ok(enhancedAverage >= standardAverage + 1.4, `${topic}: ${standardAverage} -> ${enhancedAverage}`);

    const enhancedTemplates = new Set(questions
      .filter((question) => question.question_type === topic && question.difficulty === 4)
      .map((question) => question.template_key));
    assert.equal(enhancedTemplates.size, 10, `${topic}/加强模板族`);
    for (const template of enhancedTemplates) {
      assert.equal(questions.filter((question) => question.template_key === template).length, 20, template);
    }
  }
});

test('独立代数解析器支持隐式乘法、幂、括号及因式形式', () => {
  assert.equal(evaluateAlgebra('2x(x+3)', { x: 4 }), 56);
  assert.equal(evaluateAlgebra('(x+5)(x-5)', { x: 7 }), 24);
  assert.equal(evaluateAlgebra('3x²-12', { x: -2 }), 0);
  assert.equal(evaluateAlgebra('((a²)³·a⁴)÷a²', { a: 2 }), 256);
  assert.equal(evaluateAlgebra('2(x+3y)²', { x: 1, y: 2 }), 98);
});

test('1600 道题逐题以 4 组独立代数取值验算答案', () => {
  assert.equal(verification.method, 'independent-algebraic-sampling-v1');
  assert.equal(verification.records.length, 1600);
  assert.equal(verification.sample_points.length, 4);
  for (const question of questions) {
    const result = verifyQuestion(question);
    assert.equal(result.ok, true, `${question.signature}: ${result.reason || ''}`);
    assert.equal(result.checked_samples, 4, question.signature);
  }
});

test('验算器能够拦截被篡改的答案和题干', () => {
  const source = questions.find((question) => question.question_type === '因式分解' && question.difficulty === 4);
  const wrongAnswer = verifyQuestion({ ...source, answer: '0' });
  assert.equal(wrongAnswer.ok, false);
  assert.equal(wrongAnswer.reason, 'algebraic_answer_mismatch');

  const wrongStem = verifyQuestion({ ...source, stem: source.stem.replace('x', 'y') });
  assert.deepEqual(wrongStem, { ok: false, reason: 'verification_expression_mismatch' });
});

test('全库审计报告覆盖数量、重复、难度结构、用时与逐题答案', () => {
  const report = auditQuestionBank();
  assert.equal(report.ok, true, report.errors.join('\n'));
  assert.deepEqual(report.counts.by_difficulty, { 3: 800, 4: 800 });
  assert.equal(report.counts.total, 1600);
  assert.equal(report.verified_questions, 1600);
  for (const topic of TOPICS) {
    assert.deepEqual(report.counts.by_topic[topic], {
      total: 400,
      difficulty_3: 200,
      difficulty_4: 200,
    });
  }
  assert.match(report.signature_sha256, /^[a-f0-9]{64}$/u);
  assert.match(report.stem_sha256, /^[a-f0-9]{64}$/u);
});
