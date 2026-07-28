const FRACTION_ATOM = String.raw`(?:\([^()/]+\)|[−-]?(?:\d+(?:\.\d+)?(?:[A-Za-z][A-Za-z0-9²³⁴⁵⁶⁷⁸⁹]*)?|[A-Za-z][A-Za-z0-9²³⁴⁵⁶⁷⁸⁹]*))`;
const FRACTION_SOURCE = `(${FRACTION_ATOM})\\s*\\/\\s*(${FRACTION_ATOM})`;
const INLINE_BLOCK_TYPES = new Set(['text', 'number', 'operator']);

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

function parseInlineFractions(value) {
  const source = String(value ?? '');
  const matcher = new RegExp(FRACTION_SOURCE, 'g');
  const blocks = [];
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
    if (start > cursor) blocks.push({ type: 'text', value: source.slice(cursor, start) });
    blocks.push({
      type: 'fraction',
      numerator: unwrapAtom(numerator),
      denominator: unwrapAtom(match[2]),
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) blocks.push({ type: 'text', value: source.slice(cursor) });
  return blocks.length ? blocks : [{ type: 'text', value: source }];
}

function parseSnapshotPayload(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeStructuredBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return [];
  const normalized = [];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'fraction') {
      const numerator = String(block.numerator ?? '');
      const denominator = String(block.denominator ?? '');
      if (numerator && denominator) normalized.push({ type: 'fraction', numerator, denominator });
      continue;
    }
    if (block.type === 'line_break') {
      normalized.push({ type: 'line_break' });
      continue;
    }
    if (!INLINE_BLOCK_TYPES.has(block.type)) continue;
    const value = String(block.value ?? '');
    if (!value) continue;
    if (block.type === 'operator' && value.trim() === '/') {
      normalized.push({ type: 'operator', value: '÷' });
      continue;
    }
    for (const parsed of parseInlineFractions(value)) {
      normalized.push(parsed.type === 'text' ? { type: block.type, value: parsed.value } : parsed);
    }
  }
  return normalized;
}

function resolvePracticePdfBlocks(item, kind = 'question') {
  const payload = parseSnapshotPayload(item?.snapshot_payload);
  const render = kind === 'answer' ? payload.answer_render : payload.render;
  const structured = normalizeStructuredBlocks(render?.blocks);
  if (structured.length) return structured;
  const fallback = kind === 'answer' ? item?.snapshot_answer : item?.snapshot_stem;
  return parseInlineFractions(fallback);
}

function textTokens(value, measureText, fontSize) {
  return Array.from(String(value ?? '')).flatMap((character) => {
    if (character === '\n') return [{ type: 'line_break' }];
    return [{
      type: 'text',
      value: character,
      width: measureText(character, fontSize),
      height: fontSize * 1.28,
      fontSize,
    }];
  });
}

function mathTokens(blocks, options) {
  const {
    fontSize,
    measureText,
    fractionScale = 0.72,
    fractionPadding = 2.4,
  } = options;
  const tokens = [];
  for (const block of blocks || []) {
    if (block?.type === 'line_break') {
      tokens.push({ type: 'line_break' });
      continue;
    }
    if (block?.type === 'fraction') {
      const numerator = String(block.numerator ?? '');
      const denominator = String(block.denominator ?? '');
      if (!numerator || !denominator) continue;
      const smallSize = Math.max(5.6, fontSize * fractionScale);
      const textHeight = smallSize * 1.16;
      const width = Math.max(
        measureText(numerator, smallSize),
        measureText(denominator, smallSize),
      ) + fractionPadding * 2;
      tokens.push({
        type: 'fraction',
        numerator,
        denominator,
        width,
        height: textHeight * 2 + 4,
        fontSize: smallSize,
        textHeight,
        fractionPadding,
      });
      continue;
    }
    if (INLINE_BLOCK_TYPES.has(block?.type)) {
      tokens.push(...textTokens(block.value, measureText, fontSize));
    }
  }
  return tokens;
}

