const crypto = require('node:crypto');
const { normalizeMathDisplay, signedOperand } = require('../../utils/math-expression');

const BATTLES = {
  primary: {
    label: '小学战场',
    target_seconds: 40,
    bonus_end_seconds: 180,
    question_count: 20,
  },
  junior: {
    label: '初中战场',
    target_seconds: 60,
    bonus_end_seconds: 240,
    question_count: 20,
  },
};

function seedNumber(value) {
  return Number.parseInt(crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8), 16) >>> 0;
}

function randomFor(value) {
  let state = seedNumber(value) || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function integer(next, min, max) {
  return min + Math.floor(next() * (max - min + 1));
}

function signed(next, min, max) {
  const value = integer(next, min, max);
  return next() < 0.5 ? -value : value;
}

function wrapSigned(value) {
  return value < 0 ? `(${value})` : String(value);
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

function fraction(numerator, denominator) {
  const sign = denominator < 0 ? -1 : 1;
  const divisor = gcd(numerator, denominator);
  const n = sign * numerator / divisor;
  const d = Math.abs(denominator) / divisor;
  return d === 1 ? String(n) : `${n}/${d}`;
}

function uniqueBatch({ battle, type, count, builder }) {
  const rows = [];
  const stems = new Set();
  let attempt = 0;
  while (rows.length < count && attempt < count * 100) {
    const built = builder(randomFor(`${battle}|${type}|${attempt}`), attempt);
    attempt += 1;
    if (!built || stems.has(built.stem)) continue;
    stems.add(built.stem);
    rows.push({
      id: `${battle}-${String(rows.length + 1).padStart(3, '0')}-${seedNumber(built.idStem || built.stem).toString(16)}`,
      battle,
      type,
      stem: built.stem,
      answer: String(built.answer),
      audit: built.audit || null,
    });
  }
  if (rows.length !== count) throw new Error(`${battle}/${type} 题目数量不足：${rows.length}/${count}`);
  return rows;
}

function buildPrimaryQuestions() {
  const specs = [
    ['三数加减', (next) => {
      const a = integer(next, 12, 180);
      const b = integer(next, 5, 90);
      const c = integer(next, 3, a + b);
      return { stem: `${a} + ${b} - ${c} = ?`, answer: a + b - c, audit: { operands: [a, b, c], intermediates: [a + b, a + b - c] } };
    }],
    ['四数混合', (next) => {
      const a = integer(next, 3, 30);
      const b = integer(next, 2, 25);
      const c = integer(next, 2, 9);
      const product = (a + b) * c;
      const d = integer(next, 1, product);
      return { stem: `(${a} + ${b}) × ${c} - ${d} = ?`, answer: product - d, audit: { operands: [a, b, c, d], intermediates: [a + b, product, product - d] } };
    }],
    ['五数混合', (next) => {
      const a = integer(next, 2, 15);
      const b = integer(next, 2, 12);
      const c = integer(next, 2, 15);
      const d = integer(next, 2, 12);
      const total = a * b + c * d;
      const e = integer(next, 1, total);
      return { stem: `${a} × ${b} + ${c} × ${d} - ${e} = ?`, answer: total - e, audit: { operands: [a, b, c, d, e], intermediates: [a * b, c * d, total, total - e] } };
    }],
    ['整除混合', (next) => {
      const divisor = integer(next, 2, 12);
      const quotient = integer(next, 2, 25);
      const dividend = divisor * quotient;
      const c = integer(next, 2, 12);
      const d = integer(next, 2, 10);
      return { stem: `${dividend} ÷ ${divisor} + ${c} × ${d} = ?`, answer: quotient + c * d, audit: { operands: [dividend, divisor, c, d], intermediates: [quotient, c * d, quotient + c * d] } };
    }],
    ['加减方程', (next) => {
      const x = integer(next, 1, 120);
      const a = integer(next, 2, 80);
      const b = integer(next, 2, 80);
      return { stem: `x + ${a} + ${b} = ${x + a + b}，x = ?`, answer: x, audit: { operands: [a, b, x + a + b], intermediates: [x + a, x + a + b] } };
    }],
    ['乘加方程', (next) => {
      const x = integer(next, 1, 30);
      const multiplier = integer(next, 2, 12);
      const addend = integer(next, 1, 60);
      const total = multiplier * x + addend;
      return { stem: `${multiplier} × x + ${addend} = ${total}，x = ?`, answer: x, audit: { operands: [multiplier, addend, total], intermediates: [multiplier * x, total] } };
    }],
  ];
  return specs.flatMap(([type, builder]) => uniqueBatch({ battle: 'primary', type, count: 100, builder }));
}

function buildJuniorQuestions() {
  const specs = [
    ['有理数加减', (next) => {
      const values = Array.from({ length: 4 }, () => signed(next, 2, 45));
      return { stem: `${wrapSigned(values[0])} + ${wrapSigned(values[1])} - ${wrapSigned(values[2])} + ${wrapSigned(values[3])} = ?`, answer: values[0] + values[1] - values[2] + values[3] };
    }],
    ['有理数混合', (next) => {
      const a = signed(next, 2, 18);
      const b = signed(next, 2, 12);
      const c = signed(next, 2, 35);
      const d = signed(next, 2, 28);
      return { stem: `${wrapSigned(a)} × ${wrapSigned(b)} + ${wrapSigned(c)} - ${wrapSigned(d)} = ?`, answer: a * b + c - d };
    }],
    ['平方差巧算', (next) => {
      const b = integer(next, 6, 55);
      const gap = integer(next, 1, 8);
      const a = b + gap;
      return { stem: `${a}² - ${b}² = ?`, answer: a * a - b * b };
    }],
    ['绝对值', (next) => {
      const a = signed(next, 3, 48);
      const b = signed(next, 3, 48);
      const c = signed(next, 2, 30);
      return { stem: `|${a} - (${b})| - |${c}| = ?`, answer: Math.abs(a - b) - Math.abs(c) };
    }],
    ['分数口算', (next) => {
      const denominator = integer(next, 2, 12);
      const a = signed(next, 1, denominator * 2);
      const b = signed(next, 1, denominator * 2);
      const left = fraction(a, denominator);
      const right = fraction(b, denominator);
      const idStem = `${left} + ${right} = ?`;
      return { idStem, stem: `${normalizeMathDisplay(left)} + ${signedOperand(right)} = ?`, answer: fraction(a + b, denominator) };
    }],
    ['小数口算', (next) => {
      const a = signed(next, 12, 180);
      const b = signed(next, 12, 180);
      const c = signed(next, 5, 90);
      const value = a - b + c;
      const left = (a / 10).toFixed(1);
      const middle = (b / 10).toFixed(1);
      const right = (c / 10).toFixed(1);
      const idStem = `${left} - (${middle}) + ${right} = ?`;
      return {
        idStem,
        stem: `${normalizeMathDisplay(left)} − (${normalizeMathDisplay(middle)}) + ${signedOperand(right)} = ?`,
        answer: (value / 10).toFixed(1),
      };
    }],
    ['整式求值', (next) => {
      const x = signed(next, 1, 9);
      const a = integer(next, 2, 12);
      const b = signed(next, 1, 24);
      return { stem: `当 x = ${x} 时，${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ?`, answer: a * x + b };
    }],
    ['一元一次方程', (next) => {
      const x = signed(next, 1, 24);
      const a = integer(next, 2, 12);
      const b = signed(next, 1, 30);
      const total = a * x + b;
      return { stem: `${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${total}，x = ?`, answer: x };
    }],
  ];
  return specs.flatMap(([type, builder]) => uniqueBatch({ battle: 'junior', type, count: 75, builder }));
}

const QUESTION_BANK = {
  primary: buildPrimaryQuestions(),
  junior: buildJuniorQuestions(),
};

for (const [battle, questions] of Object.entries(QUESTION_BANK)) {
  if (questions.length !== 600) throw new Error(`${battle} 题库应为 600 题`);
  if (new Set(questions.map((item) => item.stem)).size !== questions.length) throw new Error(`${battle} 题干存在重复`);
  if (new Set(questions.map((item) => item.id)).size !== questions.length) throw new Error(`${battle} 题目 ID 存在重复`);
}

module.exports = { BATTLES, QUESTION_BANK };
