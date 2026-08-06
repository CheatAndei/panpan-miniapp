const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.resolve(__dirname, '..', '..', '..', '..', 'z-rubbish', `practice-import-${process.pid}.db`);
process.env.DATABASE_PATH = dbPath;

const { initDB, getDB } = require('../db/init');
const g7Dataset = require('../resources/practice/g7-calculation-v4');
const g8Dataset = require('../resources/practice/g8-calculation-v2');
const legacyG7Dataset = require('../resources/practice/junior-calculation-v3');
const legacyG8Dataset = require('../resources/practice/g8-calculation-v1');
const {
  auditCalculationQuestionBanks,
  distributiveLinearEquationAnswerMatches,
} = require('../services/question-bank-audit');
const { normalizeLinearEquationDisplay } = require('../utils/math-expression');
const {
  importQuestionDataset,
  migrateQuestionDatasetAnswers,
  migrateQuestionDatasetStems,
  questionContentDigest,
  validateQuestionDataset,
} = require('../services/practice-question-import');

test.before(async () => {
  await initDB();
});

test.after(() => {
  try { fs.unlinkSync(dbPath); } catch {}
});

function ensureLegacyG7Dataset(db) {
  importQuestionDataset(db, legacyG7Dataset, { dryRun: false });
  db.run('UPDATE practice_questions SET is_active=0 WHERE source_batch=?', [legacyG7Dataset.metadata.batch_key]);
}

test('两个年级只激活新版分层题库，题干与签名全局唯一', () => {
  const specs = [
    { dataset: g7Dataset, gradeCode: 'g7', total: 3200, typeCount: 8, tierCount: 1600, perType: 400 },
    { dataset: g8Dataset, gradeCode: 'g8', total: 1600, typeCount: 4, tierCount: 800, perType: 400 },
  ];
  const db = getDB();
  for (const spec of specs) {
    const { dataset } = spec;
    assert.equal(dataset.questions.length, spec.total);
    assert.equal(new Set(dataset.questions.map((item) => item.signature)).size, spec.total);
    assert.equal(new Set(dataset.questions.map((item) => item.stem)).size, spec.total);
    assert.deepEqual([...new Set(dataset.questions.map((item) => item.module))], ['综合计算']);
    assert.equal(new Set(dataset.questions.map((item) => item.question_type)).size, spec.typeCount);
    const difficultyCounts = dataset.questions.reduce((counts, item) => {
      counts[item.difficulty] = (counts[item.difficulty] || 0) + 1;
      return counts;
    }, {});
    assert.deepEqual(difficultyCounts, { 3: spec.tierCount, 4: spec.tierCount });
    const typeCounts = dataset.questions.reduce((counts, item) => {
      counts[item.question_type] = (counts[item.question_type] || 0) + 1;
      return counts;
    }, {});
    assert.ok(Object.values(typeCounts).every((count) => count === spec.perType));
    assert.ok(dataset.questions.every((item) => item.answer.trim()));
    assert.deepEqual(validateQuestionDataset(dataset).errors, []);

    const imported = db.get('SELECT * FROM practice_question_imports WHERE batch_key=?', [dataset.metadata.batch_key]);
    assert.equal(Number(imported.imported_count), spec.total);
    assert.equal(Number(imported.copy_allowed), 0);
    assert.equal(imported.provenance, 'self_authored');
    assert.match(imported.source_snapshot_sha256, /^[a-f0-9]{64}$/);
    const active = db.get(`SELECT COUNT(*) count FROM practice_questions
      WHERE grade_band='初中' AND grade_code=? AND is_active=1 AND source_batch=?`, [
      spec.gradeCode, dataset.metadata.batch_key,
    ]);
    assert.equal(Number(active.count), spec.total);
    const activeOther = db.get(`SELECT COUNT(*) count FROM practice_questions
      WHERE grade_band='初中' AND grade_code=? AND is_active=1 AND source_batch<>?`, [
      spec.gradeCode, dataset.metadata.batch_key,
    ]);
    assert.equal(Number(activeOther.count), 0);
  }
});

