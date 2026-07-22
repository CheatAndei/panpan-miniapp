const crypto = require('node:crypto');
const blueprint = require('./junior-calculation-v3-blueprint.json');
const { normalizeLinearEquationDisplay } = require('../../utils/math-expression');

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

const q = (numerator, denominator = 1) => new Fraction(numerator, denominator);
const wrap = (value) => `(${value instanceof Fraction ? value.toString() : value})`;
const signed = (value) => Number(value) < 0 ? `(${value})` : String(value);

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

function signedInteger(next, min, max) {
  const value = integer(next, min, max);
  return next() < 0.5 ? -value : value;
}

function differentInteger(next, min, max, excluded) {
  let value = integer(next, min, max);
  if (value === excluded) value = value === max ? min : value + 1;
  return value;
}

function decimalText(value) {
  const fraction = value instanceof Fraction ? value : q(value);
  let text = (fraction.n / fraction.d).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  if (!text.includes('.')) text += '.0';
  return text;
}

function polynomial(terms) {
  const parts = [];
  for (const [symbol, coefficient] of terms) {
    if (!coefficient) continue;
    const magnitude = Math.abs(coefficient);
    const atom = symbol ? `${magnitude === 1 ? '' : magnitude}${symbol}` : String(magnitude);
    if (!parts.length) parts.push(coefficient < 0 ? `-${atom}` : atom);
    else parts.push(coefficient < 0 ? `-${atom}` : `+${atom}`);
  }
  return parts.join('') || '0';
}

const TYPE_SLUGS = {
  有理数加减: 'rational-add-sub',
  有理数乘除: 'rational-mul-div',
  有理数混合: 'rational-mixed',
  绝对值计算: 'absolute-value',
  有理数巧算: 'rational-shortcut',
  整式化简: 'polynomial-simplify',
  整式求值: 'polynomial-evaluate',
  一元一次方程: 'linear-equation',
};

let serial = 0;
function question(type, templateIndex, stem, answer, seconds) {
  serial += 1;
  return {
    grade_band: '初中',
    subject: '数学',
    module: '综合计算',
    question_type: type,
    difficulty: 3,
    template_key: `junior-calc-v3-${TYPE_SLUGS[type]}-${(templateIndex % 32) + 1}`,
    stem,
    answer: answer instanceof Fraction ? answer.toString() : String(answer),
    estimated_seconds: seconds,
    signature: `junior-calc-v3-${String(serial).padStart(4, '0')}`,
    provenance: 'self_authored',
  };
}

