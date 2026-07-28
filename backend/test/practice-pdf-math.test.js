const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../resources/practice/curricula/feng-haoyuan-2026-07-28-v1.json');
const adaptiveBank = require('../resources/practice/junior-calculation-v3');
const { loadPracticePdfItems } = require('../services/practice');
const {
  parseInlineFractions,
  normalizeStructuredBlocks,
  resolvePracticePdfBlocks,
  layoutPracticePdfBlocks,
  fitPracticePdfBlocks,
  drawPracticePdfBlocks,
} = require('../services/practice-pdf-math');

function plainText(blocks) {
  return blocks.map((block) => {
    if (block.type === 'fraction') return `${block.numerator}/${block.denominator}`;
    if (block.type === 'line_break') return '\n';
    return block.value || '';
  }).join('');
}

function visibleSlashText(blocks) {
  return blocks
    .filter((block) => block.type !== 'fraction')
    .map((block) => block.value || '')
    .join('');
}

function measureText(value, size) {
  return Array.from(String(value || '')).reduce((width, character) => (
    width + (/[\u0000-\u00ff]/.test(character) ? size * 0.58 : size)
  ), 0);
}

test('PDF 分式解析兼容普通、负数、字母和复杂分母', () => {
  const blocks = parseInlineFractions('计算：1/2+(−3/4)+a/b+1/(1×2)');
  assert.deepEqual(blocks.filter((block) => block.type === 'fraction'), [
    { type: 'fraction', numerator: '1', denominator: '2' },
    { type: 'fraction', numerator: '−3', denominator: '4' },
    { type: 'fraction', numerator: 'a', denominator: 'b' },
    { type: 'fraction', numerator: '1', denominator: '1×2' },
  ]);
  assert.equal(visibleSlashText(blocks), '计算：+()++');
  assert.deepEqual(parseInlineFractions('日期：2026-07-28'), [
    { type: 'text', value: '日期：2026-07-28' },
  ]);
});

test('专属题面优先使用 snapshot_payload.render，答案优先使用 answer_render', () => {
  const item = {
    snapshot_stem: '第1天第1题：这是不能打印的占位说明。',
    snapshot_answer: '3/4',
    snapshot_payload: JSON.stringify({
      render: {
        version: 1,
        blocks: [
          { type: 'text', value: '计算：' },
          { type: 'fraction', numerator: '1', denominator: '2' },
          { type: 'operator', value: '+' },
          { type: 'number', value: '1' },
        ],
      },
      answer_render: {
        version: 1,
        blocks: [{ type: 'fraction', numerator: '3', denominator: '4' }],
      },
    }),
  };
  const question = resolvePracticePdfBlocks(item, 'question');
  const answer = resolvePracticePdfBlocks(item, 'answer');
  assert.equal(plainText(question), '计算：1/2+1');
  assert.doesNotMatch(plainText(question), /占位说明/);
  assert.deepEqual(answer, [{ type: 'fraction', numerator: '3', denominator: '4' }]);
});

test('两条 PDF 导出链路的共享查询始终读取 snapshot_payload', () => {
  let capturedSql = '';
  let capturedParams = null;
  const expected = [{ position: 1, snapshot_payload: '{"render":{"version":1}}' }];
  const db = {
    all(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return expected;
    },
  };
  assert.equal(loadPracticePdfItems(db, 37), expected);
  assert.match(capturedSql, /snapshot_stem/);
  assert.match(capturedSql, /snapshot_answer/);
  assert.match(capturedSql, /snapshot_payload/);
  assert.deepEqual(capturedParams, [37]);
});

test('无结构快照的普通学生题目和答案也会把数学斜杠转成上下分式', () => {
  const item = {
    snapshot_stem: '计算：(22/9) - (3/2) + (-9/2)。',
    snapshot_answer: '-32/9',
    snapshot_payload: '{}',
  };
  const question = resolvePracticePdfBlocks(item, 'question');
  const answer = resolvePracticePdfBlocks(item, 'answer');
  assert.equal(question.filter((block) => block.type === 'fraction').length, 3);
  assert.equal(answer.filter((block) => block.type === 'fraction').length, 1);
  assert.equal(visibleSlashText(question), '计算：() - () + ()。');
  assert.equal(visibleSlashText(answer), '');
});

