const crypto = require('node:crypto');
const blueprint = require('./g8-calculation-v1-blueprint.json');

const questions = [];

function add(topicKey, questionType, index, family, stem, answer, estimatedSeconds = 100) {
  questions.push({
    grade_band: '初中',
    grade_code: 'g8',
    subject: '数学',
    module: '综合计算',
    question_type: questionType,
    difficulty: index < 40 ? 2 : index < 90 ? 3 : 4,
    template_key: `g8-${topicKey}-${family}`,
    stem,
    answer,
    estimated_seconds: estimatedSeconds,
    signature: `g8calc.${topicKey}.${String(index + 1).padStart(3, '0')}`,
    provenance: 'self_authored',
  });
}

for (let index = 0; index < 120; index += 1) {
  const family = index % 12;
  const m = 2 + (index % 5);
  const n = 2 + ((index * 3) % 4);
  const p = 1 + ((index * 5) % 3);
  const c = 2 + (index % 5);
  const d = 2 + ((index * 7) % 4);
  if (family === 0) add('powers', '幂的运算', index, family, `计算：x^${m} · x^${n}`, `x^${m + n}`);
  if (family === 1) add('powers', '幂的运算', index, family, `计算：a^${m + n} ÷ a^${n}（a≠0）`, `a^${m}`);
  if (family === 2) add('powers', '幂的运算', index, family, `计算：(y^${m})^${p + 1}`, `y^${m * (p + 1)}`);
  if (family === 3) add('powers', '幂的运算', index, family, `计算：(a^${m}b^${p})²`, `a^${2 * m}b^${2 * p}`);
  if (family === 4) add('powers', '幂的运算', index, family, `计算：(${c}x^${m})·(${d}x^${n})`, `${c * d}x^${m + n}`);
  if (family === 5) add('powers', '幂的运算', index, family, `计算：(${2 * c}a^${m + n}b^${p + 1})÷(${c}a^${n}b^${p})`, `2a^${m}b`);
  if (family === 6) {
    const exponent = m + n;
    add('powers', '幂的运算', index, family, `化简：(-x)^${exponent}`, exponent % 2 ? `-x^${exponent}` : `x^${exponent}`);
  }
  if (family === 7) add('powers', '幂的运算', index, family, `把 2^${m}×4 写成 2 的幂`, `2^${m + 2}`);
  if (family === 8) add('powers', '幂的运算', index, family, `计算：(ab)^${m}`, `a^${m}b^${m}`);
  if (family === 9) add('powers', '幂的运算', index, family, `计算：(${c}x^${m})²`, `${c * c}x^${2 * m}`);
  if (family === 10) add('powers', '幂的运算', index, family, `计算：x^${m + p}·x^${n}÷x^${p}（x≠0）`, `x^${m + n}`);
  if (family === 11) add('powers', '幂的运算', index, family, `计算：(2a^${m}b)^3`, `8a^${3 * m}b^3`);
}

for (let index = 0; index < 120; index += 1) {
  const family = index % 12;
  const a = 2 + (index % 6);
  const b = 1 + ((index * 3) % 7);
  const c = 2 + ((index * 5) % 5);
  const d = 1 + ((index * 7) % 6);
  if (family === 0) add('polynomial', '整式乘法', index, family, `${a}x(x+${b})`, `${a}x²+${a * b}x`);
  if (family === 1) add('polynomial', '整式乘法', index, family, `${a}m(m²-${b})`, `${a}m³-${a * b}m`);
  if (family === 2) add('polynomial', '整式乘法', index, family, `(x+${a})(x+${b})`, `x²+${a + b}x+${a * b}`);
  if (family === 3) add('polynomial', '整式乘法', index, family, `(x-${a})(x+${a + b})`, `x²+${b}x-${a * (a + b)}`);
  if (family === 4) add('polynomial', '整式乘法', index, family, `(${a}x+${b})(${c}x+${d})`, `${a * c}x²+${a * d + b * c}x+${b * d}`, 115);
  if (family === 5) add('polynomial', '整式乘法', index, family, `${a}x²(${b}x-${c})`, `${a * b}x³-${a * c}x²`);
  if (family === 6) add('polynomial', '整式乘法', index, family, `(x+${a})(x²+${b}x+${c})`, `x³+${a + b}x²+${a * b + c}x+${a * c}`, 120);
  if (family === 7) add('polynomial', '整式乘法', index, family, `(2x+${a})(x+${b})`, `2x²+${2 * b + a}x+${a * b}`);
  if (family === 8) add('polynomial', '整式乘法', index, family, `${a}x(x+${b})-${c}x²`, `${a - c}x²+${a * b}x`);
  if (family === 9) add('polynomial', '整式乘法', index, family, `(x+${a})(x+${b})-${a * b}`, `x²+${a + b}x`);
  if (family === 10) add('polynomial', '整式乘法', index, family, `${a}x(${b}x²-${c}x+${d})`, `${a * b}x³-${a * c}x²+${a * d}x`);
  if (family === 11) add('polynomial', '整式乘法', index, family, `(${a}x-${b})(${c}x-${d})`, `${a * c}x²-${a * d + b * c}x+${b * d}`, 115);
}

