const crypto = require('node:crypto');
const blueprint = require('./junior1-math-v2-blueprint.json');

function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

class Fraction {
  constructor(numerator, denominator = 1) {
    if (!Number.isInteger(numerator) || !Number.isInteger(denominator) || denominator === 0) {
      throw new Error('invalid fraction');
    }
    const sign = denominator < 0 ? -1 : 1;
    const divisor = gcd(numerator, denominator);
    this.n = sign * numerator / divisor;
    this.d = Math.abs(denominator) / divisor;
  }

  add(other) { return new Fraction(this.n * other.d + other.n * this.d, this.d * other.d); }
  sub(other) { return new Fraction(this.n * other.d - other.n * this.d, this.d * other.d); }
  mul(other) { return new Fraction(this.n * other.n, this.d * other.d); }
  div(other) { return new Fraction(this.n * other.d, this.d * other.n); }
  pow(power) { return new Fraction(this.n ** power, this.d ** power); }
  toString() { return this.d === 1 ? String(this.n) : `${this.n}/${this.d}`; }
}

const q = (n, d = 1) => new Fraction(n, d);
const asText = (value) => value instanceof Fraction ? value.toString() : String(value);
const wrap = (value) => `(${asText(value)})`;
const signed = (value) => value < 0 ? `(${value})` : String(value);
const positive = (index, min, max) => min + ((index * 17 + 3) % (max - min + 1));
const signedNumber = (index, min, max) => {
  const value = positive(index, min, max);
  return index % 2 ? -value : value;
};

