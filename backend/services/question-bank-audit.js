const { QUESTION_BANK } = require('../resources/mental-arena/questions');
const guangzhou = require('../resources/practice/guangzhou-original-v1');
const juniorV2 = require('../resources/practice/junior1-math-v2');
const g7CalculationV4 = require('../resources/practice/g7-calculation-v4');
const g8CalculationV2 = require('../resources/practice/g8-calculation-v2');
const { hasMalformedSignedOperators } = require('../utils/math-expression');

const ADAPTIVE_BANK_SPECS = Object.freeze([
  Object.freeze({
    source: 'practice-g7-calculation-v4',
    gradeCode: 'g7',
    dataset: g7CalculationV4,
    expectedTotal: 3200,
    expectedTypeCount: 8,
    expectedPerTypeAndDifficulty: 200,
    expectedByDifficulty: Object.freeze({ 3: 1600, 4: 1600 }),
  }),
  Object.freeze({
    source: 'practice-g8-calculation-v2',
    gradeCode: 'g8',
    dataset: g8CalculationV2,
    expectedTotal: 1600,
    expectedTypeCount: 4,
    expectedPerTypeAndDifficulty: 200,
    expectedByDifficulty: Object.freeze({ 3: 800, 4: 800 }),
  }),
]);

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
    ...ADAPTIVE_BANK_SPECS.map((spec) => [spec.source, spec.dataset.questions]),
  ];
}

function auditAdaptiveBank(spec) {
  const failures = [];
  const questions = Array.isArray(spec.dataset?.questions) ? spec.dataset.questions : [];
  const signatures = new Set();
  const stems = new Set();
  const stemsByDifficulty = { 3: new Set(), 4: new Set() };
  const byDifficulty = { 3: 0, 4: 0 };
  const byTypeAndDifficulty = new Map();

  if (typeof spec.dataset?.verifyQuestion !== 'function') {
    failures.push({ source: spec.source, id: 'dataset', reason: 'missing_independent_verifier' });
  }
  if (typeof spec.dataset?.auditQuestionBank !== 'function') {
    failures.push({ source: spec.source, id: 'dataset', reason: 'missing_bank_auditor' });
  } else {
    try {
      const moduleAudit = spec.dataset.auditQuestionBank(questions);
      if (!moduleAudit?.ok) {
        const details = moduleAudit?.failures || moduleAudit?.errors || ['unknown_module_audit_failure'];
        details.slice(0, 20).forEach((detail) => {
          failures.push({ source: spec.source, id: 'dataset', reason: 'module_audit_failed', detail });
        });
      }
    } catch (error) {
      failures.push({ source: spec.source, id: 'dataset', reason: 'module_audit_threw', detail: error.message });
    }
  }

  questions.forEach((question, index) => {
    const id = question.signature || index + 1;
    const base = { source: spec.source, id, type: question.question_type || '', stem: question.stem };
    const difficulty = Number(question.difficulty);
    if (signatures.has(question.signature)) failures.push({ ...base, reason: 'duplicate_signature' });
    signatures.add(question.signature);
    if (stems.has(question.stem)) failures.push({ ...base, reason: 'duplicate_stem' });
    stems.add(question.stem);
    if (![3, 4].includes(difficulty)) {
      failures.push({ ...base, reason: 'unexpected_difficulty', difficulty });
    } else {
      byDifficulty[difficulty] += 1;
      stemsByDifficulty[difficulty].add(question.stem);
      const key = `${question.question_type}\u0000${difficulty}`;
      byTypeAndDifficulty.set(key, (byTypeAndDifficulty.get(key) || 0) + 1);
    }
    if (question.grade_code !== spec.gradeCode) {
      failures.push({ ...base, reason: 'wrong_grade', grade_code: question.grade_code });
    }
    if (typeof spec.dataset?.verifyQuestion === 'function') {
      try {
        const verification = spec.dataset.verifyQuestion(question);
        if (!verification?.ok) {
          failures.push({
            ...base,
            reason: 'independent_answer_verification_failed',
            detail: verification?.reason || verification?.errors || 'unknown_verification_failure',
          });
        }
      } catch (error) {
        failures.push({ ...base, reason: 'independent_answer_verifier_threw', detail: error.message });
      }
    }
  });

  if (questions.length !== spec.expectedTotal) {
    failures.push({ source: spec.source, id: 'dataset', reason: 'wrong_total', actual: questions.length, expected: spec.expectedTotal });
  }
  for (const difficulty of [3, 4]) {
    if (byDifficulty[difficulty] !== spec.expectedByDifficulty[difficulty]) {
      failures.push({
        source: spec.source,
        id: 'dataset',
        reason: 'wrong_difficulty_count',
        difficulty,
        actual: byDifficulty[difficulty],
        expected: spec.expectedByDifficulty[difficulty],
      });
    }
  }
  const questionTypes = [...new Set(questions.map((question) => question.question_type))];
  if (questionTypes.length !== spec.expectedTypeCount) {
    failures.push({
      source: spec.source,
      id: 'dataset',
      reason: 'wrong_question_type_count',
      actual: questionTypes.length,
      expected: spec.expectedTypeCount,
    });
  }
  for (const questionType of questionTypes) {
    for (const difficulty of [3, 4]) {
      const actual = byTypeAndDifficulty.get(`${questionType}\u0000${difficulty}`) || 0;
      if (actual !== spec.expectedPerTypeAndDifficulty) {
        failures.push({
          source: spec.source,
          id: questionType,
          reason: 'wrong_type_difficulty_count',
          difficulty,
          actual,
          expected: spec.expectedPerTypeAndDifficulty,
        });
      }
    }
  }
  for (const stem of stemsByDifficulty[3]) {
    if (stemsByDifficulty[4].has(stem)) {
      failures.push({ source: spec.source, id: 'dataset', reason: 'cross_difficulty_duplicate_stem', stem });
    }
  }

  return {
    source: spec.source,
    grade_code: spec.gradeCode,
    total: questions.length,
    unique_stems: stems.size,
    unique_signatures: signatures.size,
    by_difficulty: byDifficulty,
    question_type_count: questionTypes.length,
    failures,
  };
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
  const banks = ADAPTIVE_BANK_SPECS.map(auditAdaptiveBank);
  banks.forEach((bank) => failures.push(...bank.failures));
  return { total, banks, failures };
}

function assertCalculationQuestionBanks() {
  const audit = auditCalculationQuestionBanks();
  if (audit.failures.length) {
    const samples = audit.failures.slice(0, 20)
      .map((item) => `${item.source}/${item.id}/${item.type || ''}/${item.reason}: ${item.detail || item.stem || ''}`).join('\n');
    throw new Error(`计算题题库审计失败：${audit.failures.length}/${audit.total}\n${samples}`);
  }
  return audit;
}

module.exports = {
  ADAPTIVE_BANK_SPECS,
  calculationQuestionSets,
  distributiveLinearEquationAnswerMatches,
  auditAdaptiveBank,
  auditCalculationQuestionBanks,
  assertCalculationQuestionBanks,
};
