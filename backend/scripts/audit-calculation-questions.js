const { assertCalculationQuestionBanks } = require('../services/question-bank-audit');

const result = assertCalculationQuestionBanks();
console.log(`计算题题干审计通过：${result.total} 道`);