test('退役 v3 分配律方程的标准答案代回原式仍全部成立', () => {
  const affected = legacyG7Dataset.questions.filter((item) => {
    const serial = Number(item.signature.replace('junior-calc-v3-', ''));
    return serial >= 802 && serial <= 958 && (serial - 802) % 4 === 0;
  });

  assert.equal(affected.length, 40);
  const target = affected.find((item) => item.signature === 'junior-calc-v3-0814');
  assert.equal(target.stem, '解方程：6(x+6)-7=5x+55。');
  assert.equal(target.answer, 'x=26');
  assert.equal(distributiveLinearEquationAnswerMatches(target), true);
  assert.equal(distributiveLinearEquationAnswerMatches({ ...target, answer: 'x=12' }), false);

  for (const item of affected) {
    const match = item.stem.match(/^解方程：(\d+)\(x([+-]\d+)\)([+-]\d+)=((?:\d+)?x)([+-]\d+)?。$/u);
    assert.ok(match, `${item.signature} 题干格式异常：${item.stem}`);
    const [, aText, bText, cText, xTerm, constantText = '0'] = match;
    const [numerator, denominator = '1'] = item.answer.replace('x=', '').split('/');
    const x = Number(numerator) / Number(denominator);
    const d = xTerm === 'x' ? 1 : Number(xTerm.replace('x', ''));
    const left = Number(aText) * (x + Number(bText)) + Number(cText);
    const right = d * x + Number(constantText);
    assert.ok(Math.abs(left - right) < 1e-10, `${item.signature} 标准答案 ${item.answer} 代回不成立`);
  }
});

test('答案修正迁移只更新白名单题目及完全匹配的历史快照', () => {
  const db = getDB();
  ensureLegacyG7Dataset(db);
  const target = legacyG7Dataset.questions.find((item) => item.signature === 'junior-calc-v3-0814');
  const bank = db.get('SELECT * FROM practice_questions WHERE signature=?', [target.signature]);
  const stale = { ...target, answer: 'x=12' };
  db.run('UPDATE practice_questions SET answer=?,content_sha256=? WHERE id=?', [
    stale.answer, questionContentDigest(stale), bank.id,
  ]);

  const teacherId = db.run(`INSERT INTO users(openid,nickname,role)
    VALUES(?,?,?)`, [`answer-migration-teacher-${process.pid}`, '迁移教师', 'teacher']).lastInsertRowid;
  const classId = db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,?,?,?)`, [teacherId, '迁移测试班', '数学', '初中']).lastInsertRowid;
  const studentId = db.run(`INSERT INTO students(teacher_id,class_id,name,grade)
    VALUES(?,?,?,?)`, [teacherId, classId, '迁移学生', '初中']).lastInsertRowid;
  const planId = db.run(`INSERT INTO practice_plans
    (teacher_id,class_id,title,start_date,end_date,grade_band,subject,module,question_types,topic_keys,difficulty)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
    teacherId, classId, '迁移计划', '2026-07-30', '2026-07-30', '初中', '数学',
    '综合计算', '["一元一次方程"]', '[]', 3,
  ]).lastInsertRowid;
  const assignmentId = db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds)
    VALUES(?,?,?,?,?)`, [planId, studentId, '2026-07-30', 'reviewed', 120]).lastInsertRowid;
  const itemId = db.run(`INSERT INTO practice_assignment_items
    (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
     snapshot_difficulty,estimated_seconds,signature,template_key)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
    assignmentId, bank.id, 1, target.stem, stale.answer, target.module, target.question_type,
    target.difficulty, target.estimated_seconds, target.signature, target.template_key,
  ]).lastInsertRowid;

  const result = migrateQuestionDatasetAnswers(db, legacyG7Dataset, [target.signature]);
  assert.deepEqual(result, { updated: 1, snapshot_updated: 1, total: 1 });
  assert.equal(db.get('SELECT answer FROM practice_questions WHERE id=?', [bank.id]).answer, 'x=26');
  assert.equal(db.get('SELECT snapshot_answer FROM practice_assignment_items WHERE id=?', [itemId]).snapshot_answer, 'x=26');
});

