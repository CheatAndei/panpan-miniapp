const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const initSqlJs = require('sql.js');
const {
  TARGET_IDS,
  REPAIR_ACTION,
  APPLY_CONFIRMATION,
  inspectPracticeHistory,
  repairPracticeHistory,
  sha256File,
} = require('../scripts/repair-practice-history');

const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

function query(db, sql, params = []) {
  const statement = db.prepare(sql);
  statement.bind(params);
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

async function createFixture(databasePath) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(schema);
  db.run("INSERT INTO users(id,openid,role,nickname) VALUES(1,'teacher','teacher','潘潘老师')");
  db.run("INSERT INTO users(id,openid,role,nickname) VALUES(2,'parent','parent','家长')");
  db.run("INSERT INTO classes(id,teacher_id,name,subject,grade) VALUES(1,1,'测试班','数学','初中')");
  const wrongPositions = {};
  for (const [index, submissionId] of TARGET_IDS.entries()) {
    const studentId = index + 1;
    const planId = index + 1;
    const assignmentId = index + 1;
    db.run('INSERT INTO students(id,teacher_id,class_id,name,invite_code) VALUES(?,?,?,?,?)', [
      studentId, 1, 1, `学生${studentId}`, `FIX${studentId}`,
    ]);
    db.run(`INSERT INTO practice_plans
      (id,teacher_id,class_id,title,start_date,end_date,grade_band,subject,module)
      VALUES(?,1,1,?,'2026-07-01','2026-07-31','初中','数学','综合计算')`, [
      planId, `计划${planId}`,
    ]);
    db.run(`INSERT INTO practice_assignments
      (id,plan_id,student_id,practice_date,status,estimated_seconds)
      VALUES(?,?,?,'2026-07-30','reviewed',1200)`, [assignmentId, planId, studentId]);
    const itemIds = [];
    for (let position = 1; position <= 3; position += 1) {
      const itemId = assignmentId * 100 + position;
      itemIds.push(itemId);
      db.run(`INSERT INTO practice_assignment_items
        (id,assignment_id,position,snapshot_stem,snapshot_answer,snapshot_module,
          snapshot_type,snapshot_difficulty,estimated_seconds,signature,template_key)
        VALUES(?,?,?,'题目','答案','综合计算','计算',3,120,?,?)`, [
        itemId, assignmentId, position, `signature-${itemId}`, `template-${itemId}`,
      ]);
    }
    db.run(`INSERT INTO practice_submissions
      (id,assignment_id,parent_id,status,current_round,needs_correction,teacher_note,
        submitted_at,reviewed_by,reviewed_at,completed_at,review_revision)
      VALUES(?,?,2,'reviewed',1,0,'','2026-07-30 10:00:00',1,
        '2026-07-30 12:00:00','2026-07-30 12:00:00',3)`, [
      submissionId, assignmentId,
    ]);
    db.run(`INSERT INTO practice_submission_rounds
      (submission_id,round_no,status,teacher_note,submitted_at,reviewed_by,reviewed_at)
      VALUES(?,1,'reviewed','','2026-07-30 10:00:00',1,'2026-07-30 12:00:00')`, [submissionId]);
    const originalReviews = itemIds.map((itemId, itemIndex) => ({
      round_no: 1,
      assignment_item_id: itemId,
      is_correct: itemIndex === 1 ? 0 : 1,
      teacher_note: itemIndex === 1 ? '原始错题' : '',
      reviewed_at: '2026-07-30 11:00:00',
    }));
    wrongPositions[submissionId] = [2];
    for (const review of originalReviews) {
      db.run(`INSERT INTO practice_review_rounds
        (submission_id,round_no,assignment_item_id,is_correct,teacher_note,reviewed_at)
        VALUES(?,?,?,1,'','2026-07-30 12:00:00')`, [
        submissionId, review.round_no, review.assignment_item_id,
      ]);
      db.run(`INSERT INTO practice_reviews
        (submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at)
        VALUES(?,?,1,'','2026-07-30 12:00:00')`, [
        submissionId, review.assignment_item_id,
      ]);
    }
    db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
      VALUES(1,'practice_submission_requeued','practice_submission',?,?)`, [
      submissionId,
      JSON.stringify({
        requeue_id: 'fixture-requeue',
        before: {
          status: 'correction_required',
          current_round: 1,
          needs_correction: 1,
          teacher_note: '首次批改',
          submitted_at: '2026-07-30 10:00:00',
          reviewed_by: 1,
          reviewed_at: '2026-07-30 11:00:00',
          completed_at: null,
          review_revision: 1,
          assignment_status: 'correction_required',
          rounds: [{
            round_no: 1,
            status: 'correction_required',
            teacher_note: '首次批改',
            submitted_at: '2026-07-30 10:00:00',
            reviewed_by: 1,
            reviewed_at: '2026-07-30 11:00:00',
          }],
          reviews: originalReviews,
        },
      }),
    ]);
    if (index >= 4) {
      db.run("UPDATE practice_assignments SET status='submitted' WHERE id=?", [assignmentId]);
      db.run(`UPDATE practice_submissions SET
        status='submitted',reviewed_by=NULL,reviewed_at=NULL,completed_at=NULL,review_revision=2
        WHERE id=?`, [submissionId]);
      db.run(`UPDATE practice_submission_rounds SET
        status='submitted',teacher_note='',reviewed_by=NULL,reviewed_at=NULL
        WHERE submission_id=? AND round_no=1`, [submissionId]);
      for (const review of originalReviews) {
        db.run(`UPDATE practice_review_rounds SET
          is_correct=?,teacher_note=?,reviewed_at=?
          WHERE submission_id=? AND round_no=1 AND assignment_item_id=?`, [
          review.is_correct, review.teacher_note, review.reviewed_at,
          submissionId, review.assignment_item_id,
        ]);
        db.run(`UPDATE practice_reviews SET
          is_correct=?,teacher_note=?,reviewed_at=?
          WHERE submission_id=? AND assignment_item_id=?`, [
          review.is_correct, review.teacher_note, review.reviewed_at,
          submissionId, review.assignment_item_id,
        ]);
      }
    }
  }
  fs.writeFileSync(databasePath, Buffer.from(db.export()));
  return wrongPositions;
}

test('七份历史批改按日志恢复第一轮、第二轮全对，并可重复执行', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'panpan-practice-repair-'));
  const databasePath = path.join(directory, 'teach.db');
  try {
    const wrongPositions = await createFixture(databasePath);
    const inspected = await inspectPracticeHistory({ databasePath });
    assert.equal(inspected.submissions.length, 7);
    assert.ok(inspected.submissions.every((submission) => submission.phase === 'ready'));
    assert.deepEqual(
      Object.fromEntries(inspected.submissions.map((submission) => [
        submission.submission_id, submission.original_wrong_positions,
      ])),
      wrongPositions,
    );

    const first = await repairPracticeHistory({
      databasePath,
      backupSha256: sha256File(databasePath),
      repairId: 'fixture-practice-repair-1',
      confirm: APPLY_CONFIRMATION,
    });
    assert.equal(first.changed, 7);
    assert.equal(first.idempotent, false);
    assert.ok(first.submissions.every((submission) =>
      submission.phase === 'repaired' && submission.final_status === 'reviewed'));

    const second = await repairPracticeHistory({
      databasePath,
      backupSha256: sha256File(databasePath),
      repairId: 'fixture-practice-repair-2',
      confirm: APPLY_CONFIRMATION,
    });
    assert.equal(second.changed, 0);
    assert.equal(second.idempotent, true);

    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const placeholders = TARGET_IDS.map(() => '?').join(',');
    assert.equal(Number(query(db, `SELECT COUNT(*) count FROM practice_submissions
      WHERE id IN (${placeholders}) AND status='reviewed' AND current_round=2
        AND needs_correction=0`, TARGET_IDS)[0].count), 7);
    assert.equal(Number(query(db, `SELECT COUNT(*) count FROM practice_review_rounds
      WHERE submission_id IN (${placeholders}) AND round_no=2 AND is_correct=1`, TARGET_IDS)[0].count), 7);
    assert.equal(Number(query(db, `SELECT COUNT(*) count FROM operation_logs
      WHERE action=? AND entity_id IN (${placeholders})`, [REPAIR_ACTION, ...TARGET_IDS])[0].count), 7);
    assert.equal(Number(query(db, `SELECT COUNT(*) count FROM practice_reviews
      WHERE submission_id IN (${placeholders}) AND is_correct=0`, TARGET_IDS)[0].count), 0);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('任一日志快照不精确时整库不写入', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'panpan-practice-repair-rollback-'));
  const databasePath = path.join(directory, 'teach.db');
  try {
    await createFixture(databasePath);
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync(databasePath));
    const row = query(db, `SELECT id,detail FROM operation_logs
      WHERE action='practice_submission_requeued' AND entity_id=34`)[0];
    const detail = JSON.parse(row.detail);
    detail.before.reviews = detail.before.reviews.slice(0, 2);
    db.run('UPDATE operation_logs SET detail=? WHERE id=?', [JSON.stringify(detail), row.id]);
    fs.writeFileSync(databasePath, Buffer.from(db.export()));
    const beforeSha256 = sha256File(databasePath);
    await assert.rejects(() => repairPracticeHistory({
      databasePath,
      backupSha256: beforeSha256,
      repairId: 'fixture-practice-repair-failure',
      confirm: APPLY_CONFIRMATION,
    }), /does not contain one valid round-one review per item/);
    assert.equal(sha256File(databasePath), beforeSha256);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
