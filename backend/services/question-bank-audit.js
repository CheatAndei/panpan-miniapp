const { QUESTION_BANK } = require('../resources/mental-arena/questions');
const guangzhou = require('../resources/practice/guangzhou-original-v1');
const juniorV2 = require('../resources/practice/junior1-math-v2');
const juniorCalculationV3 = require('../resources/practice/junior-calculation-v3');
const { hasMalformedSignedOperators } = require('../utils/math-expression');

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
      if (!hasMalformedSignedOperators(question.stem)) return;
      failures.push({
        source,
        id: question.id || question.signature || index + 1,
        type: question.type || question.question_type || '',
        stem: question.stem,
      });
    });
  }
  return { total, failures };
}

function assertCalculationQuestionBanks() {
  const audit = auditCalculationQuestionBanks();
  if (audit.failures.length) {
    const samples = audit.failures.slice(0, 20)
      .map((item) => `${item.source}/${item.id}/${item.type}: ${item.stem}`).join('\n');
    throw new Error(`计算题题干审计失败：${audit.failures.length}/${audit.total}\n${samples}`);
  }
  return audit;
}

module.exports = {
  calculationQuestionSets,
  auditCalculationQuestionBanks,
  assertCalculationQuestionBanks,
};
