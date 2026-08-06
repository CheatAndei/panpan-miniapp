const crypto = require('node:crypto');
const blueprint = require('./g7-calculation-v4-blueprint.json');

function gcd(a, b) {
  let x = Math.abs(Number(a));
  let y = Math.abs(Number(b));
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

class Fraction {
  constructor(numerator, denominator = 1) {
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) {
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
  div(other) {
    if (other.n === 0) throw new Error('division by zero');
    return new Fraction(this.n * other.d, this.d * other.n);
  }
  pow(power) { return new Fraction(this.n ** power, this.d ** power); }
  abs() { return new Fraction(Math.abs(this.n), this.d); }
  neg() { return new Fraction(-this.n, this.d); }
  toString() { return this.d === 1 ? String(this.n) : this.n + '/' + this.d; }
}

const f = (numerator, denominator = 1) => new Fraction(numerator, denominator);
const asFraction = (value) => value instanceof Fraction ? value : f(value);
const asText = (value) => asFraction(value).toString();
const signed = (value) => {
  const text = typeof value === 'string' ? value : asText(value);
  return text.startsWith('-') ? '(' + text + ')' : text;
};
const shift = (value) => Number(value) < 0 ? String(value) : '+' + value;
const absText = (value) => Math.abs(Number(value));

function positive(index, salt, min, max) {
  return min + ((index * (17 + salt * 2) + salt * 11) % (max - min + 1));
}

function alternating(index, salt, min, max) {
  const value = positive(index, salt, min, max);
  return (index + salt) % 2 ? -value : value;
}

function anchored(index, salt, base) {
  const value = base + index;
  return (index + salt) % 2 ? -value : value;
}

function decimalText(value) {
  const rational = asFraction(value);
  let denominator = rational.d;
  let twos = 0;
  let fives = 0;
  while (denominator % 2 === 0) { denominator /= 2; twos += 1; }
  while (denominator % 5 === 0) { denominator /= 5; fives += 1; }
  if (denominator !== 1) return rational.toString();
  const places = Math.max(twos, fives);
  if (places === 0) return rational.n + '.0';
  const scale = 10 ** places;
  const scaled = Math.abs(rational.n) * (scale / rational.d);
  const digits = String(scaled).padStart(places + 1, '0');
  return (rational.n < 0 ? '-' : '') + digits.slice(0, -places) + '.' + digits.slice(-places);
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

function valueNode(value) {
  const rational = asFraction(value);
  return { op: 'value', n: rational.n, d: rational.d };
}

const addNode = (...args) => ({ op: 'add', args });
const subNode = (left, right) => ({ op: 'sub', left, right });
const mulNode = (...args) => ({ op: 'mul', args });
const divNode = (left, right) => ({ op: 'div', left, right });
const powNode = (base, power) => ({ op: 'pow', base, power });
const absNode = (value) => ({ op: 'abs', value });
const negNode = (value) => ({ op: 'neg', value });
const telescopeNode = (start, end) => ({ op: 'telescoping', start, end });

const TERM_ORDER = ['x³', 'x²y', 'xy²', 'x²', 'xy', 'y²', 'x', 'y', ''];

function formatPolynomial(coefficients) {
  const parts = [];
  for (const term of TERM_ORDER) {
    const coefficient = Number(coefficients[term] || 0);
    if (!coefficient) continue;
    const magnitude = Math.abs(coefficient);
    const atom = term ? (magnitude === 1 ? term : magnitude + term) : String(magnitude);
    if (!parts.length) parts.push(coefficient < 0 ? '-' + atom : atom);
    else parts.push(coefficient < 0 ? '-' + atom : '+' + atom);
  }
  return parts.join('') || '0';
}

function formatAffine(a, b) {
  return formatPolynomial({ x: a, '': b });
}

function normalizeStem(stem) {
  return String(stem).replace(/(?<![\d.])1(?=[xy(])/g, '');
}

function numericResult(stem, directAnswer, expression, complexity) {
  return {
    stem,
    answer: asText(directAnswer),
    verification: { kind: 'numeric', expression },
    complexity,
  };
}

function polynomialResult(stem, directCoefficients, groups, complexity) {
  return {
    stem,
    answer: formatPolynomial(directCoefficients),
    verification: { kind: 'polynomial', groups },
    complexity,
  };
}

function equationResult(stem, solution, left, right, complexity) {
  return {
    stem,
    answer: 'x=' + asText(solution),
    verification: { kind: 'equation', left, right },
    complexity,
  };
}

function standardComplexity(overrides = {}) {
  return { steps: 3, grouping: 1, number_forms: 1, pitfalls: 1, ...overrides };
}

function advancedComplexity(overrides = {}) {
  return { steps: 6, grouping: 2, number_forms: 2, pitfalls: 2, ...overrides };
}

function rationalAddSub(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  if (difficulty === 3) {
    if (family === 0) {
      const a = 12 + j;
      const b = alternating(j, 1, 3, 24);
      const c = alternating(j, 2, 2, 21);
      const d = alternating(j, 3, 4, 25);
      return numericResult(
        '计算：' + a + ' + ' + signed(b) + ' - ' + signed(c) + ' + ' + signed(d) + '。',
        f(a).add(f(b)).sub(f(c)).add(f(d)),
        addNode(valueNode(a), valueNode(b), negNode(valueNode(c)), valueNode(d)),
        standardComplexity({ steps: 3, grouping: 2 }),
      );
    }
    if (family === 1) {
      const a = f(j + 5, 7);
      const b = f(alternating(j, 2, 3, 27), 6);
      const c = f(alternating(j, 4, 2, 25), 9);
      const d = f(alternating(j, 6, 2, 19), 5);
      return numericResult(
        '计算：(' + a + ') - (' + b + ') + (' + c + ') - (' + d + ')。',
        a.sub(b).add(c).sub(d),
        addNode(valueNode(a), negNode(valueNode(b)), valueNode(c), negNode(valueNode(d))),
        standardComplexity({ steps: 3, grouping: 4, number_forms: 1, pitfalls: 2 }),
      );
    }
    if (family === 2) {
      const a = f(j + 31, 10);
      const b = f(alternating(j, 3, 11, 59), 10);
      const c = f(alternating(j, 5, 7, 48), 10);
      const d = f(alternating(j, 7, 9, 52), 10);
      return numericResult(
        '计算：' + decimalText(a) + ' - ' + signed(decimalText(b)) + ' + ' + signed(decimalText(c)) + ' - ' + signed(decimalText(d)) + '。',
        a.sub(b).add(c).sub(d),
        addNode(valueNode(a), negNode(valueNode(b)), valueNode(c), negNode(valueNode(d))),
        standardComplexity({ steps: 3, grouping: 3, number_forms: 1, pitfalls: 2 }),
      );
    }
    const a = 18 + j;
    const b = alternating(j, 2, 4, 20);
    const c = alternating(j, 5, 3, 17);
    const d = alternating(j, 8, 2, 22);
    return numericResult(
      '计算：' + a + '-[' + signed(b) + '-' + signed(c) + ']+' + signed(d) + '。',
      f(a).sub(f(b).sub(f(c))).add(f(d)),
      addNode(subNode(valueNode(a), subNode(valueNode(b), valueNode(c))), valueNode(d)),
      standardComplexity({ steps: 3, grouping: 3, pitfalls: 2 }),
    );
  }

  if (family === 0) {
    const a = 21 + j;
    const b = alternating(j, 1, 3, 24);
    const c = alternating(j, 2, 2, 19);
    const d = alternating(j, 3, 4, 23);
    const e = alternating(j, 4, 2, 18);
    const g = alternating(j, 5, 3, 17);
    const direct = f(a).sub(f(b).sub(f(c))).add(f(d).sub(f(e).add(f(g))));
    return numericResult(
      '计算：[' + a + '-(' + signed(b) + '-' + signed(c) + ')]+[' + signed(d) + '-(' + signed(e) + '+' + signed(g) + ')]。',
      direct,
      addNode(
        subNode(valueNode(a), subNode(valueNode(b), valueNode(c))),
        subNode(valueNode(d), addNode(valueNode(e), valueNode(g))),
      ),
      advancedComplexity({ steps: 7, grouping: 6, pitfalls: 3 }),
    );
  }
  if (family === 1) {
    const a = f(j + 9, 7);
    const b = f(alternating(j, 2, 4, 29), 6);
    const c = f(alternating(j, 3, 3, 26), 5);
    const d = f(alternating(j, 5, 2, 23), 9);
    const e = f(alternating(j, 7, 2, 21), 8);
    const direct = a.sub(b.sub(c)).sub(d.add(e));
    return numericResult(
      '计算：(' + a + ')-[(' + b + ')-(' + c + ')]-[(' + d + ')+(' + e + ')]。',
      direct,
      subNode(subNode(valueNode(a), subNode(valueNode(b), valueNode(c))), addNode(valueNode(d), valueNode(e))),
      advancedComplexity({ steps: 6, grouping: 8, number_forms: 1, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const a = f(j + 24, 10);
    const b = f(alternating(j, 2, 3, 25), 4);
    const c = f(alternating(j, 4, 7, 48), 10);
    const d = f(alternating(j, 5, 3, 27), 5);
    const e = f(alternating(j, 7, 9, 53), 10);
    const direct = a.sub(b).add(c.sub(d)).sub(e);
    return numericResult(
      '计算：' + decimalText(a) + '-(' + b + ')+[' + decimalText(c) + '-(' + d + ')]-' + signed(decimalText(e)) + '。',
      direct,
      addNode(valueNode(a), negNode(valueNode(b)), subNode(valueNode(c), valueNode(d)), negNode(valueNode(e))),
      advancedComplexity({ steps: 6, grouping: 5, number_forms: 2, pitfalls: 3 }),
    );
  }
  const a = 25 + j;
  const b = alternating(j, 1, 4, 22);
  const c = alternating(j, 2, 3, 19);
  const d = alternating(j, 4, 2, 17);
  const e = alternating(j, 5, 5, 24);
  const g = alternating(j, 7, 3, 21);
  const h = alternating(j, 8, 2, 16);
  const direct = f(a).sub(f(b).sub(f(c).sub(f(d)))).sub(f(e).sub(f(g).sub(f(h))));
  return numericResult(
    '计算：' + a + '-[' + signed(b) + '-(' + signed(c) + '-' + signed(d) + ')]-[' + signed(e) + '-(' + signed(g) + '-' + signed(h) + ')]。',
    direct,
    subNode(
      subNode(valueNode(a), subNode(valueNode(b), subNode(valueNode(c), valueNode(d)))),
      subNode(valueNode(e), subNode(valueNode(g), valueNode(h))),
    ),
    advancedComplexity({ steps: 8, grouping: 7, pitfalls: 4 }),
  );
}

function rationalMulDiv(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  if (difficulty === 3) {
    if (family === 0) {
      const a = anchored(j, 1, 5);
      const b = alternating(j, 2, 3, 18);
      const c = 2 + (j % 9);
      return numericResult(
        '计算：' + signed(a) + '×' + signed(b) + '÷' + c + '。',
        f(a).mul(f(b)).div(f(c)),
        divNode(mulNode(valueNode(a), valueNode(b)), valueNode(c)),
        standardComplexity({ steps: 2, grouping: 2, pitfalls: 2 }),
      );
    }
    if (family === 1) {
      const a = f(j + 5, 7);
      const b = f(alternating(j, 2, 3, 21), 5);
      const c = f(alternating(j, 4, 2, 17), 6);
      return numericResult(
        '计算：(' + a + ')×(' + b + ')÷(' + c + ')。',
        a.mul(b).div(c),
        divNode(mulNode(valueNode(a), valueNode(b)), valueNode(c)),
        standardComplexity({ steps: 2, grouping: 6, number_forms: 1, pitfalls: 2 }),
      );
    }
    if (family === 2) {
      const a = f(j + 18, 10);
      const b = alternating(j, 3, 2, 14);
      const c = f(alternating(j, 5, 2, 15), 4);
      return numericResult(
        '计算：' + decimalText(a) + '×' + signed(b) + '÷(' + c + ')。',
        a.mul(f(b)).div(c),
        divNode(mulNode(valueNode(a), valueNode(b)), valueNode(c)),
        standardComplexity({ steps: 2, grouping: 3, number_forms: 3, pitfalls: 2 }),
      );
    }
    const a = anchored(j, 1, 6);
    const b = 2 + (j % 7);
    const c = alternating(j, 4, 4, 25);
    const d = 3 + (j % 8);
    return numericResult(
      '计算：(' + signed(a) + '÷' + b + ')×(' + signed(c) + '÷' + d + ')。',
      f(a).div(f(b)).mul(f(c).div(f(d))),
      mulNode(divNode(valueNode(a), valueNode(b)), divNode(valueNode(c), valueNode(d))),
      standardComplexity({ steps: 3, grouping: 4, pitfalls: 2 }),
    );
  }

  if (family === 0) {
    const a = anchored(j, 1, 7);
    const b = alternating(j, 2, 3, 19);
    const c = 2 + (j % 8);
    const d = alternating(j, 4, 4, 23);
    const e = 3 + (j % 7);
    const direct = f(a).mul(f(b)).div(f(c)).mul(f(d).div(f(e)));
    return numericResult(
      '计算：[(' + signed(a) + '×' + signed(b) + ')÷' + c + ']×[' + signed(d) + '÷' + e + ']。',
      direct,
      mulNode(divNode(mulNode(valueNode(a), valueNode(b)), valueNode(c)), divNode(valueNode(d), valueNode(e))),
      advancedComplexity({ steps: 6, grouping: 6, number_forms: 2, pitfalls: 3 }),
    );
  }
  if (family === 1) {
    const a = f(j + 7, 8);
    const b = f(alternating(j, 2, 3, 23), 7);
    const c = f(alternating(j, 4, 2, 19), 5);
    const d = f(alternating(j, 6, 4, 25), 9);
    const direct = a.div(b.mul(c)).mul(d);
    return numericResult(
      '计算：(' + a + ')÷[(' + b + ')×(' + c + ')]×(' + d + ')。',
      direct,
      mulNode(divNode(valueNode(a), mulNode(valueNode(b), valueNode(c))), valueNode(d)),
      advancedComplexity({ steps: 5, grouping: 9, number_forms: 1, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const a = f(j + 23, 10);
    const b = f(alternating(j, 2, 3, 17), 4);
    const c = alternating(j, 5, 2, 13);
    const d = f(alternating(j, 7, 2, 15), 5);
    const direct = a.mul(b).div(f(c)).div(d);
    return numericResult(
      '计算：[' + decimalText(a) + '×(' + b + ')]÷' + signed(c) + '÷(' + d + ')。',
      direct,
      divNode(divNode(mulNode(valueNode(a), valueNode(b)), valueNode(c)), valueNode(d)),
      advancedComplexity({ steps: 5, grouping: 5, number_forms: 3, pitfalls: 3 }),
    );
  }
  const a = anchored(j, 1, 8);
  const b = 2 + (j % 7);
  const c = alternating(j, 3, 4, 24);
  const d = 3 + (j % 8);
  const e = f(alternating(j, 5, 3, 19), 6);
  const direct = f(a).div(f(b)).mul(f(c).div(f(d))).div(e);
  return numericResult(
    '计算：[(' + signed(a) + '÷' + b + ')×(' + signed(c) + '÷' + d + ')]÷(' + e + ')。',
    direct,
    divNode(mulNode(divNode(valueNode(a), valueNode(b)), divNode(valueNode(c), valueNode(d))), valueNode(e)),
    advancedComplexity({ steps: 6, grouping: 7, number_forms: 2, pitfalls: 3 }),
  );
}

function rationalMixed(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  if (difficulty === 3) {
    if (family === 0) {
      const a = 3 + (j % 10);
      const b = anchored(j, 2, 4);
      const c = alternating(j, 4, 3, 22);
      const d = alternating(j, 5, 2, 17);
      return numericResult(
        '计算：-' + a + '²+|' + signed(b) + '-' + signed(c) + '|-' + signed(d) + '。',
        f(a).pow(2).neg().add(f(b - c).abs()).sub(f(d)),
        addNode(negNode(powNode(valueNode(a), 2)), absNode(subNode(valueNode(b), valueNode(c))), negNode(valueNode(d))),
        standardComplexity({ steps: 4, grouping: 3, pitfalls: 3 }),
      );
    }
    if (family === 1) {
      const a = anchored(j, 1, 3);
      const b = alternating(j, 3, 2, 11);
      const c = alternating(j, 5, 3, 24);
      return numericResult(
        '计算：(' + signed(a) + ')³÷' + signed(b) + '+|' + signed(c) + '|。',
        f(a).pow(3).div(f(b)).add(f(c).abs()),
        addNode(divNode(powNode(valueNode(a), 3), valueNode(b)), absNode(valueNode(c))),
        standardComplexity({ steps: 3, grouping: 3, pitfalls: 3 }),
      );
    }
    if (family === 2) {
      const a = 13 + j;
      const b = alternating(j, 2, 3, 18);
      const c = alternating(j, 4, 2, 16);
      const d = alternating(j, 5, 2, 9);
      const e = 2 + (j % 8);
      return numericResult(
        '计算：[' + a + '-(' + signed(b) + '-' + signed(c) + ')]×' + signed(d) + '+' + e + '²。',
        f(a - (b - c)).mul(f(d)).add(f(e).pow(2)),
        addNode(mulNode(subNode(valueNode(a), subNode(valueNode(b), valueNode(c))), valueNode(d)), powNode(valueNode(e), 2)),
        standardComplexity({ steps: 5, grouping: 4, pitfalls: 2 }),
      );
    }
    const a = 15 + j;
    const b = alternating(j, 2, 3, 16);
    const c = alternating(j, 4, 2, 12);
    const d = alternating(j, 6, 2, 10);
    const e = alternating(j, 8, 3, 19);
    return numericResult(
      '计算：' + a + '-' + signed(b) + '×(' + signed(c) + '-' + signed(d) + ')+|' + signed(e) + '|。',
      f(a).sub(f(b).mul(f(c).sub(f(d)))).add(f(e).abs()),
      addNode(subNode(valueNode(a), mulNode(valueNode(b), subNode(valueNode(c), valueNode(d)))), absNode(valueNode(e))),
      standardComplexity({ steps: 4, grouping: 3, pitfalls: 2 }),
    );
  }

  if (family === 0) {
    const a = 17 + j;
    const b = alternating(j, 1, 3, 18);
    const c = alternating(j, 2, 2, 16);
    const d = alternating(j, 4, 2, 9);
    const e = 2 + (j % 7);
    const g = alternating(j, 6, 2, 8);
    const h = alternating(j, 8, 3, 21);
    const numerator = f(a - (b - c)).mul(f(d)).add(f(e).pow(2));
    return numericResult(
      '计算：{[' + a + '-(' + signed(b) + '-' + signed(c) + ')]×' + signed(d) + '+' + e + '²}÷' + signed(g) + '-|' + signed(h) + '|。',
      numerator.div(f(g)).sub(f(h).abs()),
      subNode(divNode(addNode(mulNode(subNode(valueNode(a), subNode(valueNode(b), valueNode(c))), valueNode(d)), powNode(valueNode(e), 2)), valueNode(g)), absNode(valueNode(h))),
      advancedComplexity({ steps: 8, grouping: 7, pitfalls: 4 }),
    );
  }
  if (family === 1) {
    const a = 19 + j;
    const b = alternating(j, 1, 3, 18);
    const c = alternating(j, 3, 2, 15);
    const d = alternating(j, 4, 2, 8);
    const e = alternating(j, 6, 3, 17);
    const g = alternating(j, 8, 2, 13);
    const inner = f(c).sub(f(d).mul(f(e).sub(f(g))));
    return numericResult(
      '计算：-|'+ a + '-' + signed(b) + '|+[' + signed(c) + '-' + signed(d) + '×(' + signed(e) + '-' + signed(g) + ')]²。',
      f(a - b).abs().neg().add(inner.pow(2)),
      addNode(negNode(absNode(subNode(valueNode(a), valueNode(b)))), powNode(subNode(valueNode(c), mulNode(valueNode(d), subNode(valueNode(e), valueNode(g)))), 2)),
      advancedComplexity({ steps: 7, grouping: 6, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const a = f(j + 8, 7);
    const b = f(alternating(j, 2, 3, 19), 5);
    const c = f(alternating(j, 4, 2, 17), 6);
    const d = f(alternating(j, 6, 2, 15), 4);
    const e = alternating(j, 8, 2, 7);
    const direct = a.sub(b).mul(c.add(d)).sub(f(e).pow(2));
    return numericResult(
      '计算：[(' + a + ')-(' + b + ')]×[(' + c + ')+(' + d + ')]-(' + signed(e) + ')²。',
      direct,
      subNode(mulNode(subNode(valueNode(a), valueNode(b)), addNode(valueNode(c), valueNode(d))), powNode(valueNode(e), 2)),
      advancedComplexity({ steps: 6, grouping: 10, number_forms: 2, pitfalls: 4 }),
    );
  }
  const a = 20 + j;
  const b = alternating(j, 2, 3, 16);
  const c = alternating(j, 4, 2, 13);
  const d = alternating(j, 5, 2, 8);
  const e = alternating(j, 7, 3, 18);
  const g = alternating(j, 8, 2, 12);
  const h = 2 + (j % 6);
  const direct = f(a).sub(f(b).mul(f(c).sub(f(d)))).add(f(e - g).abs()).div(f(h));
  return numericResult(
    '计算：{' + a + '-' + signed(b) + '×[' + signed(c) + '-(' + signed(d) + ')]+|' + signed(e) + '-' + signed(g) + '|}÷' + h + '。',
    direct,
    divNode(addNode(subNode(valueNode(a), mulNode(valueNode(b), subNode(valueNode(c), valueNode(d)))), absNode(subNode(valueNode(e), valueNode(g)))), valueNode(h)),
    advancedComplexity({ steps: 7, grouping: 6, pitfalls: 4 }),
  );
}

function absoluteValue(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  if (difficulty === 3) {
    const a = anchored(j, 1, 8);
    const b = alternating(j, 3, 4, 31);
    const c = alternating(j, 5, 3, 27);
    if (family === 0) {
      return numericResult(
        '计算：|' + signed(a) + '|+|' + signed(b) + '|-|' + signed(c) + '|。',
        f(a).abs().add(f(b).abs()).sub(f(c).abs()),
        addNode(absNode(valueNode(a)), absNode(valueNode(b)), negNode(absNode(valueNode(c)))),
        standardComplexity({ steps: 3, grouping: 3, pitfalls: 2 }),
      );
    }
    if (family === 1) {
      return numericResult(
        '计算：|' + signed(a) + '-' + signed(b) + '|+|' + signed(b) + '-' + signed(c) + '|。',
        f(a - b).abs().add(f(b - c).abs()),
        addNode(absNode(subNode(valueNode(a), valueNode(b))), absNode(subNode(valueNode(b), valueNode(c)))),
        standardComplexity({ steps: 3, grouping: 4, pitfalls: 2 }),
      );
    }
    if (family === 2) {
      return numericResult(
        '计算：||' + signed(a) + '-' + signed(b) + '|-' + absText(c) + '|。',
        f(Math.abs(a - b) - Math.abs(c)).abs(),
        absNode(subNode(absNode(subNode(valueNode(a), valueNode(b))), valueNode(Math.abs(c)))),
        standardComplexity({ steps: 3, grouping: 3, pitfalls: 2 }),
      );
    }
    return numericResult(
      '计算：|' + signed(a) + '+' + signed(b) + '|-|' + signed(a) + '|+|' + signed(c) + '-' + signed(b) + '|。',
      f(a + b).abs().sub(f(a).abs()).add(f(c - b).abs()),
      addNode(absNode(addNode(valueNode(a), valueNode(b))), negNode(absNode(valueNode(a))), absNode(subNode(valueNode(c), valueNode(b)))),
      standardComplexity({ steps: 4, grouping: 5, pitfalls: 3 }),
    );
  }

  const a = anchored(j, 1, 9);
  const b = alternating(j, 2, 5, 33);
  const c = alternating(j, 4, 4, 29);
  const d = alternating(j, 6, 3, 26);
  const e = alternating(j, 7, 2, 21);
  const g = alternating(j, 9, 2, 19);
  if (family === 0) {
    const direct = f(Math.abs(a - b) - Math.abs(c - d)).abs().add(f(e - g).abs());
    return numericResult(
      '计算：||' + signed(a) + '-' + signed(b) + '|-|' + signed(c) + '-' + signed(d) + '||+|' + signed(e) + '-' + signed(g) + '|。',
      direct,
      addNode(absNode(subNode(absNode(subNode(valueNode(a), valueNode(b))), absNode(subNode(valueNode(c), valueNode(d))))), absNode(subNode(valueNode(e), valueNode(g)))),
      advancedComplexity({ steps: 7, grouping: 8, pitfalls: 4 }),
    );
  }
  if (family === 1) {
    const direct = f(a - (b - c)).abs().add(f(Math.abs(d) - e).abs()).sub(f(g).abs());
    return numericResult(
      '计算：|' + signed(a) + '-(' + signed(b) + '-' + signed(c) + ')|+||' + signed(d) + '|-' + signed(e) + '|-|' + signed(g) + '|。',
      direct,
      addNode(absNode(subNode(valueNode(a), subNode(valueNode(b), valueNode(c)))), absNode(subNode(absNode(valueNode(d)), valueNode(e))), negNode(absNode(valueNode(g)))),
      advancedComplexity({ steps: 7, grouping: 7, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const p = f(j + 7, 6);
    const q = f(b, 5);
    const r = f(c, 4);
    const s = f(d, 7);
    const direct = p.sub(q).abs().sub(r.add(s).abs()).abs();
    return numericResult(
      '计算：||(' + p + ')-(' + q + ')|-|(' + r + ')+(' + s + ')||。',
      direct,
      absNode(subNode(absNode(subNode(valueNode(p), valueNode(q))), absNode(addNode(valueNode(r), valueNode(s))))),
      advancedComplexity({ steps: 6, grouping: 10, number_forms: 2, pitfalls: 4 }),
    );
  }
  const p = f(j + 16, 10);
  const q = f(b, 10);
  const r = f(c, 5);
  const s = f(d, 10);
  const direct = p.sub(q.sub(r)).abs().add(s.abs()).sub(p.abs());
  return numericResult(
    '计算：|' + decimalText(p) + '-[' + signed(decimalText(q)) + '-(' + r + ')]|+|' + decimalText(s) + '|-|' + decimalText(p) + '|。',
    direct,
    addNode(absNode(subNode(valueNode(p), subNode(valueNode(q), valueNode(r)))), absNode(valueNode(s)), negNode(absNode(valueNode(p)))),
    advancedComplexity({ steps: 7, grouping: 7, number_forms: 2, pitfalls: 4 }),
  );
}

function rationalShortcut(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  if (difficulty === 3) {
    if (family === 0) {
      const n = 12 + j;
      return numericResult(
        '用简便方法计算：' + n + '²-' + (n - 1) + '×' + (n + 1) + '。',
        f(n * n - (n - 1) * (n + 1)),
        subNode(powNode(valueNode(n), 2), mulNode(valueNode(n - 1), valueNode(n + 1))),
        standardComplexity({ steps: 3, grouping: 1, pitfalls: 2 }),
      );
    }
    if (family === 1) {
      const a = alternating(j, 1, 3, 18);
      const b = 11 + j;
      const c = alternating(j, 4, 2, 15);
      return numericResult(
        '用简便方法计算：' + signed(a) + '×(' + b + shift(c) + ')-' + signed(a) + '×' + b + '。',
        f(a * (b + c) - a * b),
        subNode(mulNode(valueNode(a), addNode(valueNode(b), valueNode(c))), mulNode(valueNode(a), valueNode(b))),
        standardComplexity({ steps: 3, grouping: 2, pitfalls: 2 }),
      );
    }
    if (family === 2) {
      const n = 8 + j;
      return numericResult(
        '用简便方法计算：1/(1×2)+1/(2×3)+…+1/(' + n + '×' + (n + 1) + ')。',
        f(n, n + 1),
        telescopeNode(1, n),
        standardComplexity({ steps: 4, grouping: 2, number_forms: 1, pitfalls: 2 }),
      );
    }
    const a = anchored(j, 3, 5);
    const near = j % 2 ? 101 : 99;
    const correction = near === 99 ? a : -a;
    return numericResult(
      '用简便方法计算：' + signed(a) + '×' + near + shift(correction) + '。',
      f(a * near + correction),
      addNode(mulNode(valueNode(a), valueNode(near)), valueNode(correction)),
      standardComplexity({ steps: 3, grouping: 1, pitfalls: 2 }),
    );
  }

  if (family === 0) {
    const n = 14 + j;
    const direct = f(n * n - (n - 1) * (n + 1) + (n + 1) ** 2 - n * (n + 2));
    return numericResult(
      '用简便方法计算：[' + n + '²-' + (n - 1) + '×' + (n + 1) + ']+[' + (n + 1) + '²-' + n + '×' + (n + 2) + ']。',
      direct,
      addNode(
        subNode(powNode(valueNode(n), 2), mulNode(valueNode(n - 1), valueNode(n + 1))),
        subNode(powNode(valueNode(n + 1), 2), mulNode(valueNode(n), valueNode(n + 2))),
      ),
      advancedComplexity({ steps: 7, grouping: 4, pitfalls: 3 }),
    );
  }
  if (family === 1) {
    const a = alternating(j, 1, 3, 17);
    const b = 13 + j;
    const c = alternating(j, 4, 2, 14);
    const d = alternating(j, 6, 3, 16);
    const direct = f(a * (b + c) - a * b + d * (b + c) - d * b);
    return numericResult(
      '用简便方法计算：' + signed(a) + '×(' + b + shift(c) + ')-' + signed(a) + '×' + b + '+' + signed(d) + '×(' + b + shift(c) + ')-' + signed(d) + '×' + b + '。',
      direct,
      addNode(
        subNode(mulNode(valueNode(a), addNode(valueNode(b), valueNode(c))), mulNode(valueNode(a), valueNode(b))),
        subNode(mulNode(valueNode(d), addNode(valueNode(b), valueNode(c))), mulNode(valueNode(d), valueNode(b))),
      ),
      advancedComplexity({ steps: 8, grouping: 4, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const n = 10 + j;
    return numericResult(
      '用简便方法计算：1/(1×2)+1/(2×3)+…+1/(' + n + '×' + (n + 1) + ')+1/' + (n + 1) + '。',
      f(1),
      addNode(telescopeNode(1, n), valueNode(f(1, n + 1))),
      advancedComplexity({ steps: 6, grouping: 3, number_forms: 2, pitfalls: 3 }),
    );
  }
  const a = anchored(j, 1, 6);
  const b = alternating(j, 4, 4, 24);
  const direct = f(a * 99 + b * 101 + a - b);
  return numericResult(
    '用简便方法计算：' + signed(a) + '×99+' + signed(b) + '×101+' + signed(a) + '-' + signed(b) + '。',
    direct,
    addNode(mulNode(valueNode(a), valueNode(99)), mulNode(valueNode(b), valueNode(101)), valueNode(a), negNode(valueNode(b))),
    advancedComplexity({ steps: 7, grouping: 2, pitfalls: 4 }),
  );
}

function polynomialSimplify(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  if (difficulty === 3) {
    if (family === 0) {
      const a = 2 + (j % 8);
      const b = 2 + j;
      const c = 1 + (j % 7);
      const d = 2 + (j % 6);
      return polynomialResult(
        '化简：' + a + '(x²+' + b + 'x)-' + c + '(x²-' + d + 'x)。',
        { 'x²': a - c, x: a * b + c * d },
        [
          { scale: a, terms: { 'x²': 1, x: b } },
          { scale: -c, terms: { 'x²': 1, x: -d } },
        ],
        standardComplexity({ steps: 4, grouping: 2, pitfalls: 2 }),
      );
    }
    if (family === 1) {
      const a = 2 + (j % 7);
      const b = 2 + j;
      const c = 1 + (j % 6);
      const d = 2 + (j % 5);
      return polynomialResult(
        '化简：' + a + '(xy-' + b + 'x²y)-' + c + '(xy-' + d + 'x²y)。',
        { 'x²y': -a * b + c * d, xy: a - c },
        [
          { scale: a, terms: { xy: 1, 'x²y': -b } },
          { scale: -c, terms: { xy: 1, 'x²y': -d } },
        ],
        standardComplexity({ steps: 4, grouping: 2, pitfalls: 3 }),
      );
    }
    if (family === 2) {
      const a = 2 + (j % 8);
      const b = 2 + j;
      const c = 1 + (j % 7);
      const d = 1 + (j % 6);
      const e = 1 + (j % 9);
      return polynomialResult(
        '化简：' + a + '(2x-y)-' + c + '(x+' + b + 'y)+' + d + 'x+' + e + 'y。',
        { x: 2 * a - c + d, y: -a - c * b + e },
        [
          { scale: a, terms: { x: 2, y: -1 } },
          { scale: -c, terms: { x: 1, y: b } },
          { scale: 1, terms: { x: d, y: e } },
        ],
        standardComplexity({ steps: 5, grouping: 2, pitfalls: 2 }),
      );
    }
    const a = 2 + (j % 7);
    const b = 2 + j;
    const c = 1 + (j % 6);
    const d = 1 + (j % 8);
    const e = 1 + (j % 5);
    return polynomialResult(
      '化简：(' + a + 'x+' + b + 'y)-(' + c + 'x-' + d + 'y)+(' + e + 'x-y)。',
      { x: a - c + e, y: b + d - 1 },
      [
        { scale: 1, terms: { x: a, y: b } },
        { scale: -1, terms: { x: c, y: -d } },
        { scale: 1, terms: { x: e, y: -1 } },
      ],
      standardComplexity({ steps: 5, grouping: 3, pitfalls: 3 }),
    );
  }

  if (family === 0) {
    const a = 2 + (j % 6);
    const b = 2 + j;
    const c = 1 + (j % 5);
    const d = 2 + (j % 7);
    const direct = { x: a * (2 - b) - d, y: a * (b + c) - d };
    return polynomialResult(
      '化简：' + a + '{2x-[' + b + '(x-y)-' + c + 'y]}-' + d + '(x+y)。',
      direct,
      [
        { scale: 2 * a, terms: { x: 1 } },
        { scale: -a * b, terms: { x: 1, y: -1 } },
        { scale: a * c, terms: { y: 1 } },
        { scale: -d, terms: { x: 1, y: 1 } },
      ],
      advancedComplexity({ steps: 8, grouping: 5, pitfalls: 4 }),
    );
  }
  if (family === 1) {
    const a = 2 + (j % 7);
    const b = 2 + j;
    const c = 1 + (j % 6);
    const d = 2 + (j % 5);
    const e = 1 + (j % 8);
    const g = 1 + (j % 4);
    const direct = { 'x²': a - c, x: -a * b - c * d + g, y: a * e - c * e - g };
    return polynomialResult(
      '化简：' + a + '(x²-' + b + 'x+' + e + 'y)-' + c + '[x²+(' + d + 'x+' + e + 'y)]+' + g + '(x-y)。',
      direct,
      [
        { scale: a, terms: { 'x²': 1, x: -b, y: e } },
        { scale: -c, terms: { 'x²': 1, x: d, y: e } },
        { scale: g, terms: { x: 1, y: -1 } },
      ],
      advancedComplexity({ steps: 8, grouping: 5, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const a = 2 + (j % 6);
    const b = 2 + j;
    const c = 1 + (j % 7);
    const d = 1 + (j % 8);
    const direct = { x: 2 * a - b - b * c, y: -a + b * c + d };
    return polynomialResult(
      '化简：' + a + '(2x-y)-{' + b + '[x+' + c + '(x-y)]-' + d + 'y}。',
      direct,
      [
        { scale: a, terms: { x: 2, y: -1 } },
        { scale: -b, terms: { x: 1 } },
        { scale: -b * c, terms: { x: 1, y: -1 } },
        { scale: d, terms: { y: 1 } },
      ],
      advancedComplexity({ steps: 8, grouping: 5, pitfalls: 4 }),
    );
  }
  const a = 2 + (j % 7);
  const b = 2 + j;
  const c = 1 + (j % 6);
  const d = 1 + (j % 5);
  const e = 1 + (j % 8);
  const direct = { 'x²': a - b + e, xy: a + b * c, 'y²': -b * d - e };
  return polynomialResult(
    '化简：' + a + '(x²+xy)-' + b + '[x²-(' + c + 'xy-' + d + 'y²)]+' + e + '(x²-y²)。',
    direct,
    [
      { scale: a, terms: { 'x²': 1, xy: 1 } },
      { scale: -b, terms: { 'x²': 1, xy: -c, 'y²': d } },
      { scale: e, terms: { 'x²': 1, 'y²': -1 } },
    ],
    advancedComplexity({ steps: 8, grouping: 5, pitfalls: 4 }),
  );
}

function polynomialEvaluate(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  const x = alternating(j, 1, 1, 6);
  const y = alternating(j, 2, 1, 6);
  if (difficulty === 3) {
    if (family === 0) {
      const a = 2 + j;
      const b = 1 + (j % 7);
      const c = 1 + (j % 6);
      const d = 1 + (j % 5);
      const direct = f(a * x + b * y - (c * x - d * y));
      return numericResult(
        '先化简再求值：' + a + 'x+' + b + 'y-(' + c + 'x-' + d + 'y)，其中 x=' + x + '，y=' + y + '。',
        direct,
        subNode(addNode(mulNode(valueNode(a), valueNode(x)), mulNode(valueNode(b), valueNode(y))), subNode(mulNode(valueNode(c), valueNode(x)), mulNode(valueNode(d), valueNode(y)))),
        standardComplexity({ steps: 5, grouping: 2, pitfalls: 2 }),
      );
    }
    if (family === 1) {
      const a = 2 + j;
      const b = 1 + (j % 7);
      const c = 1 + (j % 6);
      const d = 1 + (j % 5);
      const direct = f(a * x * x - b * x * y + c * y * y - (d * x * x - b * x * y));
      return numericResult(
        '先化简再求值：' + a + 'x²-' + b + 'xy+' + c + 'y²-(' + d + 'x²-' + b + 'xy)，其中 x=' + x + '，y=' + y + '。',
        direct,
        subNode(
          addNode(mulNode(valueNode(a), powNode(valueNode(x), 2)), negNode(mulNode(valueNode(b), valueNode(x), valueNode(y))), mulNode(valueNode(c), powNode(valueNode(y), 2))),
          addNode(mulNode(valueNode(d), powNode(valueNode(x), 2)), negNode(mulNode(valueNode(b), valueNode(x), valueNode(y)))),
        ),
        standardComplexity({ steps: 6, grouping: 2, pitfalls: 3 }),
      );
    }
    if (family === 2) {
      const a = 2 + j;
      const b = 1 + (j % 6);
      const c = 1 + (j % 7);
      const direct = f(a * (x - y) + b * (2 * x + y) - c * x);
      return numericResult(
        '先化简再求值：' + a + '(x-y)+' + b + '(2x+y)-' + c + 'x，其中 x=' + x + '，y=' + y + '。',
        direct,
        addNode(mulNode(valueNode(a), subNode(valueNode(x), valueNode(y))), mulNode(valueNode(b), addNode(mulNode(valueNode(2), valueNode(x)), valueNode(y))), negNode(mulNode(valueNode(c), valueNode(x)))),
        standardComplexity({ steps: 6, grouping: 2, pitfalls: 2 }),
      );
    }
    const a = 2 + j;
    const b = 1 + (j % 7);
    const c = 1 + (j % 6);
    const d = 1 + (j % 5);
    const e = 1 + (j % 8);
    const direct = f(a * x - b * y - (c * x + d * y) + e);
    return numericResult(
      '先化简再求值：(' + a + 'x-' + b + 'y)-(' + c + 'x+' + d + 'y)+' + e + '，其中 x=' + x + '，y=' + y + '。',
      direct,
      addNode(subNode(subNode(mulNode(valueNode(a), valueNode(x)), mulNode(valueNode(b), valueNode(y))), addNode(mulNode(valueNode(c), valueNode(x)), mulNode(valueNode(d), valueNode(y)))), valueNode(e)),
      standardComplexity({ steps: 6, grouping: 3, pitfalls: 3 }),
    );
  }

  if (family === 0) {
    const a = 2 + j;
    const b = 1 + (j % 6);
    const c = 1 + (j % 5);
    const d = 1 + (j % 7);
    const e = 1 + (j % 8);
    const direct = f(a * (x - (b * y - c * x)) - d * (x + y) + e);
    return numericResult(
      '先化简再求值：' + a + '[x-(' + b + 'y-' + c + 'x)]-' + d + '(x+y)+' + e + '，其中 x=' + x + '，y=' + y + '。',
      direct,
      addNode(mulNode(valueNode(a), subNode(valueNode(x), subNode(mulNode(valueNode(b), valueNode(y)), mulNode(valueNode(c), valueNode(x))))), negNode(mulNode(valueNode(d), addNode(valueNode(x), valueNode(y)))), valueNode(e)),
      advancedComplexity({ steps: 8, grouping: 5, pitfalls: 4 }),
    );
  }
  if (family === 1) {
    const a = 2 + j;
    const b = 1 + (j % 7);
    const c = 1 + (j % 6);
    const left = f(a).mul(f(x * x - y * y));
    const inner = f(x).mul(f(x - y)).sub(f(y).mul(f(x - y)));
    const direct = left.sub(f(b).mul(inner)).add(f(c * x * y));
    return numericResult(
      '先化简再求值：' + a + '(x²-y²)-' + b + '[x(x-y)-y(x-y)]+' + c + 'xy，其中 x=' + x + '，y=' + y + '。',
      direct,
      addNode(
        mulNode(valueNode(a), subNode(powNode(valueNode(x), 2), powNode(valueNode(y), 2))),
        negNode(mulNode(valueNode(b), subNode(mulNode(valueNode(x), subNode(valueNode(x), valueNode(y))), mulNode(valueNode(y), subNode(valueNode(x), valueNode(y)))))),
        mulNode(valueNode(c), valueNode(x), valueNode(y)),
      ),
      advancedComplexity({ steps: 9, grouping: 6, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const a = 2 + j;
    const b = 1 + (j % 7);
    const c = 1 + (j % 6);
    const d = 1 + (j % 5);
    const e = 1 + (j % 8);
    const direct = f(a * x - b * y, 2).sub(f(c * x + d * y, 3)).add(f(e));
    return numericResult(
      '先化简再求值：1/2(' + a + 'x-' + b + 'y)-1/3(' + c + 'x+' + d + 'y)+' + e + '，其中 x=' + x + '，y=' + y + '。',
      direct,
      addNode(
        mulNode(valueNode(f(1, 2)), subNode(mulNode(valueNode(a), valueNode(x)), mulNode(valueNode(b), valueNode(y)))),
        negNode(mulNode(valueNode(f(1, 3)), addNode(mulNode(valueNode(c), valueNode(x)), mulNode(valueNode(d), valueNode(y))))),
        valueNode(e),
      ),
      advancedComplexity({ steps: 8, grouping: 4, number_forms: 2, pitfalls: 4 }),
    );
  }
  const a = 2 + j;
  const b = 1 + (j % 7);
  const c = 1 + (j % 6);
  const d = 1 + (j % 5);
  const half = f(1, 2);
  const fifth = f(1, 5);
  const direct = half.mul(f(a * x - b * y)).sub(fifth.mul(f(c * x - d * y))).add(f(x - y).abs());
  return numericResult(
    '先化简再求值：0.5(' + a + 'x-' + b + 'y)-0.2(' + c + 'x-' + d + 'y)+|x-y|，其中 x=' + x + '，y=' + y + '。',
    direct,
    addNode(
      mulNode(valueNode(half), subNode(mulNode(valueNode(a), valueNode(x)), mulNode(valueNode(b), valueNode(y)))),
      negNode(mulNode(valueNode(fifth), subNode(mulNode(valueNode(c), valueNode(x)), mulNode(valueNode(d), valueNode(y))))),
      absNode(subNode(valueNode(x), valueNode(y))),
    ),
    advancedComplexity({ steps: 8, grouping: 4, number_forms: 2, pitfalls: 4 }),
  );
}

function linearEquation(index, difficulty) {
  const family = index % 4;
  const j = Math.floor(index / 4);
  const solution = anchored(j, family + 1, 2);
  if (difficulty === 3) {
    if (family === 0) {
      const a = 3 + (j % 7);
      const c = 1 + (j % 2);
      const b = alternating(j, 2, 2, 16);
      const d = (a - c) * solution + b;
      return equationResult(
        '解方程：' + formatAffine(a, b) + '=' + formatAffine(c, d) + '。',
        f(solution),
        { a, b },
        { a: c, b: d },
        standardComplexity({ steps: 4, grouping: 1, pitfalls: 2 }),
      );
    }
    if (family === 1) {
      const a = 2 + (j % 7);
      const b = alternating(j, 2, 2, 9);
      const c = alternating(j, 4, 1, 12);
      const d = 9 + (j % 3);
      const e = a * (solution + b) + c - d * solution;
      return equationResult(
        '解方程：' + a + '(x' + shift(b) + ')' + shift(c) + '=' + formatAffine(d, e) + '。',
        f(solution),
        { a, b: a * b + c },
        { a: d, b: e },
        standardComplexity({ steps: 5, grouping: 2, pitfalls: 2 }),
      );
    }
    if (family === 2) {
      const a = alternating(j, 1, 1, 8);
      const c = alternating(j, 3, 1, 7);
      const b = 2 + (j % 6);
      let d = 3 + (j % 7);
      if (d === b) d += 1;
      const rhs = f(solution + a, b).sub(f(solution - c, d));
      return equationResult(
        '解方程：(x' + shift(a) + ')/' + b + '-(x' + shift(-c) + ')/' + d + '=' + rhs + '。',
        f(solution),
        { a: f(1, b).sub(f(1, d)), b: f(a, b).add(f(c, d)) },
        { a: 0, b: rhs },
        standardComplexity({ steps: 5, grouping: 4, number_forms: 2, pitfalls: 3 }),
      );
    }
    const p = 1 + (j % 4);
    const q = 6 + (j % 4);
    const leftConstant = f(alternating(j, 2, 11, 38), 10);
    const rightConstant = f(p * solution, 10).add(leftConstant).sub(f(q * solution, 10));
    return equationResult(
      '解方程：0.' + p + 'x' + shift(decimalText(leftConstant)) + '=0.' + q + 'x' + shift(decimalText(rightConstant)) + '。',
      f(solution),
      { a: f(p, 10), b: leftConstant },
      { a: f(q, 10), b: rightConstant },
      standardComplexity({ steps: 5, grouping: 2, number_forms: 2, pitfalls: 3 }),
    );
  }

  if (family === 0) {
    const a = 2 + (j % 6);
    const b = 2 + j;
    const c = 1 + (j % 5);
    const d = 1 + (j % 7);
    const e = alternating(j, 5, 1, 8);
    const leftA = a * (2 + c) - d;
    const leftB = -a * b - d * e;
    let rightA = 1 + (j % 4);
    if (rightA === leftA) rightA += 5;
    const rightB = leftA * solution + leftB - rightA * solution;
    return equationResult(
      '解方程：' + a + '[2x-(' + b + '-' + c + 'x)]-' + d + '(x' + shift(e) + ')=' + formatAffine(rightA, rightB) + '。',
      f(solution),
      { a: leftA, b: leftB },
      { a: rightA, b: rightB },
      advancedComplexity({ steps: 8, grouping: 5, pitfalls: 4 }),
    );
  }
  if (family === 1) {
    const a = 2 + (j % 7);
    const b = alternating(j, 2, 2, 13);
    const c = 3 + (j % 6);
    const d = 1 + (j % 5);
    const e = alternating(j, 5, 2, 11);
    let g = 4 + (j % 7);
    if (a * g === d * c) g += 1;
    const rhs = f(a * solution + b, c).sub(f(d * solution - e, g));
    return equationResult(
      '解方程：(' + formatAffine(a, b) + ')/' + c + '-(' + formatAffine(d, -e) + ')/' + g + '=' + rhs + '。',
      f(solution),
      { a: f(a, c).sub(f(d, g)), b: f(b, c).add(f(e, g)) },
      { a: 0, b: rhs },
      advancedComplexity({ steps: 7, grouping: 6, number_forms: 2, pitfalls: 4 }),
    );
  }
  if (family === 2) {
    const a = 2 + (j % 6);
    const b = alternating(j, 2, 2, 9);
    const c = 1 + (j % 5);
    let d = 6 + (j % 4);
    if (d === a) d = 9;
    const leftA = f(a, 10);
    const leftB = f(a * b, 10).add(f(c));
    const rightA = f(d, 10);
    const rightB = leftA.mul(f(solution)).add(leftB).sub(rightA.mul(f(solution)));
    return equationResult(
      '解方程：0.' + a + '(x' + shift(b) + ')' + shift(c) + '=0.' + d + 'x' + shift(decimalText(rightB)) + '。',
      f(solution),
      { a: leftA, b: leftB },
      { a: rightA, b: rightB },
      advancedComplexity({ steps: 7, grouping: 3, number_forms: 2, pitfalls: 4 }),
    );
  }
  const a = 2 + (j % 5);
  const b = 2 + j;
  const c = 1 + (j % 4);
  const d = alternating(j, 5, 1, 7);
  const e = alternating(j, 6, 1, 9);
  let g = 1 + (j % 6);
  const leftA = a * (1 - b * (c + 1));
  const leftB = a * b * d + e;
  if (g === leftA) g += 7;
  const rightA = g;
  const rightB = leftA * solution + leftB - rightA * solution + rightA * g;
  return equationResult(
    '解方程：' + a + '{x-' + b + '[' + c + 'x-(' + d + '-x)]}' + shift(e) + '=' + g + '(x-' + g + ')' + shift(rightB) + '。',
    f(solution),
    { a: leftA, b: leftB },
    { a: rightA, b: rightB - rightA * g },
    advancedComplexity({ steps: 9, grouping: 6, pitfalls: 4 }),
  );
}

const TYPE_BUILDERS = [
  ['有理数加减', 'rational-add-sub', rationalAddSub],
  ['有理数乘除', 'rational-mul-div', rationalMulDiv],
  ['有理数混合', 'rational-mixed', rationalMixed],
  ['绝对值计算', 'absolute-value', absoluteValue],
  ['有理数巧算', 'rational-shortcut', rationalShortcut],
  ['整式化简', 'polynomial-simplify', polynomialSimplify],
  ['整式求值', 'polynomial-evaluate', polynomialEvaluate],
  ['一元一次方程', 'linear-equation', linearEquation],
];

function questionCore(item) {
  return {
    grade_band: item.grade_band,
    grade_code: item.grade_code,
    subject: item.subject,
    module: item.module,
    question_type: item.question_type,
    difficulty: item.difficulty,
    template_key: item.template_key,
    stem: item.stem,
    answer: item.answer,
    estimated_seconds: item.estimated_seconds,
    signature: item.signature,
    provenance: item.provenance,
  };
}

function questionContentDigest(item) {
  const { grade_code: _gradeCode, ...content } = questionCore(item);
  return digest(content);
}

function buildQuestions() {
  const rows = [];
  for (const [questionType, slug, builder] of TYPE_BUILDERS) {
    for (const difficulty of [3, 4]) {
      for (let index = 0; index < 200; index += 1) {
        const built = builder(index, difficulty);
        const family = (index % 4) + 1;
        const item = {
          grade_band: '初中',
          grade_code: 'g7',
          subject: '数学',
          module: '综合计算',
          question_type: questionType,
          difficulty,
          tier: difficulty === 3 ? 'standard' : 'advanced',
          template_key: 'g7calc-v4-' + slug + '-d' + difficulty + '-f' + family,
          stem: normalizeStem(built.stem),
          answer: String(built.answer),
          estimated_seconds: difficulty === 3 ? blueprint.standard_seconds : blueprint.advanced_seconds,
          signature: 'g7calc.v4.' + slug + '.d' + difficulty + '.' + String(index + 1).padStart(3, '0'),
          provenance: 'self_authored',
          complexity: built.complexity,
          verification: built.verification,
        };
        rows.push({ ...item, content_sha256: questionContentDigest(item) });
      }
    }
  }
  return rows;
}

function bigintGcd(a, b) {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) [x, y] = [y, x % y];
  return x || 1n;
}

class AuditFraction {
  constructor(numerator, denominator = 1n) {
    let n = BigInt(numerator);
    let d = BigInt(denominator);
    if (d === 0n) throw new Error('audit division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const divisor = bigintGcd(n, d);
    this.n = n / divisor;
    this.d = d / divisor;
  }

  add(other) { return new AuditFraction(this.n * other.d + other.n * this.d, this.d * other.d); }
  sub(other) { return new AuditFraction(this.n * other.d - other.n * this.d, this.d * other.d); }
  mul(other) { return new AuditFraction(this.n * other.n, this.d * other.d); }
  div(other) { return new AuditFraction(this.n * other.d, this.d * other.n); }
  pow(power) { return new AuditFraction(this.n ** BigInt(power), this.d ** BigInt(power)); }
  abs() { return new AuditFraction(this.n < 0n ? -this.n : this.n, this.d); }
  neg() { return new AuditFraction(-this.n, this.d); }
  toString() { return this.d === 1n ? String(this.n) : this.n + '/' + this.d; }
}

function auditNumeric(node) {
  if (!node || typeof node !== 'object') throw new Error('missing audit expression');
  if (node.op === 'value') return new AuditFraction(node.n, node.d);
  if (node.op === 'add') return node.args.reduce((sum, item) => sum.add(auditNumeric(item)), new AuditFraction(0n));
  if (node.op === 'sub') return auditNumeric(node.left).sub(auditNumeric(node.right));
  if (node.op === 'mul') return node.args.reduce((product, item) => product.mul(auditNumeric(item)), new AuditFraction(1n));
  if (node.op === 'div') return auditNumeric(node.left).div(auditNumeric(node.right));
  if (node.op === 'pow') return auditNumeric(node.base).pow(node.power);
  if (node.op === 'abs') return auditNumeric(node.value).abs();
  if (node.op === 'neg') return auditNumeric(node.value).neg();
  if (node.op === 'telescoping') {
    let sum = new AuditFraction(0n);
    for (let k = node.start; k <= node.end; k += 1) {
      sum = sum.add(new AuditFraction(1n, BigInt(k) * BigInt(k + 1)));
    }
    return sum;
  }
  throw new Error('unknown audit operation: ' + node.op);
}

function auditPolynomial(groups) {
  const coefficients = new Map();
  for (const group of groups || []) {
    const scale = BigInt(group.scale);
    for (const [term, coefficient] of Object.entries(group.terms || {})) {
      coefficients.set(term, (coefficients.get(term) || 0n) + scale * BigInt(coefficient));
    }
  }
  return coefficients;
}

function formatAuditPolynomial(coefficients) {
  const parts = [];
  for (const term of TERM_ORDER) {
    const coefficient = coefficients.get(term) || 0n;
    if (coefficient === 0n) continue;
    const magnitude = coefficient < 0n ? -coefficient : coefficient;
    const atom = term ? (magnitude === 1n ? term : magnitude + term) : String(magnitude);
    if (!parts.length) parts.push(coefficient < 0n ? '-' + atom : String(atom));
    else parts.push(coefficient < 0n ? '-' + atom : '+' + atom);
  }
  return parts.join('') || '0';
}

function auditAffine(value) {
  return {
    a: value.a instanceof Fraction ? new AuditFraction(value.a.n, value.a.d) : new AuditFraction(value.a || 0),
    b: value.b instanceof Fraction ? new AuditFraction(value.b.n, value.b.d) : new AuditFraction(value.b || 0),
  };
}

function expectedAnswer(question) {
  const verification = question.verification || {};
  if (verification.kind === 'numeric') return auditNumeric(verification.expression).toString();
  if (verification.kind === 'polynomial') return formatAuditPolynomial(auditPolynomial(verification.groups));
  if (verification.kind === 'equation') {
    const left = auditAffine(verification.left);
    const right = auditAffine(verification.right);
    return 'x=' + right.b.sub(left.b).div(left.a.sub(right.a)).toString();
  }
  throw new Error('unknown verification kind');
}

function verifyQuestion(question) {
  const errors = [];
  let expected = '';
  try {
    expected = expectedAnswer(question);
  } catch (error) {
    errors.push(error.message);
  }
  if (expected && expected !== question.answer) errors.push('答案应为 ' + expected + '，实际为 ' + question.answer);
  if (!['numeric', 'polynomial', 'equation'].includes(question.verification?.kind)) errors.push('缺少独立验算模型');
  if (question.difficulty === 3) {
    if (question.tier !== 'standard') errors.push('标准题层级错误');
    if (question.estimated_seconds !== 90) errors.push('标准题时间预算错误');
    if (Number(question.complexity?.steps) < 2) errors.push('标准题步骤不足');
  } else if (question.difficulty === 4) {
    if (question.tier !== 'advanced') errors.push('加强题层级错误');
    if (question.estimated_seconds !== 125) errors.push('加强题时间预算错误');
    if (Number(question.complexity?.steps) < 5) errors.push('加强题步骤不足');
    if (Number(question.complexity?.grouping) < 2) errors.push('加强题括号层级不足');
    if (Number(question.complexity?.pitfalls) < 2) errors.push('加强题易错点不足');
  } else {
    errors.push('难度必须为 3 或 4');
  }
  if (question.content_sha256 !== questionContentDigest(question)) errors.push('内容哈希不匹配');
  return { ok: errors.length === 0, expected, errors };
}

function auditQuestionBank(rows = questions) {
  const failures = [];
  const stems = new Set();
  const signatures = new Set();
  const byType = {};
  const byDifficulty = {};
  let standardSeconds = 0;
  let mixedSeconds = 0;

  rows.forEach((question, index) => {
    if (stems.has(question.stem)) failures.push('第 ' + (index + 1) + ' 题题干重复');
    stems.add(question.stem);
    if (signatures.has(question.signature)) failures.push('第 ' + (index + 1) + ' 题签名重复');
    signatures.add(question.signature);
    const result = verifyQuestion(question);
    if (!result.ok) failures.push(question.signature + ': ' + result.errors.join('；'));
    byType[question.question_type] = (byType[question.question_type] || 0) + 1;
    byDifficulty[question.difficulty] = (byDifficulty[question.difficulty] || 0) + 1;
  });

  standardSeconds = 12 * blueprint.standard_seconds;
  mixedSeconds = 6 * blueprint.standard_seconds + 6 * blueprint.advanced_seconds;
  if (rows.length !== blueprint.distribution.total) failures.push('总题量错误：' + rows.length);
  for (const [questionType] of TYPE_BUILDERS) {
    if (byType[questionType] !== blueprint.questions_per_type) {
      failures.push(questionType + ' 题量错误：' + (byType[questionType] || 0));
    }
  }

  return {
    ok: failures.length === 0,
    total: rows.length,
    unique_stems: stems.size,
    unique_signatures: signatures.size,
    by_type: byType,
    by_difficulty: byDifficulty,
    daily_seconds: { standard_12: standardSeconds, mixed_6_plus_6: mixedSeconds },
    failures,
  };
}

const questions = buildQuestions();
const initialAudit = auditQuestionBank(questions);
if (!initialAudit.ok) throw new Error('七年级计算题库 v4 审计失败：' + initialAudit.failures.slice(0, 10).join('；'));

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
  blueprint,
  questions,
  verifyQuestion,
  auditQuestionBank,
};
