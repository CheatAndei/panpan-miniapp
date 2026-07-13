const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', '..', '..', '..', 'z-rubbish', `practice-import-${process.pid}.db`);
process.env.DATABASE_PATH = dbPath;

const { initDB, getDB } = require('../db/init');
const dataset = require('../resources/practice/junior1-math-v2');
const {
  importQuestionDataset,
  validateQuestionDataset,
} = require('../services/practice-question-import');

test.before(async () => {
  await initDB();
});

test.after(() => {
  try { fs.unlinkSync(dbPath); } catch {}
});

test('初一自编题库有 500 道、分布完整且答案可审计', () => {
  assert.equal(dataset.questions.length, 500);
  assert.equal(new Set(dataset.questions.map((item) => item.signature)).size, 500);
  assert.equal(new Set(dataset.questions.map((item) => item.module)).size, 3);
  assert.equal(new Set(dataset.questions.map((item) => item.question_type)).size, 12);
  const typeCounts = dataset.questions.reduce((counts, item) => {
    counts[item.question_type] = (counts[item.question_type] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(typeCounts, {
    '有理数加减': 55, '有理数乘除': 50, '有理数混合': 60, '绝对值与数轴': 45, '有理数巧算': 35,
    '去括号与合并': 45, '整式加减': 40, '整式求值': 35,
    '基础移项': 35, '含括号方程': 35, '分数小数方程': 35, '实际问题方程': 30,
  });
  const difficultyCounts = dataset.questions.reduce((counts, item) => {
    counts[item.difficulty] = (counts[item.difficulty] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(difficultyCounts, { 1: 150, 2: 210, 3: 110, 4: 30 });
  assert.deepEqual(validateQuestionDataset(dataset).errors, []);

  const db = getDB();
  const count = db.get(`SELECT COUNT(*) count FROM practice_questions
    WHERE source_batch='panpan-junior1-math-v2'`);
  assert.equal(Number(count.count), 500);
  const audit = db.get(`SELECT * FROM practice_question_imports
    WHERE batch_key='panpan-junior1-math-v2'`);
  assert.equal(audit.source_region, '广州');
  assert.equal(Number(audit.copy_allowed), 0);
  assert.equal(audit.provenance, 'self_authored');
  assert.match(audit.source_snapshot_sha256, /^[a-f0-9]{64}$/);
  const activeLegacy = db.get(`SELECT COUNT(*) count FROM practice_questions
    WHERE grade_band='初中' AND is_active=1 AND (source_batch IS NULL OR source_batch<>?)`, [dataset.metadata.batch_key]);
  assert.equal(Number(activeLegacy.count), 0);
});

test('题库导入默认可预检且重复提交幂等', () => {
  const db = getDB();
  const dryRun = importQuestionDataset(db, dataset);
  assert.equal(dryRun.dry_run, true);
  assert.equal(dryRun.existing, 500);
  assert.equal(dryRun.inserted, 0);

  const repeated = importQuestionDataset(db, dataset, { dryRun: false });
  assert.equal(repeated.inserted, 0);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM practice_question_imports
    WHERE batch_key=?`, [dataset.metadata.batch_key]).count), 1);
});

test('公开但未授权的外部原题不能进入题库', () => {
  const unsafe = JSON.parse(JSON.stringify(dataset));
  unsafe.metadata.batch_key = 'unsafe-public-page-copy';
  unsafe.metadata.provenance = 'licensed';
  unsafe.metadata.source_license = 'project-original';
  unsafe.metadata.copy_allowed = false;
  unsafe.questions.forEach((item) => { item.provenance = 'licensed'; delete item.content_sha256; });
  const result = validateQuestionDataset(unsafe);
  assert.ok(result.errors.some((error) => error.includes('必须明确允许复制')));
  assert.throws(() => importQuestionDataset(getDB(), unsafe, { dryRun: false }), /校验失败/);
});
