const crypto = require('node:crypto');
const blueprint = require('./g8-calculation-v2-blueprint.json');

const TOPIC_KEYS = Object.freeze({
  幂的运算: 'powers',
  整式乘法: 'polynomial',
  乘法公式: 'formulas',
  因式分解: 'factorization',
});

const SAMPLE_POINTS = Object.freeze([
  Object.freeze({ x: 2, y: 3, a: 5, b: 7, m: 11, n: 13 }),
  Object.freeze({ x: -3, y: 2, a: -2, b: 5, m: 7, n: -4 }),
  Object.freeze({ x: 5, y: -2, a: 3, b: -3, m: -5, n: 2 }),
  Object.freeze({ x: -2, y: -3, a: 4, b: 2, m: 3, n: 6 }),
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function powerText(variable, exponent) {
  if (exponent === 0) return '';
  if (exponent === 1) return variable;
  if (exponent === 2) return `${variable}²`;
  if (exponent === 3) return `${variable}³`;
  if (exponent === 4) return `${variable}⁴`;
  return `${variable}^${exponent}`;
}

function formatMonomial(coefficient, exponents) {
  if (!coefficient) return '0';
  const factors = Object.entries(exponents)
    .filter(([, exponent]) => exponent > 0)
    .map(([variable, exponent]) => powerText(variable, exponent))
    .join('');
  const magnitude = Math.abs(coefficient);
  const coefficientText = magnitude === 1 && factors ? '' : String(magnitude);
  return `${coefficient < 0 ? '-' : ''}${coefficientText}${factors}`;
}

function trimPolynomial(coefficients) {
  const result = coefficients.slice();
  while (result.length > 1 && result[result.length - 1] === 0) result.pop();
  return result;
}

function addPolynomial(left, right) {
  const length = Math.max(left.length, right.length);
  const result = Array.from({ length }, (_, index) => (left[index] || 0) + (right[index] || 0));
  return trimPolynomial(result);
}

function scalePolynomial(polynomial, scalar) {
  return trimPolynomial(polynomial.map((coefficient) => coefficient * scalar));
}

function subtractPolynomial(left, right) {
  return addPolynomial(left, scalePolynomial(right, -1));
}

function multiplyPolynomial(left, right) {
  const result = Array(left.length + right.length - 1).fill(0);
  left.forEach((leftCoefficient, leftExponent) => {
    right.forEach((rightCoefficient, rightExponent) => {
      result[leftExponent + rightExponent] += leftCoefficient * rightCoefficient;
    });
  });
  return trimPolynomial(result);
}

const constantPolynomial = (value) => [value];
const linearPolynomial = (xCoefficient, constant) => [constant, xCoefficient];
const xPowerPolynomial = (exponent) => Array.from({ length: exponent + 1 }, (_, index) => index === exponent ? 1 : 0);

function formatPolynomial(coefficients, variable = 'x') {
  const parts = [];
  trimPolynomial(coefficients).forEach((coefficient, exponent) => {
    if (!coefficient) return;
    const factor = powerText(variable, exponent);
    const magnitude = Math.abs(coefficient);
    const atom = `${magnitude === 1 && factor ? '' : magnitude}${factor}`;
    parts.push({ exponent, coefficient, atom });
  });
  parts.sort((left, right) => right.exponent - left.exponent);
  return parts.map(({ coefficient, atom }, index) => {
    if (index === 0) return coefficient < 0 ? `-${atom}` : atom;
    return coefficient < 0 ? `-${atom}` : `+${atom}`;
  }).join('') || '0';
}

function variantParameters(variant) {
  return {
    a: variant + 2,
    p: 2 + (variant % 10),
    q: 2 + Math.floor(variant / 10),
    r: 2 + ((variant * 3 + 1) % 7),
    s: 1 + ((variant * 5 + 2) % 6),
  };
}

function powerStandard({ p, q }, family) {
  const families = [
    () => ({ expression: `x^${p}·x^${q}`, answer: formatMonomial(1, { x: p + q }), steps: 1 }),
    () => ({ expression: `(a^${p})^${q}`, answer: formatMonomial(1, { a: p * q }), steps: 1 }),
    () => ({ expression: `(x^${p}y^${q})²`, answer: formatMonomial(1, { x: 2 * p, y: 2 * q }), steps: 2 }),
    () => ({ expression: `(${q}x^${p})·(${p}x^${q})`, answer: formatMonomial(p * q, { x: p + q }), steps: 2 }),
    () => ({ expression: `(${q}a^${p}b)³`, answer: formatMonomial(q ** 3, { a: 3 * p, b: 3 }), steps: 2 }),
    () => ({ expression: `x^${p + q}÷x^${q}`, answer: formatMonomial(1, { x: p }), condition: 'x≠0', steps: 1 }),
    () => ({
      expression: `(${2 * q}a^${p + q}b^${q + 1})÷(${q}a^${q}b)`,
      answer: formatMonomial(2, { a: p, b: q }),
      condition: 'a≠0，b≠0',
      steps: 2,
    }),
    () => ({
      expression: `x^${p + 1}·x^${q + 2}÷x^${q}`,
      answer: formatMonomial(1, { x: p + 3 }),
      condition: 'x≠0',
      steps: 2,
    }),
    () => ({ expression: `(x^${p})²·x^${q}`, answer: formatMonomial(1, { x: 2 * p + q }), steps: 2 }),
    () => ({ expression: `(${q}a^${p}b)²`, answer: formatMonomial(q ** 2, { a: 2 * p, b: 2 }), steps: 2 }),
  ];
  return families[family]();
}

function powerEnhanced({ p, q }, family) {
  const families = [
    () => ({
      expression: `((x^${p})^${q}·x^${p + q})÷x^${p}`,
      answer: formatMonomial(1, { x: p * q + q }),
      condition: 'x≠0', steps: 4,
    }),
    () => ({
      expression: `((2a^${p}b^${q})²·(3a^${q}b))÷(6a²b^${q})`,
      answer: formatMonomial(2, { a: 2 * p + q - 2, b: q + 1 }),
      condition: 'a≠0，b≠0', steps: 5,
    }),
    () => ({
      expression: `((x^${p}y^${q})³)²÷(x^${p + q}y^${q})`,
      answer: formatMonomial(1, { x: 5 * p - q, y: 5 * q }),
      condition: 'x≠0，y≠0', steps: 4,
    }),
    () => ({
      expression: `((-2x^${p}y^${q})²·(3x^${q}y)³)÷(6x^${p}y²)`,
      answer: formatMonomial(18, { x: p + 3 * q, y: 2 * q + 1 }),
      condition: 'x≠0，y≠0', steps: 6,
    }),
    () => ({
      expression: `((a^${p})^${q}·(a^${p + q})²)÷a^${p + 2 * q}`,
      answer: formatMonomial(1, { a: p * q + p }),
      condition: 'a≠0', steps: 5,
    }),
    () => ({
      expression: `((2x^${p}y)³)²÷(4x^${2 * p}y^${q})`,
      answer: formatMonomial(16, { x: 4 * p, y: 6 - q }),
      condition: 'x≠0，y≠0', steps: 4,
    }),
    () => ({
      expression: `((a^${p}b^${q})²·(a^${q}b^${p})²)÷(ab)^${p + q}`,
      answer: formatMonomial(1, { a: p + q, b: p + q }),
      condition: 'a≠0，b≠0', steps: 6,
    }),
    () => ({
      expression: `((3x^${p})²·(2x^${q})³)÷(12x^${p + q})`,
      answer: formatMonomial(6, { x: p + 2 * q }),
      condition: 'x≠0', steps: 5,
    }),
    () => ({
      expression: `(((x^${p})²)^${q}·x^${p + q})÷x^${p * q}`,
      answer: formatMonomial(1, { x: p * q + p + q }),
      condition: 'x≠0', steps: 5,
    }),
    () => ({
      expression: `((2a^${p}b^${q})²)²÷(8a^${2 * p}b^${3 * q})`,
      answer: formatMonomial(2, { a: 2 * p, b: q }),
      condition: 'a≠0，b≠0', steps: 4,
    }),
  ];
  return families[family]();
}

function polynomialStandard({ a, q: b, r: c, s: d }, family) {
  const x = xPowerPolynomial(1);
  const x2 = xPowerPolynomial(2);
  const families = [
    () => ({ expression: `${a}x(x+${b})`, polynomial: scalePolynomial(multiplyPolynomial(x, linearPolynomial(1, b)), a), steps: 2 }),
    () => ({ expression: `${a}x²(${b}x-${c})`, polynomial: scalePolynomial(multiplyPolynomial(x2, linearPolynomial(b, -c)), a), steps: 2 }),
    () => ({ expression: `(x+${a})(x+${b})`, polynomial: multiplyPolynomial(linearPolynomial(1, a), linearPolynomial(1, b)), steps: 2 }),
    () => ({ expression: `(x-${a})(x+${b})`, polynomial: multiplyPolynomial(linearPolynomial(1, -a), linearPolynomial(1, b)), steps: 2 }),
    () => ({ expression: `(${b}x+${a})(${c}x+${d})`, polynomial: multiplyPolynomial(linearPolynomial(b, a), linearPolynomial(c, d)), steps: 3 }),
    () => ({ expression: `(x+${a})(x²+${b}x+${c})`, polynomial: multiplyPolynomial(linearPolynomial(1, a), [c, b, 1]), steps: 3 }),
    () => ({
      expression: `${a}x(x+${b})-${c}x²`,
      polynomial: subtractPolynomial(scalePolynomial(multiplyPolynomial(x, linearPolynomial(1, b)), a), scalePolynomial(x2, c)),
      steps: 3,
    }),
    () => ({ expression: `(2x+${a})(3x-${b})`, polynomial: multiplyPolynomial(linearPolynomial(2, a), linearPolynomial(3, -b)), steps: 3 }),
    () => ({
      expression: `(x+${a})(x+${b})+${c}x`,
      polynomial: addPolynomial(multiplyPolynomial(linearPolynomial(1, a), linearPolynomial(1, b)), scalePolynomial(x, c)),
      steps: 3,
    }),
    () => ({ expression: `(${b}x-${a})(x²+${c}x+${d})`, polynomial: multiplyPolynomial(linearPolynomial(b, -a), [d, c, 1]), steps: 3 }),
  ];
  const built = families[family]();
  return { expression: built.expression, answer: formatPolynomial(built.polynomial), steps: built.steps };
}

function polynomialEnhanced({ a, q: b, r: c, s: d }, family) {
  const x = xPowerPolynomial(1);
  const x2 = xPowerPolynomial(2);
  const e = 2 + ((a + c) % 6);
  const f = 1 + ((a + d) % 5);
  const families = [
    () => ({
      expression: `${a}x(x+${b})-(${c}x-${d})(x+${e})`,
      polynomial: subtractPolynomial(
        scalePolynomial(multiplyPolynomial(x, linearPolynomial(1, b)), a),
        multiplyPolynomial(linearPolynomial(c, -d), linearPolynomial(1, e)),
      ), steps: 4,
    }),
    () => ({
      expression: `(x+${a})(x+${b})-(x-${c})(x-${d})`,
      polynomial: subtractPolynomial(
        multiplyPolynomial(linearPolynomial(1, a), linearPolynomial(1, b)),
        multiplyPolynomial(linearPolynomial(1, -c), linearPolynomial(1, -d)),
      ), steps: 4,
    }),
    () => {
      const inner = subtractPolynomial(linearPolynomial(1, c), linearPolynomial(b, -d));
      return {
        expression: `(${b}x+${a})((x+${c})-(${b}x-${d}))`,
        polynomial: multiplyPolynomial(linearPolynomial(b, a), inner), steps: 4,
      };
    },
    () => ({
      expression: `(x+${a})(x²+${b}x+${c})-x(x²+${d}x+${e})`,
      polynomial: subtractPolynomial(
        multiplyPolynomial(linearPolynomial(1, a), [c, b, 1]),
        multiplyPolynomial(x, [e, d, 1]),
      ), steps: 5,
    }),
    () => ({
      expression: `(${b}x+${a})(${c}x-${d})+(${b + 1}x-${e})(x+${f})`,
      polynomial: addPolynomial(
        multiplyPolynomial(linearPolynomial(b, a), linearPolynomial(c, -d)),
        multiplyPolynomial(linearPolynomial(b + 1, -e), linearPolynomial(1, f)),
      ), steps: 5,
    }),
    () => ({
      expression: `${b}x((x+${a})(x-${c})+${d})`,
      polynomial: scalePolynomial(multiplyPolynomial(
        x,
        addPolynomial(multiplyPolynomial(linearPolynomial(1, a), linearPolynomial(1, -c)), constantPolynomial(d)),
      ), b), steps: 5,
    }),
    () => ({
      expression: `(x+${a})((x+${b})(x-${c})-${d}x)`,
      polynomial: multiplyPolynomial(
        linearPolynomial(1, a),
        subtractPolynomial(multiplyPolynomial(linearPolynomial(1, b), linearPolynomial(1, -c)), scalePolynomial(x, d)),
      ), steps: 5,
    }),
    () => ({
      expression: `(${b}x+${a})(${b}x+${a})-(${c}x-${d})(x+${e})`,
      polynomial: subtractPolynomial(
        multiplyPolynomial(linearPolynomial(b, a), linearPolynomial(b, a)),
        multiplyPolynomial(linearPolynomial(c, -d), linearPolynomial(1, e)),
      ), steps: 5,
    }),
    () => ({
      expression: `((x+${a})(x+${b}))(${c}x+${d})`,
      polynomial: multiplyPolynomial(
        multiplyPolynomial(linearPolynomial(1, a), linearPolynomial(1, b)),
        linearPolynomial(c, d),
      ), steps: 5,
    }),
    () => ({
      expression: `(${b}x-${a})((${c}x+${d})-(${b}x-${f}))+${e}x²`,
      polynomial: addPolynomial(
        multiplyPolynomial(linearPolynomial(b, -a), subtractPolynomial(linearPolynomial(c, d), linearPolynomial(b, -f))),
        scalePolynomial(x2, e),
      ), steps: 5,
    }),
  ];
  const built = families[family]();
  return { expression: built.expression, answer: formatPolynomial(built.polynomial), steps: built.steps };
}

function formulaStandard({ a, q: b }, family) {
  const plusA = linearPolynomial(1, a);
  const minusA = linearPolynomial(1, -a);
  const plusScaled = linearPolynomial(b, a);
  const minusScaled = linearPolynomial(b, -a);
  const families = [
    () => ({ expression: `(x+${a})²`, polynomial: multiplyPolynomial(plusA, plusA), steps: 1 }),
    () => ({ expression: `(x-${a})²`, polynomial: multiplyPolynomial(minusA, minusA), steps: 1 }),
    () => ({ expression: `(x+${a})(x-${a})`, polynomial: multiplyPolynomial(plusA, minusA), steps: 1 }),
    () => ({ expression: `(${b}x+${a})²`, polynomial: multiplyPolynomial(plusScaled, plusScaled), steps: 2 }),
    () => ({ expression: `(${b}x-${a})²`, polynomial: multiplyPolynomial(minusScaled, minusScaled), steps: 2 }),
    () => ({ expression: `(${b}x+${a})(${b}x-${a})`, polynomial: multiplyPolynomial(plusScaled, minusScaled), steps: 2 }),
    () => ({ expression: `(x+${a})²-(x-${a})²`, polynomial: subtractPolynomial(multiplyPolynomial(plusA, plusA), multiplyPolynomial(minusA, minusA)), steps: 2 }),
    () => ({ expression: `(x+${a})²+(x-${a})²`, polynomial: addPolynomial(multiplyPolynomial(plusA, plusA), multiplyPolynomial(minusA, minusA)), steps: 2 }),
    () => ({ expression: `(100+${a})(100-${a})`, polynomial: constantPolynomial((100 + a) * (100 - a)), steps: 1 }),
    () => ({ expression: `(50+${a})²`, polynomial: constantPolynomial((50 + a) ** 2), steps: 1 }),
  ];
  const built = families[family]();
  return { expression: built.expression, answer: formatPolynomial(built.polynomial), steps: built.steps };
}

function formulaEnhanced({ a, q: b, r: c }, family) {
  const plusA = linearPolynomial(1, a);
  const minusA = linearPolynomial(1, -a);
  const plusB = linearPolynomial(1, b);
  const minusB = linearPolynomial(1, -b);
  const minusFar = linearPolynomial(1, -(a + b));
  const plusScaled = linearPolynomial(b, a);
  const minusScaled = linearPolynomial(b, -a);
  const families = [
    () => ({
      expression: `(x+${a})²-(x-${a + b})²`,
      polynomial: subtractPolynomial(multiplyPolynomial(plusA, plusA), multiplyPolynomial(minusFar, minusFar)), steps: 3,
    }),
    () => ({
      expression: `(${b}x+${a})²+(${b}x-${a})²`,
      polynomial: addPolynomial(multiplyPolynomial(plusScaled, plusScaled), multiplyPolynomial(minusScaled, minusScaled)), steps: 3,
    }),
    () => ({
      expression: `(${b}x+${a})²-(${b}x-${a})²`,
      polynomial: subtractPolynomial(multiplyPolynomial(plusScaled, plusScaled), multiplyPolynomial(minusScaled, minusScaled)), steps: 3,
    }),
    () => ({
      expression: `(x+${a})²-2(x+${a})(x-${a})+(x-${a})²`,
      polynomial: addPolynomial(
        subtractPolynomial(multiplyPolynomial(plusA, plusA), scalePolynomial(multiplyPolynomial(plusA, minusA), 2)),
        multiplyPolynomial(minusA, minusA),
      ), steps: 5,
    }),
    () => {
      const plusFar = linearPolynomial(1, a + b);
      return {
        expression: `(x+${a})²+(x+${a + b})²-2(x+${a})(x+${a + b})`,
        polynomial: subtractPolynomial(
          addPolynomial(multiplyPolynomial(plusA, plusA), multiplyPolynomial(plusFar, plusFar)),
          scalePolynomial(multiplyPolynomial(plusA, plusFar), 2),
        ), steps: 5,
      };
    },
    () => ({
      expression: `(${b}x+${a})(${b}x-${a})+(${a}x+${b})²`,
      polynomial: addPolynomial(
        multiplyPolynomial(plusScaled, minusScaled),
        multiplyPolynomial(linearPolynomial(a, b), linearPolynomial(a, b)),
      ), steps: 4,
    }),
    () => ({
      expression: `((x+${a})²-(x-${a})²)(x+${b})`,
      polynomial: multiplyPolynomial(
        subtractPolynomial(multiplyPolynomial(plusA, plusA), multiplyPolynomial(minusA, minusA)),
        plusB,
      ), steps: 4,
    }),
    () => ({ expression: `(100+${a})²-(100-${a})²`, polynomial: constantPolynomial((100 + a) ** 2 - (100 - a) ** 2), steps: 3 }),
    () => ({ expression: `(50+${a})²+(50-${a})²`, polynomial: constantPolynomial((50 + a) ** 2 + (50 - a) ** 2), steps: 3 }),
    () => ({
      expression: `(x+${a})²-(x-${b})(x+${b})+${c}x`,
      polynomial: addPolynomial(
        subtractPolynomial(multiplyPolynomial(plusA, plusA), multiplyPolynomial(minusB, plusB)),
        scalePolynomial(xPowerPolynomial(1), c),
      ), steps: 4,
    }),
  ];
  const built = families[family]();
  return { expression: built.expression, answer: formatPolynomial(built.polynomial), steps: built.steps };
}

function factorizationStandard({ a, q: b, r: c }, family) {
  const families = [
    () => ({ polynomial: [a * b, a], answer: `${a}(x+${b})`, steps: 1 }),
    () => ({ polynomial: [0, a * b, a], answer: `${a}x(x+${b})`, steps: 2 }),
    () => ({ polynomial: [-(a ** 2), 0, 1], answer: `(x+${a})(x-${a})`, steps: 1 }),
    () => ({ polynomial: [a ** 2, 2 * a, 1], answer: `(x+${a})²`, steps: 1 }),
    () => ({ polynomial: [a ** 2, -2 * a, 1], answer: `(x-${a})²`, steps: 1 }),
    () => ({ polynomial: [-(a ** 2), 0, b ** 2], answer: `(${b}x+${a})(${b}x-${a})`, steps: 2 }),
    () => ({ polynomial: [a * b ** 2, 2 * a * b, a], answer: `${a}(x+${b})²`, steps: 2 }),
    () => ({ polynomial: [a * (a + b), 2 * a + b, 1], answer: `(x+${a})(x+${a + b})`, steps: 2 }),
    () => ({ polynomial: [-a * (a + b), b, 1], answer: `(x-${a})(x+${a + b})`, steps: 2 }),
    () => ({
      expression: `${b}x²+${a * b}x+${c}x+${a * c}`,
      answer: `(x+${a})(${b}x+${c})`, steps: 2,
    }),
  ];
  const built = families[family]();
  return {
    expression: built.expression || formatPolynomial(built.polynomial),
    answer: built.answer,
    steps: built.steps,
  };
}

function factorizationEnhanced({ a, q: b, r: c }, family) {
  const families = [
    () => ({ polynomial: [0, -b * a ** 2, 0, b], answer: `${b}x(x+${a})(x-${a})`, steps: 3 }),
    () => ({
      expression: `${b}x²+${2 * b * a}xy+${b * a ** 2}y²`,
      answer: `${b}(x+${a}y)²`, steps: 3,
    }),
    () => ({ polynomial: [0, b * a ** 2, 2 * b * a, b], answer: `${b}x(x+${a})²`, steps: 3 }),
    () => ({ polynomial: [-a * b ** 2, -(b ** 2), a, 1], answer: `(x+${a})(x+${b})(x-${b})`, steps: 3 }),
    () => ({ polynomial: [-(a ** 4), 0, 0, 0, 1], answer: `(x+${a})(x-${a})(x²+${a ** 2})`, steps: 3 }),
    () => ({
      expression: `${c ** 2}x²-${c ** 2 * a ** 2}y²`,
      answer: `${c ** 2}(x+${a}y)(x-${a}y)`, steps: 3,
    }),
    () => ({ polynomial: [0, -a * b, a - b, 1], answer: `x(x+${a})(x-${b})`, steps: 3 }),
    () => ({
      polynomial: [-c * a * b ** 2, -c * b ** 2, c * a, c],
      answer: `${c}(x+${a})(x+${b})(x-${b})`, steps: 4,
    }),
    () => ({ polynomial: [0, 0, a ** 2, 2 * a, 1], answer: `x²(x+${a})²`, steps: 3 }),
    () => ({ polynomial: [0, 0, -b * a ** 2, 0, b], answer: `${b}x²(x+${a})(x-${a})`, steps: 4 }),
  ];
  const built = families[family]();
  return {
    expression: built.expression || formatPolynomial(built.polynomial),
    answer: built.answer,
    steps: built.steps,
  };
}

const questions = [];
const verificationRecords = [];

function addTopic(questionType, tier, builder) {
  const topicKey = TOPIC_KEYS[questionType];
  const difficulty = tier === 'standard' ? 3 : 4;
  const secondsBase = tier === 'standard' ? 85 : 120;
  for (let index = 0; index < 200; index += 1) {
    const family = index % 10;
    const variant = Math.floor(index / 10);
    const built = builder(variantParameters(variant), family);
    const signature = `g8calc.v2.${topicKey}.${tier}.${String(index + 1).padStart(3, '0')}`;
    const condition = built.condition ? `（${built.condition}）` : '';
    const verb = questionType === '因式分解' ? '因式分解' : questionType === '整式乘法' ? '计算并化简' : '化简';
    questions.push({
      grade_band: '初中',
      grade_code: 'g8',
      subject: '数学',
      module: '综合计算',
      question_type: questionType,
      difficulty,
      template_key: `g8calc-v2-${topicKey}-${tier}-${String(family + 1).padStart(2, '0')}`,
      stem: `${verb}：${built.expression}${condition}。`,
      answer: String(built.answer),
      estimated_seconds: secondsBase + (family % 3) * 5,
      signature,
      provenance: 'self_authored',
    });
    verificationRecords.push(Object.freeze({
      signature,
      expression: built.expression,
      tier,
      structural_steps: built.steps,
    }));
  }
}

addTopic('幂的运算', 'standard', powerStandard);
addTopic('幂的运算', 'enhanced', powerEnhanced);
addTopic('整式乘法', 'standard', polynomialStandard);
addTopic('整式乘法', 'enhanced', polynomialEnhanced);
addTopic('乘法公式', 'standard', formulaStandard);
addTopic('乘法公式', 'enhanced', formulaEnhanced);
addTopic('因式分解', 'standard', factorizationStandard);
addTopic('因式分解', 'enhanced', factorizationEnhanced);

function tokenizeAlgebra(source) {
  const superscripts = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
  const normalized = String(source)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/gu, (digits) => `^${[...digits].map((digit) => superscripts[digit]).join('')}`)
    .replace(/[·×]/gu, '*')
    .replace(/÷/gu, '/')
    .replace(/[−–—]/gu, '-')
    .replace(/\s+/gu, '');
  const raw = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const current = normalized[cursor];
    if (/[0-9.]/u.test(current)) {
      let end = cursor + 1;
      while (end < normalized.length && /[0-9.]/u.test(normalized[end])) end += 1;
      const text = normalized.slice(cursor, end);
      if (!/^\d+(?:\.\d+)?$/u.test(text)) throw new Error(`非法数字：${text}`);
      raw.push({ type: 'number', value: Number(text) });
      cursor = end;
      continue;
    }
    if (/[a-z]/iu.test(current)) {
      raw.push({ type: 'variable', value: current });
      cursor += 1;
      continue;
    }
    if ('+-*/^()'.includes(current)) {
      raw.push({ type: current, value: current });
      cursor += 1;
      continue;
    }
    throw new Error(`不支持的代数符号：${current}`);
  }
  const tokens = [];
  const endsAtom = (token) => token && ['number', 'variable', ')'].includes(token.type);
  const startsAtom = (token) => token && ['number', 'variable', '('].includes(token.type);
  raw.forEach((token) => {
    if (endsAtom(tokens[tokens.length - 1]) && startsAtom(token)) tokens.push({ type: '*', value: '*' });
    tokens.push(token);
  });
  return tokens;
}