function buildQuestions() {
  const rows = [];
  const stems = new Set();

  function addBatch(type, count, seconds, builder) {
    let added = 0;
    let attempt = 0;
    while (added < count && attempt < count * 100) {
      const currentAttempt = attempt++;
      const built = builder(randomFor(`${type}|${currentAttempt}`), currentAttempt);
      const stem = String(built[0]);
      if (stems.has(stem)) continue;
      stems.add(stem);
      rows.push(question(type, currentAttempt, stem, built[1], built[2] || seconds));
      added += 1;
    }
    if (added !== count) throw new Error(`${type} 题目去重后数量不足：${added}/${count}`);
  }

  addBatch('有理数加减', 120, 75, (next, index) => {
    if (index % 3 === 0) {
      const values = Array.from({ length: 4 }, () => signedInteger(next, 2, 36));
      return [`计算：${signed(values[0])} + ${signed(values[1])} - ${signed(values[2])} + ${signed(values[3])}。`,
        q(values[0]).add(q(values[1])).sub(q(values[2])).add(q(values[3]))];
    }
    if (index % 3 === 1) {
      const a = q(signedInteger(next, 2, 25), integer(next, 2, 9));
      const b = q(signedInteger(next, 2, 24), integer(next, 2, 9));
      const c = q(signedInteger(next, 2, 20), integer(next, 2, 9));
      return [`计算：${wrap(a)} - ${wrap(b)} + ${wrap(c)}。`, a.sub(b).add(c), 90];
    }
    const a = q(signedInteger(next, 12, 180), 10);
    const b = q(signedInteger(next, 12, 180), 10);
    const c = q(signedInteger(next, 12, 180), 10);
    return [`计算：${decimalText(a)} - ${signed(decimalText(b))} + ${signed(decimalText(c))}。`, a.sub(b).add(c), 80];
  });

  addBatch('有理数乘除', 120, 85, (next, index) => {
    if (index % 3 === 0) {
      const a = signedInteger(next, 2, 24);
      const b = signedInteger(next, 2, 15);
      const c = signedInteger(next, 2, 12);
      return [`计算：${signed(a)} × ${signed(b)} ÷ ${signed(c)}。`, q(a).mul(q(b)).div(q(c))];
    }
    if (index % 3 === 1) {
      const a = q(signedInteger(next, 2, 18), integer(next, 2, 8));
      const b = q(signedInteger(next, 2, 18), integer(next, 2, 8));
      const c = q(signedInteger(next, 2, 16), integer(next, 2, 8));
      return [`计算：${wrap(a)} × ${wrap(b)} ÷ ${wrap(c)}。`, a.mul(b).div(c), 100];
    }
    const a = q(signedInteger(next, 12, 90), 10);
    const b = q(signedInteger(next, 2, 15));
    const c = q(signedInteger(next, 2, 12), integer(next, 2, 6));
    return [`计算：${decimalText(a)} × ${signed(b.n)} ÷ ${wrap(c)}。`, a.mul(b).div(c), 95];
  });

  addBatch('有理数混合', 150, 105, (next, index) => {
    if (index % 3 === 0) {
      const a = integer(next, 2, 12);
      const b = signedInteger(next, 2, 20);
      const c = signedInteger(next, 2, 18);
      const d = signedInteger(next, 2, 9);
      return [`计算：-${a}² + |${signed(b)}-${signed(c)}| - ${signed(d)}。`, -a * a + Math.abs(b - c) - d];
    }
    if (index % 3 === 1) {
      const a = signedInteger(next, 2, 8);
      const b = signedInteger(next, 2, 10);
      const c = signedInteger(next, 2, 18);
      return [`计算：(${signed(a)})³ ÷ ${signed(b)} + |${signed(c)}|。`, q(a).pow(3).div(q(b)).add(q(Math.abs(c))), 115];
    }
    const a = signedInteger(next, 2, 15);
    const b = signedInteger(next, 2, 12);
    const c = signedInteger(next, 2, 10);
    const d = signedInteger(next, 2, 8);
    const e = integer(next, 2, 9);
    return [`计算：[${signed(a)}-(${signed(b)}-${signed(c)})]×${signed(d)}+${e}²。`,
      q(a - (b - c)).mul(q(d)).add(q(e).pow(2)), 110];
  });

  addBatch('绝对值计算', 90, 75, (next, index) => {
    const a = signedInteger(next, 2, 36);
    const b = signedInteger(next, 2, 32);
    const c = signedInteger(next, 2, 28);
    if (index % 3 === 0) return [`计算：|${signed(a)}| + |${signed(b)}| - |${signed(c)}|。`, Math.abs(a) + Math.abs(b) - Math.abs(c)];
    if (index % 3 === 1) return [`计算：|${signed(a)}-${signed(b)}| + |${signed(b)}-${signed(c)}|。`, Math.abs(a - b) + Math.abs(b - c)];
    return [`计算：|${signed(a + b)}| - |${signed(a)}| + |${signed(c - b)}|。`, Math.abs(a + b) - Math.abs(a) + Math.abs(c - b)];
  });

  addBatch('有理数巧算', 80, 90, (next, index) => {
    if (index % 4 === 0) {
      const n = integer(next, 12, 120);
      return [`用简便方法计算：${n}²-${n - 1}×${n + 1}。`, 1];
    }
    if (index % 4 === 1) {
      const a = signedInteger(next, 3, 24);
      const b = signedInteger(next, 8, 40);
      const c = signedInteger(next, 3, 18);
      return [`用简便方法计算：${signed(a)}×(${signed(b)}+${signed(c)})-${signed(a)}×${signed(b)}。`, a * c];
    }
    if (index % 4 === 2) {
      const n = integer(next, 5, 60);
      return [`用简便方法计算：1/(1×2)+1/(2×3)+…+1/(${n}×${n + 1})。`, q(n, n + 1), 105];
    }
    const a = signedInteger(next, 3, 36);
    const nearHundred = next() < 0.5 ? 99 : 101;
    const correction = nearHundred === 99 ? a : -a;
    return [`用简便方法计算：${signed(a)}×${nearHundred}+${signed(correction)}。`, a * 100];
  });

  addBatch('整式化简', 150, 100, (next, index) => {
    const a = integer(next, 2, 12);
    const b = integer(next, 2, 9);
    const c = differentInteger(next, 1, 10, a);
    const d = integer(next, 1, 8);
    if (index % 3 === 0) {
      return [`化简：${a}(x²+${b}x)-${c}(x²-${d}x)。`, polynomial([['x²', a - c], ['x', a * b + c * d]])];
    }
    if (index % 3 === 1) {
      return [`化简：${a}(xy-x²y)-${c}(xy-${d}x²y)。`, polynomial([['x²y', -a + c * d], ['xy', a - c]])];
    }
    const e = integer(next, 1, 7);
    return [`化简：${a}(2x-y)-${c}(x+${d}y)+${e}y。`, polynomial([['x', 2 * a - c], ['y', -a - c * d + e]])];
  });

  addBatch('整式求值', 90, 110, (next, index) => {
    const x = signedInteger(next, 1, 6);
    const y = signedInteger(next, 1, 6);
    const a = integer(next, 2, 8);
    const b = integer(next, 1, 7);
    const c = integer(next, 1, 6);
    const d = integer(next, 1, 6);
    if (index % 2 === 0) {
      return [`先化简再求值：${a}x+${b}y-(${c}x-${d}y)，其中 x=${x}，y=${y}。`, (a - c) * x + (b + d) * y];
    }
    return [`先化简再求值：${a}x²-${b}xy+${c}y²-(${d}x²-${b}xy)，其中 x=${x}，y=${y}。`,
      (a - d) * x * x + c * y * y, 120];
  });

  addBatch('一元一次方程', 160, 120, (next, index) => {
    const x = signedInteger(next, 2, 20);
    if (index % 4 === 0) {
      const a = integer(next, 2, 9);
      const c = differentInteger(next, 1, 8, a);
      const b = signedInteger(next, 2, 18);
      const d = (a - c) * x + b;
      return [`解方程：${polynomial([['x', a], ['', b]])}=${polynomial([['x', c], ['', d]])}。`, `x=${x}`];
    }
    if (index % 4 === 1) {
      const a = integer(next, 2, 8);
      const b = signedInteger(next, 2, 10);
      const c = signedInteger(next, 1, 12);
      const d = differentInteger(next, 1, 7, a);
      const rightConstant = a * (x + b) - c - d * x;
      return [`解方程：${a}(x${b < 0 ? b : `+${b}`})${c < 0 ? c : `+${c}`}=${polynomial([['x', d], ['', rightConstant]])}。`, `x=${x}`];
    }
    if (index % 4 === 2) {
      const a = signedInteger(next, 1, 8);
      const c = signedInteger(next, 1, 8);
      const b = integer(next, 2, 8);
      const d = differentInteger(next, 2, 9, b);
      const rhs = q(x + a, b).sub(q(x - c, d));
      return [`解方程：(x${a < 0 ? a : `+${a}`})/${b}-(x${-c < 0 ? -c : `+${-c}`})/${d}=${rhs}。`, `x=${x}`, 135];
    }
    const left = integer(next, 1, 4);
    const right = differentInteger(next, 5, 9, left);
    const constant = q(signedInteger(next, 2, 30), 10);
    const rightConstant = constant.add(q((left - right) * x, 10));
    const legacyStem = `解方程：0.${left}x+${decimalText(constant)}=0.${right}x+${decimalText(rightConstant)}。`;
    return [normalizeLinearEquationDisplay(legacyStem), `x=${x}`, 130];
  });

  if (rows.length !== blueprint.distribution.total) throw new Error(`题库数量错误：${rows.length}`);
  if (new Set(rows.map((item) => item.stem)).size !== rows.length) throw new Error('题干存在重复');
  return rows.map((item) => ({ ...item, content_sha256: digest(item) }));
}

const questions = buildQuestions();

module.exports = {
  metadata: {
    batch_key: blueprint.batch_key,
    source_title: blueprint.title,
    source_url: 'https://panpan.xpytt.com',
    source_region: blueprint.region,
    source_license: blueprint.license,
    source_retrieved_at: blueprint.retrieved_at,
    source_snapshot_sha256: digest(blueprint),
    copy_allowed: blueprint.copy_allowed,
    provenance: blueprint.provenance,
  },
  questions,
};
