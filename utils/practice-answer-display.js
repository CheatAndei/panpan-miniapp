function greatestCommonDivisor(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
}

export function formatTerminatingDecimalAnswer(value) {
  const match = String(value || '').match(/^\s*([a-zA-Z][a-zA-Z0-9_]*\s*=\s*)?([+\-−]?\d+)\s*\/\s*([+\-−]?\d+)\s*$/u);
  if (!match) return '';

  const prefix = String(match[1] || '').replace(/\s+/g, '');
  let numerator = Number(match[2].replace('−', '-'));
  let denominator = Number(match[3].replace('−', '-'));
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) return '';

  if (denominator < 0) {
    numerator *= -1;
    denominator *= -1;
  }
  const divisor = greatestCommonDivisor(numerator, denominator);
  numerator /= divisor;
  denominator /= divisor;

  let remaining = denominator;
  let twos = 0;
  let fives = 0;
  while (remaining % 2 === 0) { remaining /= 2; twos += 1; }
  while (remaining % 5 === 0) { remaining /= 5; fives += 1; }
  if (remaining !== 1) return '';

  const decimalPlaces = Math.max(twos, fives);
  const fixed = decimalPlaces ? (numerator / denominator).toFixed(decimalPlaces) : String(numerator);
  const decimal = fixed.includes('.') ? fixed.replace(/0+$/u, '').replace(/\.$/u, '') : fixed;
  return `${prefix}${decimal}`;
}