function evaluateAlgebra(source, values = {}) {
  const tokens = tokenizeAlgebra(source);
  let position = 0;
  const peek = () => tokens[position];
  const consume = (type) => {
    const token = tokens[position];
    if (!token || token.type !== type) throw new Error(`期待 ${type}，实际 ${token ? token.type : '表达式结束'}`);
    position += 1;
    return token;
  };
  const parsePrimary = () => {
    const token = peek();
    if (!token) throw new Error('表达式意外结束');
    if (token.type === 'number') return consume('number').value;
    if (token.type === 'variable') {
      const variable = consume('variable').value;
      if (!Object.hasOwn(values, variable)) throw new Error(`变量 ${variable} 没有验算取值`);
      return Number(values[variable]);
    }
    if (token.type === '(') {
      consume('(');
      const value = parseExpression();
      consume(')');
      return value;
    }
    throw new Error(`无法解析 ${token.type}`);
  };
  const parsePower = () => {
    let value = parsePrimary();
    if (peek()?.type === '^') {
      consume('^');
      value **= parseUnary();
    }
    return value;
  };
  const parseUnary = () => {
    if (peek()?.type === '+') {
      consume('+');
      return parseUnary();
    }
    if (peek()?.type === '-') {
      consume('-');
      return -parseUnary();
    }
    return parsePower();
  };
  const parseProduct = () => {
    let value = parseUnary();
    while (peek() && ['*', '/'].includes(peek().type)) {
      const operator = tokens[position++].type;
      const operand = parseUnary();
      value = operator === '*' ? value * operand : value / operand;
    }
    return value;
  };
  const parseExpression = () => {
    let value = parseProduct();
    while (peek() && ['+', '-'].includes(peek().type)) {
      const operator = tokens[position++].type;
      const operand = parseProduct();
      value = operator === '+' ? value + operand : value - operand;
    }
    return value;
  };
  const result = parseExpression();
  if (position !== tokens.length) throw new Error(`表达式存在未解析部分：${tokens[position].value}`);
  return result;
}

