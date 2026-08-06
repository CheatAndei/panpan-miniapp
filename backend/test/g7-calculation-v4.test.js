const test = require('node:test');
const assert = require('node:assert/strict');

const bank = require('../resources/practice/g7-calculation-v4');
const { validateQuestionDataset } = require('../services/practice-question-import');

const TYPES = [
  '有理数加减',
  '有理数乘除',
  '有理数混合',
  '绝对值计算',
  '有理数巧算',
  '整式化简',
  '整式求值',
  '一元一次方程',
];

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function average(rows, field) {
  return rows.reduce((sum, item) => sum + Number(item.complexity[field]), 0) / rows.length;
}

test('七年级 v4 有 8 题型、每型 200 标准 + 200 加强，共 3200 道', () => {
  assert.equal(bank.metadata.batch_key, 'panpan-g7-calculation-v4-20260806');
  assert.equal(bank.questions.length, 3200);
  assert.equal(bank.blueprint.distribution.total, 3200);
  assert.equal(new Set(bank.questions.map((item) => item.stem)).size, 3200);
  assert.equal(new Set(bank.questions.map((item) => item.signature)).size, 3200);

  for (const questionType of TYPES) {
    const rows = bank.questions.filter((item) => item.question_type === questionType);
    assert.equal(rows.length, 400, questionType);
    assert.equal(rows.filter((item) => item.difficulty === 3).length, 200, questionType + ' 标准题');
    assert.equal(rows.filter((item) => item.difficulty === 4).length, 200, questionType + ' 加强题');
  }
});

test('3200 道题符合导入协议且严格隔离在七年级现有计算章节', () => {
  const validation = validateQuestionDataset(bank);
  assert.deepEqual(validation.errors, []);
  for (const item of bank.questions) {
    assert.equal(item.grade_band, '初中');
    assert.equal(item.grade_code, 'g7');
    assert.equal(item.subject, '数学');
    assert.equal(item.module, '综合计算');
    assert.ok(TYPES.includes(item.question_type));
    assert.equal(item.provenance, 'self_authored');
    assert.doesNotMatch(item.stem, /二次根式|勾股|一次函数|分式方程|竞赛|九年级|八年级/);
    assert.doesNotMatch(item.stem, /(?<![\d.])1(?=[xy(])/, item.signature + ' 单位系数未化简');
  }
});

test('独立 BigInt 有理数与整式验算器逐题复核答案且保持最简', () => {
  let numericCount = 0;
  let polynomialCount = 0;
  let equationCount = 0;
  for (const item of bank.questions) {
    const result = bank.verifyQuestion(item);
    assert.equal(result.ok, true, item.signature + ': ' + result.errors.join('；'));
    assert.equal(result.expected, item.answer, item.signature);

    if (item.verification.kind === 'numeric') {
      numericCount += 1;
      assert.match(item.answer, /^-?\d+(?:\/\d+)?$/, item.signature);
      if (item.answer.includes('/')) {
        const [numerator, denominator] = item.answer.split('/').map(Number);
        assert.ok(denominator > 1, item.signature);
        assert.equal(gcd(numerator, denominator), 1, item.signature);
      }
    } else if (item.verification.kind === 'polynomial') {
      polynomialCount += 1;
      assert.doesNotMatch(item.answer, /\+0|^-0|\+-|--|(?:^|[+-])1(?:x|y)/, item.signature);
    } else if (item.verification.kind === 'equation') {
      equationCount += 1;
      assert.match(item.answer, /^x=-?\d+(?:\/\d+)?$/, item.signature);
      const value = item.answer.slice(2);
      if (value.includes('/')) {
        const [numerator, denominator] = value.split('/').map(Number);
        assert.equal(gcd(numerator, denominator), 1, item.signature);
      }
    }
  }
  assert.equal(numericCount, 2400);
  assert.equal(polynomialCount, 400);
  assert.equal(equationCount, 400);
});

test('加强题真实增加步骤、括号和易错点，不是只替换大数', () => {
  for (const questionType of TYPES) {
    const standard = bank.questions.filter((item) => item.question_type === questionType && item.difficulty === 3);
    const advanced = bank.questions.filter((item) => item.question_type === questionType && item.difficulty === 4);
    assert.ok(average(advanced, 'steps') >= average(standard, 'steps') + 1.5, questionType + ' 步骤增量');
    assert.ok(average(advanced, 'grouping') > average(standard, 'grouping'), questionType + ' 括号增量');
    assert.ok(average(advanced, 'pitfalls') > average(standard, 'pitfalls'), questionType + ' 易错点增量');
    assert.ok(advanced.every((item) => item.complexity.steps >= 5), questionType + ' 加强步骤下限');
    assert.ok(advanced.every((item) => item.complexity.grouping >= 2), questionType + ' 加强括号下限');
    assert.ok(advanced.some((item) => item.complexity.number_forms >= 2), questionType + ' 数形态覆盖');
    assert.ok(advanced.every((item) => (item.stem.match(/[+\-×÷/²³|=]/g) || []).length >= 4), questionType + ' 运算层级');
  }
});

test('默认 12 标准题与能力达标后的 6+6 都在 18–22 分钟预算内', () => {
  const audit = bank.auditQuestionBank();
  assert.equal(audit.ok, true, audit.failures.join('\n'));
  assert.deepEqual(audit.by_difficulty, { 3: 1600, 4: 1600 });
  assert.deepEqual(audit.daily_seconds, {
    standard_12: 1080,
    mixed_6_plus_6: 1290,
  });
  assert.ok(audit.daily_seconds.standard_12 >= 1080 && audit.daily_seconds.standard_12 <= 1320);
  assert.ok(audit.daily_seconds.mixed_6_plus_6 >= 1080 && audit.daily_seconds.mixed_6_plus_6 <= 1320);
});