for (let index = 0; index < 120; index += 1) {
  const family = index % 12;
  const a = 2 + (index % 7);
  const b = 1 + ((index * 3) % 6);
  const c = 2 + ((index * 5) % 4);
  if (family === 0) add('formulas', '乘法公式', index, family, `(x+${a})²`, `x²+${2 * a}x+${a * a}`);
  if (family === 1) add('formulas', '乘法公式', index, family, `(x-${a})²`, `x²-${2 * a}x+${a * a}`);
  if (family === 2) add('formulas', '乘法公式', index, family, `(x+${a})(x-${a})`, `x²-${a * a}`);
  if (family === 3) add('formulas', '乘法公式', index, family, `(${c}x+${a})²`, `${c * c}x²+${2 * c * a}x+${a * a}`);
  if (family === 4) add('formulas', '乘法公式', index, family, `(${c}x-${a})²`, `${c * c}x²-${2 * c * a}x+${a * a}`);
  if (family === 5) add('formulas', '乘法公式', index, family, `(${c}x+${a})(${c}x-${a})`, `${c * c}x²-${a * a}`);
  if (family === 6) {
    const value = 90 + a;
    add('formulas', '乘法公式', index, family, `用乘法公式计算：${value}²`, String(value * value));
  }
  if (family === 7) add('formulas', '乘法公式', index, family, `(x+${a})²-(x-${a})²`, `${4 * a}x`);
  if (family === 8) {
    const sum = a + b;
    const product = a * b;
    add('formulas', '乘法公式', index, family, `已知 p+q=${sum}，pq=${product}，求 p²+q²`, String(sum * sum - 2 * product), 115);
  }
  if (family === 9) add('formulas', '乘法公式', index, family, `(a+b)²+(a-b)²`, `2a²+2b²`);
  if (family === 10) add('formulas', '乘法公式', index, family, `(2x+${a})²-(2x-${a})²`, `${8 * a}x`);
  if (family === 11) add('formulas', '乘法公式', index, family, `用乘法公式计算：${100 - a}×${100 + a}`, String(10000 - a * a));
}

for (let index = 0; index < 120; index += 1) {
  const family = index % 12;
  const a = 2 + (index % 7);
  const b = 1 + ((index * 3) % 6);
  const c = 2 + ((index * 5) % 5);
  if (family === 0) add('factorization', '因式分解', index, family, `${a}x+${a}y`, `${a}(x+y)`);
  if (family === 1) add('factorization', '因式分解', index, family, `${a}x²+${a * b}x`, `${a}x(x+${b})`);
  if (family === 2) add('factorization', '因式分解', index, family, `x²-${a * a}`, `(x+${a})(x-${a})`);
  if (family === 3) add('factorization', '因式分解', index, family, `x²+${2 * a}x+${a * a}`, `(x+${a})²`);
  if (family === 4) add('factorization', '因式分解', index, family, `x²-${2 * a}x+${a * a}`, `(x-${a})²`);
  if (family === 5) add('factorization', '因式分解', index, family, `${c}x²-${c * a * a}`, `${c}(x+${a})(x-${a})`);
  if (family === 6) add('factorization', '因式分解', index, family, `${a}x²+${a * b}x`, `${a}x(x+${b})`);
  if (family === 7) add('factorization', '因式分解', index, family, `x²+${a + b}x+${a * b}`, `(x+${a})(x+${b})`, 115);
  if (family === 8) add('factorization', '因式分解', index, family, `x²+${b}x-${a * (a + b)}`, `(x-${a})(x+${a + b})`, 115);
  if (family === 9) add('factorization', '因式分解', index, family, `${c * c}x²-${a * a}`, `(${c}x+${a})(${c}x-${a})`);
  if (family === 10) add('factorization', '因式分解', index, family, `${c}x²+${2 * c * a}x+${c * a * a}`, `${c}(x+${a})²`);
  if (family === 11) add('factorization', '因式分解', index, family, `ax+ay+${b}x+${b}y`, `(a+${b})(x+y)`);
}

if (questions.length !== blueprint.questions_per_topic * blueprint.topics.length) {
  throw new Error(`八年级打卡题库数量异常：${questions.length}`);
}

module.exports = {
  metadata: {
    ...blueprint,
    source_snapshot_sha256: crypto.createHash('sha256').update(JSON.stringify(blueprint)).digest('hex'),
  },
  questions,
};