function layoutPracticePdfBlocks(blocks, options) {
  const {
    x = 0,
    y = 0,
    width,
    fontSize = 10,
    lineGap = 2,
    prefix = '',
    measureText,
  } = options;
  if (!(width > 0)) throw new Error('PDF math layout width must be positive');
  if (typeof measureText !== 'function') throw new Error('PDF math layout requires measureText');

  const content = mathTokens(blocks, { ...options, fontSize, measureText });
  const tokens = prefix
    ? [{
      type: 'text',
      value: String(prefix),
      width: measureText(String(prefix), fontSize),
      height: fontSize * 1.28,
      fontSize,
      atomic: true,
    }, ...content]
    : content;
  const lines = [];
  let current = [];
  let currentWidth = 0;

  const finishLine = (force = false) => {
    if (current.length || force) lines.push({ tokens: current, width: currentWidth });
    current = [];
    currentWidth = 0;
  };

  for (const token of tokens) {
    if (token.type === 'line_break') {
      finishLine(true);
      continue;
    }
    if (current.length && currentWidth + token.width > width) finishLine();
    current.push(token);
    currentWidth += token.width;
  }
  finishLine(lines.length === 0);

  let cursorY = y;
  const placed = [];
  lines.forEach((line, lineIndex) => {
    const lineHeight = Math.max(fontSize * 1.28, ...line.tokens.map((token) => token.height || 0));
    let cursorX = x;
    for (const token of line.tokens) {
      placed.push({
        ...token,
        x: cursorX,
        y: cursorY + (lineHeight - token.height) / 2,
        line: lineIndex,
      });
      cursorX += token.width;
    }
    line.height = lineHeight;
    line.y = cursorY;
    cursorY += lineHeight + (lineIndex < lines.length - 1 ? lineGap : 0);
  });

  return {
    x,
    y,
    width,
    height: Math.max(fontSize * 1.28, cursorY - y),
    fontSize,
    lineGap,
    lines,
    tokens: placed,
  };
}

function fitPracticePdfBlocks(blocks, options) {
  const requestedSize = Number(options.fontSize || 10);
  const minimumSize = Math.min(requestedSize, Number(options.minFontSize || requestedSize));
  const maxHeight = Number(options.maxHeight || 0);
  let fontSize = requestedSize;
  let layout = layoutPracticePdfBlocks(blocks, { ...options, fontSize });
  while (maxHeight > 0 && layout.height > maxHeight && fontSize > minimumSize) {
    fontSize = Math.max(minimumSize, fontSize - 0.4);
    layout = layoutPracticePdfBlocks(blocks, { ...options, fontSize });
  }
  return layout;
}

function fontRuns(value, fontForCharacter) {
  const runs = [];
  for (const character of Array.from(String(value ?? ''))) {
    const font = fontForCharacter(character);
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text += character;
    else runs.push({ font, text: character });
  }
  return runs;
}

function measurePdfText(doc, value, fontSize, fontForCharacter) {
  return fontRuns(value, fontForCharacter).reduce((width, run) => {
    doc.font(run.font).fontSize(fontSize);
    return width + doc.widthOfString(run.text);
  }, 0);
}

function drawPdfTextAt(doc, value, x, y, fontSize, color, fontForCharacter, width = null, align = 'left') {
  const runs = fontRuns(value, fontForCharacter);
  let cursorX = x;
  if (width !== null && align !== 'left') {
    const measured = measurePdfText(doc, value, fontSize, fontForCharacter);
    if (align === 'center') cursorX += Math.max(0, (width - measured) / 2);
    else if (align === 'right') cursorX += Math.max(0, width - measured);
  }
  for (const run of runs) {
    doc.font(run.font).fontSize(fontSize).fillColor(color)
      .text(run.text, cursorX, y, { lineBreak: false });
    cursorX += doc.widthOfString(run.text);
  }
}

function drawPracticePdfBlocks(doc, blocks, options) {
  const fontForCharacter = options.fontForCharacter;
  if (typeof fontForCharacter !== 'function') throw new Error('PDF math drawing requires fontForCharacter');
  const color = options.color || '#183A36';
  const measureText = (value, size) => measurePdfText(doc, value, size, fontForCharacter);
  const layout = fitPracticePdfBlocks(blocks, { ...options, measureText });

  for (const token of layout.tokens) {
    if (token.type === 'text') {
      drawPdfTextAt(doc, token.value, token.x, token.y, token.fontSize, color, fontForCharacter);
      continue;
    }
    const numeratorY = token.y;
    const barY = numeratorY + token.textHeight + 0.7;
    const denominatorY = barY + 2;
    drawPdfTextAt(
      doc,
      token.numerator,
      token.x,
      numeratorY,
      token.fontSize,
      color,
      fontForCharacter,
      token.width,
      'center',
    );
    doc.moveTo(token.x + 0.6, barY)
      .lineTo(token.x + token.width - 0.6, barY)
      .lineWidth(Math.max(0.55, token.fontSize * 0.075))
      .strokeColor(color)
      .stroke();
    drawPdfTextAt(
      doc,
      token.denominator,
      token.x,
      denominatorY,
      token.fontSize,
      color,
      fontForCharacter,
      token.width,
      'center',
    );
  }
  return layout;
}

module.exports = {
  parseInlineFractions,
  parseSnapshotPayload,
  normalizeStructuredBlocks,
  resolvePracticePdfBlocks,
  layoutPracticePdfBlocks,
  fitPracticePdfBlocks,
  drawPracticePdfBlocks,
};