test('冯浩源 220 道专属题 PDF 语义与 manifest render 完全一致', () => {
  let questionCount = 0;
  let fractionAnswerCount = 0;
  for (const day of manifest.days) {
    for (const question of day.questions) {
      questionCount += 1;
      const item = {
        snapshot_stem: question.stem,
        snapshot_answer: question.answer,
        snapshot_payload: JSON.stringify({
          render: question.render || null,
          answer_render: question.answer_render || null,
          source_page: day.source_page,
          question_type_key: day.question_type_key,
        }),
      };
      assert.deepEqual(
        resolvePracticePdfBlocks(item, 'question'),
        normalizeStructuredBlocks(question.render.blocks),
        `${day.date} 第 ${question.position || questionCount} 题`,
      );
      assert.doesNotMatch(visibleSlashText(resolvePracticePdfBlocks(item, 'question')), /\//);
      if (question.answer_render) {
        fractionAnswerCount += 1;
        assert.deepEqual(
          resolvePracticePdfBlocks(item, 'answer'),
          normalizeStructuredBlocks(question.answer_render.blocks),
        );
        assert.doesNotMatch(visibleSlashText(resolvePracticePdfBlocks(item, 'answer')), /\//);
      }
    }
  }
  assert.equal(questionCount, 220);
  assert.equal(fractionAnswerCount, 68);
});

test('普通自适应题库所有数学斜杠在 PDF resolver 中都有分式语义', () => {
  let slashQuestionCount = 0;
  for (const question of adaptiveBank.questions) {
    const item = {
      snapshot_stem: question.stem,
      snapshot_answer: question.answer,
      snapshot_payload: '{}',
    };
    for (const kind of ['question', 'answer']) {
      const source = kind === 'question' ? question.stem : String(question.answer);
      if (!source.includes('/')) continue;
      slashQuestionCount += 1;
      const blocks = resolvePracticePdfBlocks(item, kind);
      assert.ok(blocks.some((block) => block.type === 'fraction'), `${question.signature} ${kind}`);
      assert.doesNotMatch(visibleSlashText(blocks), /\//, `${question.signature} ${kind}`);
    }
    const compactQuestion = fitPracticePdfBlocks(resolvePracticePdfBlocks(item, 'question'), {
      x: 0,
      y: 0,
      width: 243,
      fontSize: 10.2,
      minFontSize: 7.2,
      maxHeight: 566 / 12 - 8,
      lineGap: 2,
      prefix: '24. ',
      measureText,
    });
    assert.ok(compactQuestion.height <= 566 / 12 - 8, `${question.signature} compact question`);
    const compactAnswer = fitPracticePdfBlocks(resolvePracticePdfBlocks(item, 'answer'), {
      x: 0,
      y: 0,
      width: (511 - 20 - 4 * 4) / 5,
      fontSize: 8.8,
      minFontSize: 6.8,
      maxHeight: 29,
      lineGap: 1,
      prefix: '24. ',
      measureText,
    });
    assert.ok(compactAnswer.height <= 29, `${question.signature} compact answer`);
  }
  assert.ok(slashQuestionCount >= 276);
});

test('布局尊重显式换行、列宽和最大高度', () => {
  const blocks = [
    { type: 'text', value: '化简：7(xy−x²y)−(8xy−8x²y)' },
    { type: 'line_break' },
    { type: 'text', value: '其中x=−1，y=' },
    { type: 'fraction', numerator: '3', denominator: '4' },
  ];
  const layout = fitPracticePdfBlocks(blocks, {
    x: 42,
    y: 188,
    width: 243,
    fontSize: 10.2,
    minFontSize: 7.2,
    maxHeight: 76,
    lineGap: 2,
    prefix: '5. ',
    measureText,
  });
  assert.ok(layout.lines.length >= 2);
  assert.ok(layout.height <= 76);
  for (const token of layout.tokens) {
    assert.ok(token.x >= 42);
    assert.ok(token.x + token.width <= 42 + 243 + 0.001);
    assert.ok(token.y >= 188);
    assert.ok(token.y + token.height <= 188 + layout.height + 0.001);
  }
});

test('PDFKit 绘制坐标保证分子在分数线上方、分母在下方', () => {
  class FakeDoc {
    constructor() {
      this.size = 10;
      this.events = [];
      this.start = null;
    }
    font() { return this; }
    fontSize(value) { this.size = value; return this; }
    fillColor() { return this; }
    widthOfString(value) { return Array.from(String(value)).length * this.size * 0.58; }
    text(value, x, y) { this.events.push({ type: 'text', value, x, y }); return this; }
    moveTo(x, y) { this.start = { x, y }; return this; }
    lineTo(x, y) { this.events.push({ type: 'line', from: this.start, to: { x, y } }); return this; }
    lineWidth() { return this; }
    strokeColor() { return this; }
    stroke() { return this; }
  }
  const doc = new FakeDoc();
  const layout = drawPracticePdfBlocks(doc, [
    { type: 'text', value: '答案：' },
    { type: 'fraction', numerator: '3', denominator: '4' },
  ], {
    x: 0,
    y: 0,
    width: 100,
    fontSize: 10,
    minFontSize: 10,
    color: '#000',
    fontForCharacter: () => 'fake-font',
  });
  const numerator = doc.events.find((event) => event.type === 'text' && event.value === '3');
  const denominator = doc.events.find((event) => event.type === 'text' && event.value === '4');
  const bar = doc.events.find((event) => event.type === 'line');
  assert.ok(numerator.y < bar.from.y);
  assert.ok(bar.from.y < denominator.y);
  assert.ok(bar.to.x > bar.from.x);
  assert.ok(layout.height > 10);
});

test('专属题库双栏题面与五列答案的布局均不会越出单元格', () => {
  const questionWidth = 243;
  const questionHeight = 97;
  const answerWidth = (511 - 20 - 4 * 4) / 5;
  for (const day of manifest.days) {
    for (const question of day.questions) {
      const questionLayout = fitPracticePdfBlocks(normalizeStructuredBlocks(question.render.blocks), {
        x: 0,
        y: 0,
        width: questionWidth,
        fontSize: 10.2,
        minFontSize: 7.2,
        maxHeight: questionHeight,
        lineGap: 2,
        prefix: '10. ',
        measureText,
      });
      assert.ok(questionLayout.height <= questionHeight, `${day.date} ${question.signature}`);
      if (!question.answer_render) continue;
      const answerLayout = fitPracticePdfBlocks(normalizeStructuredBlocks(question.answer_render.blocks), {
        x: 0,
        y: 0,
        width: answerWidth,
        fontSize: 8.8,
        minFontSize: 6.8,
        maxHeight: 29,
        lineGap: 1,
        prefix: '10. ',
        measureText,
      });
      assert.ok(answerLayout.height <= 29, `${day.date} ${question.signature} answer`);
    }
  }
});
