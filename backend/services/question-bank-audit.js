const { QUESTION_BANK } = require('../resources/mental-arena/questions');
const guangzhou = require('../resources/practice/guangzhou-original-v1');
const juniorV2 = require('../resources/practice/junior1-math-v2');
const juniorCalculationV3 = require('../resources/practice/junior-calculation-v3');
const { hasMalformedSignedOperators } = require('../utils/math-expression');

function distributiveLinearEquationAnswerMatches(question) {
  const match = String(question.stem || '')
    .match(/^解方程：(\d+)\(x([+-]\d+)\)([+-]\d+)=((?:\d+)?x)([+-]\d+)?。$/u);
  if (!match) return true;
  const answer = String(question.answer || '').match(/^x=(-?\d+)(?:\/(\d+))?$/u);
  if (!answer || Number(answer[2] || 1) === 0) return false;
  const [, aText, bText, cText, xTerm, constantText = '0'] = match;
  const x = Number(answer[1]) / Number(answer[2] || 1);
  const d = xTerm === 'x' ? 1 : Number(xTerm.replace('x', ''));
  const left = Number(aText) * (x + Number(bText)) + Number(cText);
  const right = d * x + Number(constantText);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-10;
}

function calculationQuestionSets() {
  return [
    ['mental-primary', QUESTION_BANK.primary],
    ['mental-junior', QUESTION_BANK.junior],
    ['practice-guangzhou-v1', guangzhou.questions],
    ['practice-junior-v2', juniorV2.questions],
    ['practice-junior-calculation-v3', juniorCalculationV3.questions],
  ];
}

function auditCalculationQuestionBanks() {
  const failures = [];
  let total = 0;
  for (const [source, questions] of calculationQuestionSets()) {
    total += questions.length;
    questions.forEach((question, index) => {
      const base = {
        source,
        id: question.id || question.signature || index + 1,
        type: question.type || question.question_type || '',
        stem: question.stem,
      };
      if (hasMalformedSignedOperators(question.stem)) {
        failures.push({ ...base, reason: 'malformed_signed_operators' });
      }
      if (!distributiveLinearEquationAnswerMatches(question)) {
        failures.push({ ...base, reason: 'answer_does_not_satisfy_equation', answer: question.answer });
      }
    });
  }
  return { total, failures };
}

function assertCalculationQuestionBanks() {
  const audit = auditCalculationQuestionBanks();
  if (audit.failures.length) {
    const samples = audit.failures.slice(0, 20)
      .map((item) => `${item.source}/${item.id}/${item.type}/${item.reason}: ${item.stem}`).join('\n');
    throw new Error(`计算题题干审计失败：${audit.failures.length}/${audit.total}\n${samples}`);
  }
  return audit;
}

module.exports = {
  calculationQuestionSets,
  distributiveLinearEquationAnswerMatches,
  auditCalculationQuestionBanks,
  assertCalculationQuestionBanks,
};
