const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', '..', '..', '..', 'z-rubbish', `practice-import-${process.pid}.db`);
process.env.DATABASE_PATH = dbPath;

const { initDB, getDB } = require('../db/init');
const dataset = require('../resources/practice/guangzhou-original-v1');
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

test('广州原创题批次有 60 道、六个模块和完整来源审计', () => {
  assert.equal(dataset.questions.length, 60);
  assert.equal(new Set(dataset.questions.map((item) => item.signature)).size, 60);
  assert.equal(new Set(dataset.questions.map((item) => item.module)).size, 6);
  assert.deepEqual(validateQuestionDataset(dataset).errors, []);

  const db = getDB();
  const count = db.get(`SELECT COUNT(*) count FROM practice_questions
    WHERE source_batch='guangzhou-original-math-v1'`);
  assert.equal(Number(count.count), 60);
  const audit = db.get(`SELECT * FROM practice_question_imports
    WHERE batch_key='guangzhou-original-math-v1'`);
  assert.equal(audit.source_region, '广州');
  assert.equal(Number(audit.copy_allowed), 0);
  assert.equal(audit.provenance, 'self_authored');
  assert.match(audit.source_snapshot_sha256, /^[a-f0-9]{64}$/);
});

test('题库导入默认可预检且重复提交幂等', () => {
  const db = getDB();
  const dryRun = importQuestionDataset(db, dataset);
  assert.equal(dryRun.dry_run, true);
  assert.equal(dryRun.existing, 60);
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
