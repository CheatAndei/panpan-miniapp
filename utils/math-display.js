const FRACTION_ATOM = String.raw`(?:\([^()/]+\)|[−-]?(?:\d+(?:\.\d+)?(?:[A-Za-z][A-Za-z0-9²³⁴⁵⁶⁷⁸⁹]*)?|[A-Za-z][A-Za-z0-9²³⁴⁵⁶⁷⁸⁹]*))`;
const FRACTION_SOURCE = `(${FRACTION_ATOM})\\s*\\/\\s*(${FRACTION_ATOM})`;

function unwrapAtom(value) {
  const text = String(value || '');
  return text.startsWith('(') && text.endsWith(')') ? text.slice(1, -1) : text;
}

function binaryLeadingSign(source, start, numerator) {
  if (!/^[−-]/.test(numerator) || start === 0) return false;
  const previousMatch = source.slice(0, start).match(/\S$/);
  const previous = previousMatch ? previousMatch[0] : '';
  return /[0-9A-Za-z)²³⁴⁵⁶⁷⁸⁹]/.test(previous);
}

export function parseMathSegments(value) {
  const source = String(value ?? '');
  const matcher = new RegExp(FRACTION_SOURCE, 'g');
  const segments = [];
  let cursor = 0;
  let match;

  while ((match = matcher.exec(source))) {
    let start = match.index;
    let numerator = match[1];
    if (binaryLeadingSign(source, start, numerator)) {
      start += 1;
      numerator = numerator.slice(1);
    }
    if (start < cursor || !numerator) continue;
    if (start > cursor) segments.push({ type: 'text', value: source.slice(cursor, start) });
    const normalizedNumerator = unwrapAtom(numerator);
    const normalizedDenominator = unwrapAtom(match[2]);
    segments.push({
      type: 'fraction',
      numerator: normalizedNumerator,
      denominator: normalizedDenominator,
      label: `${normalizedDenominator} 分之 ${normalizedNumerator}`,
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) segments.push({ type: 'text', value: source.slice(cursor) });
  return segments.length ? segments : [{ type: 'text', value: source }];
}