test('全部 6560 道生成题包含两年级新库且全量审计通过', () => {
  const audit = auditCalculationQuestionBanks();
  assert.equal(audit.total, 6560);
  assert.deepEqual(audit.banks.map((bank) => ({
    grade_code: bank.grade_code,
    total: bank.total,
    unique_stems: bank.unique_stems,
    unique_signatures: bank.unique_signatures,
    by_difficulty: bank.by_difficulty,
  })), [
    { grade_code: 'g7', total: 3200, unique_stems: 3200, unique_signatures: 3200, by_difficulty: { 3: 1600, 4: 1600 } },
    { grade_code: 'g8', total: 1600, unique_stems: 1600, unique_signatures: 1600, by_difficulty: { 3: 800, 4: 800 } },
  ]);
  assert.deepEqual(audit.failures, []);
});

test('题干格式迁移保留原数据库题目 ID 和签名', () => {
  const db = getDB();
  ensureLegacyG7Dataset(db);
  const next = legacyG7Dataset.questions.find((item) => item.signature === 'junior-calc-v3-0804');
  const legacyStem = next.stem.replace(/ − /gu, '+-').replace(/ \+ /gu, '+').replace(/ = /gu, '=').replace(/−/gu, '-');
  const original = db.get('SELECT * FROM practice_questions WHERE signature=?', [next.signature]);
  db.run('UPDATE practice_questions SET stem=?,content_sha256=? WHERE id=?', [
    legacyStem, questionContentDigest({ ...next, stem: legacyStem }), original.id,
  ]);
  const migrated = migrateQuestionDatasetStems(db, legacyG7Dataset, normalizeLinearEquationDisplay);
  const updated = db.get('SELECT * FROM practice_questions WHERE signature=?', [next.signature]);
  assert.equal(migrated.updated, 1);
  assert.equal(updated.id, original.id);
  assert.equal(updated.signature, original.signature);
  assert.equal(updated.stem, next.stem);
});

test('两个新版题库导入默认可预检且重复提交幂等', () => {
  const db = getDB();
  for (const dataset of [g7Dataset, g8Dataset]) {
    const dryRun = importQuestionDataset(db, dataset);
    assert.equal(dryRun.dry_run, true);
    assert.equal(dryRun.existing, dataset.questions.length);
    assert.equal(dryRun.inserted, 0);

    const repeated = importQuestionDataset(db, dataset, { dryRun: false });
    assert.equal(repeated.inserted, 0);
    assert.equal(Number(db.get(`SELECT COUNT(*) count FROM practice_question_imports
      WHERE batch_key=?`, [dataset.metadata.batch_key]).count), 1);
  }
});

test('重启后自动退役 G7 v3 与 G8 v1，且新库不重复导入', async () => {
  const db = getDB();
  ensureLegacyG7Dataset(db);
  importQuestionDataset(db, legacyG8Dataset, { dryRun: false });
  db.run('UPDATE practice_questions SET is_active=1 WHERE source_batch IN (?,?)', [
    legacyG7Dataset.metadata.batch_key,
    legacyG8Dataset.metadata.batch_key,
  ]);

  await initDB();
  const restarted = getDB();
  for (const legacy of [legacyG7Dataset, legacyG8Dataset]) {
    assert.equal(Number(restarted.get(`SELECT COUNT(*) count FROM practice_questions
      WHERE source_batch=? AND is_active=1`, [legacy.metadata.batch_key]).count), 0);
  }
  for (const current of [g7Dataset, g8Dataset]) {
    assert.equal(Number(restarted.get(`SELECT COUNT(*) count FROM practice_questions
      WHERE source_batch=? AND is_active=1`, [current.metadata.batch_key]).count), current.questions.length);
    assert.equal(Number(restarted.get(`SELECT COUNT(*) count FROM practice_question_imports
      WHERE batch_key=?`, [current.metadata.batch_key]).count), 1);
  }
});

test('公开但未授权的外部原题不能进入题库', () => {
  const unsafe = JSON.parse(JSON.stringify(g7Dataset));
  unsafe.metadata.batch_key = 'unsafe-public-page-copy';
  unsafe.metadata.provenance = 'licensed';
  unsafe.metadata.source_license = 'project-original';
  unsafe.metadata.copy_allowed = false;
  unsafe.questions.forEach((item) => { item.provenance = 'licensed'; delete item.content_sha256; });
  const result = validateQuestionDataset(unsafe);
  assert.ok(result.errors.some((error) => error.includes('必须明确允许复制')));
  assert.throws(() => importQuestionDataset(getDB(), unsafe, { dryRun: false }), /校验失败/);
});