function expressionFromStem(stem) {
  const colon = String(stem).indexOf('：');
  if (colon < 0) throw new Error('题干缺少中文冒号');
  return String(stem)
    .slice(colon + 1)
    .replace(/。$/u, '')
    .replace(/（[^（）]*≠0[^（）]*）$/u, '');
}

const verificationBySignature = new Map(verificationRecords.map((record) => [record.signature, record]));

function verifyQuestion(question) {
  const record = verificationBySignature.get(question?.signature);
  if (!record) return { ok: false, reason: 'missing_verification_record' };
  let expression;
  try {
    expression = expressionFromStem(question.stem);
  } catch (error) {
    return { ok: false, reason: `invalid_stem:${error.message}` };
  }
  if (expression !== record.expression) return { ok: false, reason: 'verification_expression_mismatch' };
  if ((record.tier === 'standard' ? 3 : 4) !== question.difficulty) {
    return { ok: false, reason: 'difficulty_tier_mismatch' };
  }
  try {
    for (const values of SAMPLE_POINTS) {
      const actual = evaluateAlgebra(expression, values);
      const expected = evaluateAlgebra(question.answer, values);
      const tolerance = 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected));
      if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > tolerance) {
        return { ok: false, reason: 'algebraic_answer_mismatch', values, actual, expected };
      }
    }
  } catch (error) {
    return { ok: false, reason: `verification_error:${error.message}` };
  }
  return { ok: true, checked_samples: SAMPLE_POINTS.length };
}

