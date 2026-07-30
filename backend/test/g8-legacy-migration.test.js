const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.DATABASE_PATH = path.join(rubbish, `g8-legacy-migration-${suffix}.db`);
fs.mkdirSync(rubbish, { recursive: true });

const { initDB, getDB } = require('../db/init');
const {
  SOURCE_LABEL,
  migrateLegacyKnowledgeQuestions,
} = require('../services/g8-legacy-migration');
const { topicKeys } = require('../resources/g8-content/topics');

test.before(async () => {
  await initDB();
});

test.after(() => {
  try { fs.rmSync(process.env.DATABASE_PATH, { force: true }); } catch {}
});

test('旧知识闯关仅迁移固定 12 范围内的 48 道客观题且重复执行幂等', () => {
  const db = getDB();
  assert.deepEqual(migrateLegacyKnowledgeQuestions(db), {
    version: 'g8-math-v1',
    imported: 48,
    excluded: 24,
    source_total: 72,
  });
  assert.deepEqual(migrateLegacyKnowledgeQuestions(db), {
    version: 'g8-math-v1',
    imported: 48,
    excluded: 24,
    source_total: 72,
  });

  const rows = db.all(`SELECT q.id,q.stable_code,q.source_label,q.grade_code,q.subject_code,q.topic_key
    FROM choice_king_questions q WHERE q.stable_code LIKE 'GZ8-LEGACY-%' ORDER BY q.id`);
  assert.equal(rows.length, 48);
  assert.ok(rows.every((row) => row.source_label === SOURCE_LABEL));
  assert.ok(rows.every((row) => row.grade_code === 'g8' && row.subject_code === 'math'));
  assert.ok(rows.every((row) => topicKeys.includes(row.topic_key)));
  assert.equal(Number(db.get(`SELECT COUNT(*) count
    FROM choice_king_question_topics qt
    JOIN choice_king_questions q ON q.id=qt.question_id
    WHERE q.stable_code LIKE 'GZ8-LEGACY-%'`).count), 48);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE stable_code LIKE 'GZ8-LEGACY-G8K-FRACTIONS-%'
      OR stable_code LIKE 'GZ8-LEGACY-G8K-CONSTRUCTIONS-%'
      OR stable_code LIKE 'GZ8-LEGACY-G8K-GEOMETRY_FORMULAS-%'`).count), 0);
});
