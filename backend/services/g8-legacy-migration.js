const dataset = require('../resources/knowledge/g8-math-v1');
const { topicKeys } = require('../resources/g8-content/topics');
const { replaceQuestionTopics } = require('./content-progress');
const { sanitizeChoiceExplanation } = require('../utils/choice-explanation');

const SOURCE_LABEL = '八上旧知识点闯关·原创题（已审计迁移）';
const TOPIC_MAPPINGS = Object.freeze({
  triangles: topicKeys[1],
  congruence: topicKeys[2],
  axis_symmetry: topicKeys[4],
  polynomial_mul: topicKeys[7],
  factorization: topicKeys[7],
});
const AUXILIARY_LINE_MAPPINGS = Object.freeze([
  topicKeys[5],
  topicKeys[2],
  topicKeys[3],
  topicKeys[8],
  topicKeys[9],
  topicKeys[4],
  topicKeys[9],
  topicKeys[9],
]);

function mappedTopicKey(item, indexWithinTopic) {
  if (item.topic_key === 'auxiliary_lines') return AUXILIARY_LINE_MAPPINGS[indexWithinTopic] || '';
  return TOPIC_MAPPINGS[item.topic_key] || '';
}

function migrateLegacyKnowledgeQuestions(db) {
  const topicPositions = new Map();
  let imported = 0;
  let excluded = 0;
  db.transaction(() => {
    for (const item of dataset.questions) {
      const position = topicPositions.get(item.topic_key) || 0;
      topicPositions.set(item.topic_key, position + 1);
      const topicKey = mappedTopicKey(item, position);
      if (!topicKey) {
        excluded += 1;
        continue;
      }
      const stableCode = `GZ8-LEGACY-${item.stable_code}`;
      db.run(`INSERT INTO choice_king_questions
        (stable_code,stem,options_json,correct_option,explanation,source_label,
          grade_code,subject_code,topic_key,difficulty,is_active)
        VALUES(?,?,?,?,?,?,'g8','math',?,?,1)
        ON CONFLICT(stable_code) DO UPDATE SET
          stem=excluded.stem,options_json=excluded.options_json,
          correct_option=excluded.correct_option,explanation=excluded.explanation,
          source_label=excluded.source_label,grade_code='g8',subject_code='math',
          topic_key=excluded.topic_key,difficulty=excluded.difficulty,
          is_active=1,updated_at=CURRENT_TIMESTAMP`, [
        stableCode,
        item.stem,
        JSON.stringify(item.options),
        item.correct_option,
        sanitizeChoiceExplanation(item.explanation),
        SOURCE_LABEL,
        topicKey,
        Number(item.difficulty || 2),
      ]);
      const stored = db.get('SELECT id FROM choice_king_questions WHERE stable_code=?', [stableCode]);
      replaceQuestionTopics(db, {
        relationTable: 'choice_king_question_topics',
        questionId: stored.id,
        topicKeys: [topicKey],
        primaryTopicKey: topicKey,
      });
      imported += 1;
    }
  });
  return {
    version: dataset.version,
    imported,
    excluded,
    source_total: dataset.questions.length,
  };
}

module.exports = {
  SOURCE_LABEL,
  TOPIC_MAPPINGS,
  AUXILIARY_LINE_MAPPINGS,
  mappedTopicKey,
  migrateLegacyKnowledgeQuestions,
};