function decimalText(value) {
  const fraction = value instanceof Fraction ? value : q(value);
  if (fraction.d === 1) return `${fraction.n}.0`;
  let denominator = fraction.d;
  let places = 0;
  while (denominator % 2 === 0) { denominator /= 2; places += 1; }
  while (denominator % 5 === 0) { denominator /= 5; places += 1; }
  if (denominator !== 1) return fraction.toString();
  const scale = 10 ** places;
  const digits = String(Math.abs(fraction.n) * (scale / fraction.d)).padStart(places + 1, '0');
  return `${fraction.n < 0 ? '-' : ''}${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

function linear(terms) {
  const parts = [];
  for (const [variable, coefficient] of Object.entries(terms)) {
    if (!coefficient) continue;
    const magnitude = Math.abs(coefficient);
    const atom = magnitude === 1 ? variable : `${magnitude}${variable}`;
    if (!parts.length) parts.push(coefficient < 0 ? `-${atom}` : atom);
    else parts.push(coefficient < 0 ? `-${atom}` : `+${atom}`);
  }
  return parts.join('') || '0';
}

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

const TYPE_SLUGS = {
  '有理数加减': 'rational-add-sub',
  '有理数乘除': 'rational-mul-div',
  '有理数混合': 'rational-mixed',
  '绝对值与数轴': 'absolute-number-line',
  '有理数巧算': 'rational-tricks',
  '去括号与合并': 'remove-parentheses',
  '整式加减': 'polynomial-add-sub',
  '整式求值': 'polynomial-evaluate',
  '基础移项': 'equation-basic',
  '含括号方程': 'equation-parentheses',
  '分数小数方程': 'equation-fraction-decimal',
  '实际问题方程': 'equation-word',
};

let serial = 0;
function question(module, type, difficulty, stem, answer, seconds) {
  serial += 1;
  const slug = TYPE_SLUGS[type];
  return {
    grade_band: '初中',
    subject: '数学',
    module,
    question_type: type,
    difficulty,
    template_key: `junior1-v2-${slug}-d${difficulty}-${(serial % 18) + 1}`,
    stem,
    answer: asText(answer),
    estimated_seconds: seconds || [70, 90, 110, 140][difficulty - 1],
    signature: `junior1-v2-${String(serial).padStart(3, '0')}`,
    provenance: 'self_authored',
  };
}

function difficultyAt(index, distribution) {
  let offset = index;
  for (const [difficulty, count] of distribution) {
    if (offset < count) return difficulty;
    offset -= count;
  }
  throw new Error('difficulty distribution overflow');
}

function addBatch(rows, module, type, distribution, builder) {
  const total = distribution.reduce((sum, [, count]) => sum + count, 0);
  for (let index = 0; index < total; index += 1) {
    const difficulty = difficultyAt(index, distribution);
    rows.push(question(module, type, difficulty, ...builder(index, difficulty)));
  }
}

function buildQuestions() {
  const rows = [];

  addBatch(rows, '有理数', '有理数加减', [[1, 18], [2, 23], [3, 10], [4, 4]], (i, difficulty) => {
    const a = signedNumber(i + 1, 2, difficulty >= 3 ? 24 : 15);
    const b = signedNumber(i + 5, 2, difficulty >= 3 ? 20 : 12);
    if (difficulty === 1) return [`计算：${signed(a)} + ${signed(b)}。`, q(a).add(q(b))];
    if (difficulty === 2) {
      const c = signedNumber(i + 9, 2, 15);
      return [`计算：${signed(a)} - ${signed(b)} + ${signed(c)}。`, q(a).sub(q(b)).add(q(c))];
    }
    const den = difficulty === 3 ? 2 + (i % 4) : 3 + (i % 6);
    const c = q(signedNumber(i + 11, 2, 18), den);
    const d = q(signedNumber(i + 19, 2, 16), den + (i % 2));
    if (difficulty === 3) return [`计算：${signed(a)} - ${wrap(c)} + ${wrap(d)}。`, q(a).sub(c).add(d)];
    const e = q(signedNumber(i + 23, 2, 12), den + 2);
    return [`计算：${signed(a)} - ${wrap(c)} + ${wrap(d)} - ${wrap(e)}。`, q(a).sub(c).add(d).sub(e)];
  });

  addBatch(rows, '有理数', '有理数乘除', [[1, 16], [2, 20], [3, 10], [4, 4]], (i, difficulty) => {
    if (difficulty === 1) {
      const a = signedNumber(i + 2, 2, 12);
      const b = positive(i + 4, 2, 9);
      return [`计算：${signed(a)} × ${b}。`, q(a).mul(q(b))];
    }
    const a = q(signedNumber(i + 3, 2, 12), 2 + (i % 4));
    const b = q(signedNumber(i + 7, 2, 12), 3 + (i % 3));
    if (difficulty === 2) return [`计算：${wrap(a)} × ${wrap(b)}。`, a.mul(b)];
    const c = q(signedNumber(i + 11, 2, 10), 2 + ((i + 1) % 4));
    if (difficulty === 3) return [`计算：${wrap(a)} × ${wrap(b)} ÷ ${wrap(c)}。`, a.mul(b).div(c)];
    const d = q(signedNumber(i + 17, 2, 9), 2 + ((i + 2) % 5));
    return [`计算：${wrap(a)} × ${wrap(b)} ÷ ${wrap(c)} × ${wrap(d)}。`, a.mul(b).div(c).mul(d)];
  });

  addBatch(rows, '有理数', '有理数混合', [[1, 18], [2, 26], [3, 12], [4, 4]], (i, difficulty) => {
    const a = positive(i + 1, 2, difficulty >= 3 ? 12 : 8);
    const b = positive(i + 3, 2, 8);
    if (difficulty === 1) return [`计算：-${a}² + |-${b}|。`, -a * a + b];
    const c = signedNumber(i + 5, 2, 8);
    if (difficulty === 2) return [`计算：(${signed(a)})² - ${b} × ${signed(c)}。`, q(a).pow(2).sub(q(b).mul(q(c)))];
    const d = q(positive(i + 7, 2, 9), 2 + (i % 4));
    if (difficulty === 3) return [`计算：|${signed(c)}| + ${wrap(d)} × (${signed(a)})²。`, q(Math.abs(c)).add(d.mul(q(a).pow(2)))];
    const e = positive(i + 11, 2, 8);
    return [`计算：-${a}² ÷ ${b} + (${signed(c)})³ - |-${e}|。`, q(-a * a, b).add(q(c).pow(3)).sub(q(e))];
  });

  addBatch(rows, '有理数', '绝对值与数轴', [[1, 20], [2, 16], [3, 7], [4, 2]], (i, difficulty) => {
    if (difficulty === 1) {
      const a = signedNumber(i + 2, 2, 18);
      const b = signedNumber(i + 5, 2, 15);
      return [`计算：|${signed(a)}| + |${signed(b)}|。`, Math.abs(a) + Math.abs(b)];
    }
    if (difficulty === 2) {
      const a = -positive(i + 3, 2, 12);
      const b = -positive(i + 8, 2, 12);
      const c = positive(i + 13, 2, 12);
      return [`已知 ${a}＜${b}＜0＜${c}，化简：|${a}| - |${b}| + |${c}|。`, `${-a} - ${-b} + ${c}`];
    }
    const a = -positive(i + 4, 2, 10);
    const b = positive(i + 7, 2, 10);
    const c = positive(i + 12, b + 1, b + 8);
    if (difficulty === 3) return [`数轴上 ${a}＜0＜${b}＜${c}，化简：|${a}| + |${b}-${c}|。`, `${-a} + ${c - b}`];
    return [`已知 a＜b＜0＜c，化简：|a-b|+|b|+|c-a|。`, `c-2a`];
  });

  addBatch(rows, '有理数', '有理数巧算', [[1, 5], [2, 12], [3, 14], [4, 4]], (i, difficulty) => {
    if (i % 4 === 0) {
      const n = 8 + i;
      return [`计算：${n}² - ${n - 1} × ${n + 1}。`, 1];
    }
    if (i % 4 === 1) {
      const a = 3 + (i % 9);
      const b = 11 + (i % 7);
      const c = 4 + (i % 6);
      return [`计算：${a} × (${b}+${c}) - ${a} × ${b}。`, a * c];
    }
    if (i % 4 === 2) {
      const n = 3 + (i % 8);
      return [`计算：1/(1×2)+1/(2×3)+…+1/(${n}×${n + 1})。`, q(n, n + 1)];
    }
    const a = 20 + i;
    const b = 7 + (i % 9);
    return [`计算：${a}×${b} + ${a}×${-b + 1}。`, a];
  });

  addBatch(rows, '整式运算', '去括号与合并', [[1, 12], [2, 20], [3, 11], [4, 2]], (i, difficulty) => {
    const a = 2 + (i % 8);
    const b = 1 + ((i * 3) % 7);
    const c = 1 + ((i * 5) % 6);
    const d = 1 + ((i * 7) % 5);
    const left = linear({ x: a, y: b });
    const right = linear({ x: c, y: -d });
    if (difficulty === 1) return [`化简：(${left}) + (${right})。`, linear({ x: a + c, y: b - d })];
    if (difficulty === 2) return [`化简：2(${left}) - (${right})。`, linear({ x: 2 * a - c, y: 2 * b + d })];
    return [`化简：-${a}(${left}) + ${b}(${right})。`, linear({ x: -a * a + b * c, y: -a * b - b * d })];
  });

  addBatch(rows, '整式运算', '整式加减', [[1, 10], [2, 17], [3, 11], [4, 2]], (i, difficulty) => {
    const a = 2 + (i % 9);
    const b = 1 + ((i * 2) % 8);
    const c = 1 + ((i * 3) % 7);
    const d = 1 + ((i * 5) % 6);
    if (difficulty === 1) return [`化简：${a}x + ${b}x - ${c}x。`, linear({ x: a + b - c })];
    if (difficulty === 2) return [`化简：${a}x² + ${b}x - ${c}x² + ${d}x。`, linear({ 'x²': a - c, x: b + d })];
    return [`化简：${a}x² - ${b}xy + ${c}y² - (${d}x² - ${b}xy + ${c - 1}y²)。`, linear({ 'x²': a - d, 'y²': 1 })];
  });

  addBatch(rows, '整式运算', '整式求值', [[1, 8], [2, 13], [3, 11], [4, 3]], (i, difficulty) => {
    const x = i % 2 ? -2 - (i % 3) : 1 + (i % 4);
    const y = i % 3 ? 2 + (i % 4) : -1;
    const a = 2 + (i % 5);
    const b = 1 + ((i * 3) % 5);
    if (difficulty === 1) return [`当 x=${x} 时，求 ${a}x+${b}。`, a * x + b];
    if (difficulty === 2) return [`当 x=${x}，y=${y} 时，求 ${a}x+${b}y-${i % 6 + 1}。`, a * x + b * y - (i % 6 + 1)];
    const c = 1 + (i % 4);
    const d = 1 + ((i * 2) % 5);
    return [`先化简再求值：${a}x+${b}y-(${c}x-${d}y)，其中 x=${x}，y=${y}。`, (a - c) * x + (b + d) * y];
  });

  addBatch(rows, '一元一次方程', '基础移项', [[1, 15], [2, 17], [3, 3]], (i, difficulty) => {
    const x = signedNumber(i + 2, 2, 18);
    const a = 2 + (i % 12);
    if (difficulty === 1) return [`解方程：x + ${a} = ${x + a}。`, `x=${x}`];
    if (difficulty === 2) return [`解方程：${a}x = ${a * x}。`, `x=${x}`];
    const b = signedNumber(i + 9, 2, 12);
    return [`解方程：${a}x + ${signed(b)} = ${a * x + b}。`, `x=${x}`];
  });

  addBatch(rows, '一元一次方程', '含括号方程', [[1, 12], [2, 16], [3, 6], [4, 1]], (i, difficulty) => {
    const x = signedNumber(i + 4, 2, 15);
    const a = 2 + (i % 6);
    const b = 1 + (i % 8);
    if (difficulty === 1) return [`解方程：${a}(x+${b}) = ${a * (x + b)}。`, `x=${x}`];
    if (difficulty === 2) return [`解方程：${a}(x-${b}) + ${b} = ${a * (x - b) + b}。`, `x=${x}`];
    const c = 1 + ((i * 3) % 5);
    return [`解方程：${a}(x+${b}) - ${c}x = ${a * (x + b) - c * x}。`, `x=${x}`];
  });

  addBatch(rows, '一元一次方程', '分数小数方程', [[1, 10], [2, 17], [3, 6], [4, 2]], (i, difficulty) => {
    const x = signedNumber(i + 6, 2, 12);
    const a = 2 + (i % 5);
    const b = 3 + (i % 4);
    if (difficulty === 1) return [`解方程：(x-${a})/${b} = ${(x - a)}/${b}。`, `x=${x}`];
    if (difficulty === 2) return [`解方程：(x+${a})/${b} = ${(x + a)}/${b}。`, `x=${x}`];
    const c = 2 + ((i * 2) % 5);
    const rhs = q(x - a, b).add(q(x + a, c));
    if (difficulty === 3) return [`解方程：(x-${a})/${b} + (x+${a})/${c} = ${rhs}。`, `x=${x}`];
    const leftCoefficient = 2 + (i % 4);
    const rightCoefficient = leftCoefficient + 1;
    const leftConstant = q(2 + (i % 3), 10);
    const rightConstant = leftConstant.sub(q((rightCoefficient - leftCoefficient) * x, 10));
    return [`解方程：0.${leftCoefficient}x + ${decimalText(leftConstant)} = 0.${rightCoefficient}x + ${decimalText(rightConstant)}。`, `x=${x}`];
  });

  addBatch(rows, '一元一次方程', '实际问题方程', [[1, 6], [2, 13], [3, 9], [4, 2]], (i, difficulty) => {
    const x = 4 + (i % 12);
    const unit = 3 + (i % 8);
    const fixed = 5 + ((i * 2) % 11);
    if (difficulty === 1) return [`某班购买 ${unit} 元/本的练习册 x 本，另付包装费 ${fixed} 元，共 ${unit * x + fixed} 元，求 x。`, `x=${x}`];
    if (difficulty === 2) {
      const days = 2 + (i % 5);
      const distance = unit * days;
      return [`一段路程已走 ${fixed} 千米，剩下部分按每天 ${unit} 千米走 ${days} 天，设剩下路程为 x 千米，列方程并求 x。`, `x=${distance}`];
    }
    if (difficulty === 3) return [`广州研学活动成人票比学生票贵 ${fixed} 元，${unit} 张学生票与 ${unit - 1} 张成人票共 ${unit * x + (unit - 1) * (x + fixed)} 元，求学生票价 x。`, `x=${x}`];
    return [`一件商品按原价 ${unit}x 元打八折后再减 ${fixed} 元，售价为 ${unit * x * 4 / 5 - fixed} 元，求 x。`, `x=${x}`];
  });

  if (rows.length !== 500) throw new Error(`题库数量错误：${rows.length}`);
  return rows.map((item) => ({ ...item, content_sha256: digest(item) }));
}

const questions = buildQuestions();
module.exports = {
  metadata: {
    batch_key: blueprint.batch_key,
    source_title: blueprint.title,
    source_url: 'https://panpan.xpytt.com',
    source_region: '广州',
    source_license: 'project-original',
    source_retrieved_at: blueprint.retrieved_at,
    source_snapshot_sha256: digest(blueprint),
    copy_allowed: false,
    provenance: 'self_authored',
  },
  questions,
};