function auditQuestionBank(input = questions) {
  const errors = [];
  const signatures = new Set();
  const stems = new Set();
  const expressions = new Set();
  const counts = {
    total: input.length,
    by_difficulty: { 3: 0, 4: 0 },
    by_topic: Object.fromEntries(blueprint.topics.map((topic) => [topic, { total: 0, difficulty_3: 0, difficulty_4: 0 }])),
  };
  input.forEach((question, index) => {
    const label = question.signature || `index-${index}`;
    if (signatures.has(question.signature)) errors.push(`${label}:duplicate_signature`);
    signatures.add(question.signature);
    if (stems.has(question.stem)) errors.push(`${label}:duplicate_stem`);
    stems.add(question.stem);
    let expression = '';
    try { expression = expressionFromStem(question.stem); } catch (error) { errors.push(`${label}:invalid_stem:${error.message}`); }
    const normalizedExpression = expression.replace(/\s+/gu, '');
    if (expressions.has(normalizedExpression)) errors.push(`${label}:duplicate_expression`);
    expressions.add(normalizedExpression);
    if (!blueprint.topics.includes(question.question_type)) errors.push(`${label}:unexpected_topic`);
    if (![3, 4].includes(question.difficulty)) errors.push(`${label}:unexpected_difficulty`);
    if (question.grade_code !== 'g8' || question.grade_band !== '初中') errors.push(`${label}:wrong_grade`);
    if (question.subject !== '数学' || question.module !== '综合计算') errors.push(`${label}:wrong_scope`);
    if (question.provenance !== 'self_authored') errors.push(`${label}:wrong_provenance`);
    const timeRange = question.difficulty === 3 ? [85, 95] : [120, 130];
    if (question.estimated_seconds < timeRange[0] || question.estimated_seconds > timeRange[1]) errors.push(`${label}:time_out_of_range`);
    if (counts.by_difficulty[question.difficulty] !== undefined) counts.by_difficulty[question.difficulty] += 1;
    const topicCount = counts.by_topic[question.question_type];
    if (topicCount) {
      topicCount.total += 1;
      topicCount[`difficulty_${question.difficulty}`] += 1;
    }
    const record = verificationBySignature.get(question.signature);
    if (!record) errors.push(`${label}:missing_verification_record`);
    if (question.difficulty === 4 && record?.structural_steps < 3) errors.push(`${label}:enhanced_structure_too_shallow`);
    const verificationResult = verifyQuestion(question);
    if (!verificationResult.ok) errors.push(`${label}:${verificationResult.reason}`);
  });
  if (input.length !== 1600) errors.push(`wrong_total:${input.length}`);
  if (counts.by_difficulty[3] !== 800 || counts.by_difficulty[4] !== 800) errors.push('wrong_difficulty_distribution');
  for (const topic of blueprint.topics) {
    const count = counts.by_topic[topic];
    if (count.total !== 400 || count.difficulty_3 !== 200 || count.difficulty_4 !== 200) {
      errors.push(`${topic}:wrong_topic_distribution`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    counts,
    verified_questions: input.length - errors.filter((error) => error.includes('verification')).length,
    signature_sha256: digest([...signatures].sort()),
    stem_sha256: digest([...stems].sort()),
  };
}

const initialAudit = auditQuestionBank();
if (!initialAudit.ok) {
  throw new Error(`八年级计算题库 v2 审计失败：\n${initialAudit.errors.slice(0, 30).join('\n')}`);
}

module.exports = {
  metadata: Object.freeze({
    ...blueprint,
    source_snapshot_sha256: digest(blueprint),
    content_sha256: digest(questions),
    verification_method: 'independent-algebraic-sampling-v1',
  }),
  questions: Object.freeze(questions),
  verification: Object.freeze({
    method: 'independent-algebraic-sampling-v1',
    sample_points: SAMPLE_POINTS,
    records: Object.freeze(verificationRecords),
    initial_audit: Object.freeze(initialAudit),
  }),
  evaluateAlgebra,
  verifyQuestion,
  auditQuestionBank,
};
