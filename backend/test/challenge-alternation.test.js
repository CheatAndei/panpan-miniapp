const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.DATABASE_PATH = path.join(rubbish, `challenge-alternation-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `challenge-alternation-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `challenge-alternation-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `challenge-alternation-exams-${suffix}`);
fs.mkdirSync(rubbish, { recursive: true });

const { initDB, getDB, runMigrations } = require('../db/init');
const {
  createAssignment,
  changeAssignment,
  currentState,
  reviewSubmission,
} = require('../services/challenge-v2');
const { practiceDateAt } = require('../services/practice');

let studentId;
let reviewStudentId;
let teacherId;
let parentId;

function markPassed(db, assignmentId) {
  db.run(`UPDATE challenge_assignments_v2
    SET status='passed',passed_on=?,updated_at=CURRENT_TIMESTAMP
    WHERE id=?`, [practiceDateAt(new Date()), assignmentId]);
}

test.before(async () => {
  await initDB();
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('alternate-teacher','teacher','潘潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('alternate-parent','parent','测试家长')");
  const student = db.run(`INSERT INTO students(teacher_id,name,grade,invite_code)
    VALUES(?,?,?,?)`, [teacher.lastInsertRowid, '交替测试同学', '八年级', 'ALT001']);
  const reviewStudent = db.run(`INSERT INTO students(teacher_id,name,grade,invite_code)
    VALUES(?,?,?,?)`, [teacher.lastInsertRowid, '批改测试同学', '八年级', 'ALT002']);
  studentId = student.lastInsertRowid;
  reviewStudentId = reviewStudent.lastInsertRowid;
  teacherId = teacher.lastInsertRowid;
  parentId = parent.lastInsertRowid;
  const asset = db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES('question','test/alternate.png','alternate.png','image/png',10,?)`, ['b'.repeat(64)]);

  for (const type of ['fill', 'subjective']) {
    for (let index = 1; index <= 4; index += 1) {
      db.run(`INSERT INTO weekly_challenge_questions
        (source_key,question_type,title,question_asset_id,source_label,grade_code,subject_code,is_active)
        VALUES(?,?,?,?,?,'g8','math',1)`, [
        `alternate-${type}-${index}`,
        type,
        `${type}-${index}`,
        asset.lastInsertRowid,
        '交替规则测试',
      ]);
    }
  }
});

test.after(() => {
  for (const target of [
    process.env.DATABASE_PATH,
    process.env.UPLOAD_DIR,
    process.env.PRIVATE_UPLOAD_DIR,
    process.env.EXAM_LIBRARY_DIR,
  ]) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
  }
});

test('同一学习日通过后填空与解答严格交替，换题保持当前类型，次日重新自由选择', () => {
  const db = getDB();
  const dimensions = { studentId, gradeCode: 'g8', subjectCode: 'math' };

  const firstFill = createAssignment(db, { ...dimensions, questionType: 'fill' });
  db.run("UPDATE challenge_assignments_v2 SET assigned_on='2000-01-01' WHERE id=?", [firstFill.id]);
  const changedFill = changeAssignment(db, { studentId, assignmentId: firstFill.id });
  assert.equal(changedFill.question_type, 'fill');
  assert.notEqual(changedFill.id, firstFill.id);
  assert.equal(currentState(db, dimensions).change_remaining, 0);

  markPassed(db, changedFill.id);
  const afterFill = currentState(db, dimensions);
  assert.equal(afterFill.next_question_type, 'subjective');

  const forcedSubjective = createAssignment(db, { ...dimensions, questionType: 'fill' });
  assert.equal(forcedSubjective.question_type, 'subjective');
  markPassed(db, forcedSubjective.id);
  assert.equal(currentState(db, dimensions).next_question_type, 'fill');

  const forcedFill = createAssignment(db, { ...dimensions, questionType: 'subjective' });
  assert.equal(forcedFill.question_type, 'fill');
  markPassed(db, forcedFill.id);

  db.run(`UPDATE challenge_assignments_v2
    SET passed_on='2000-01-01',updated_at='2000-01-01 00:00:00'
    WHERE student_id=? AND status='passed'`, [studentId]);
  assert.equal(currentState(db, dimensions).next_question_type, null);

  const nextDayChoice = createAssignment(db, { ...dimensions, questionType: 'subjective' });
  assert.equal(nextDayChoice.question_type, 'subjective');

  db.run("UPDATE challenge_assignments_v2 SET status='reviewed_wrong' WHERE id=?", [nextDayChoice.id]);
  const correctionRetry = createAssignment(db, { ...dimensions, questionType: 'fill' });
  assert.equal(correctionRetry.id, nextDayChoice.id);
  assert.equal(correctionRetry.question_type, 'subjective');
});

test('仅最新提交可批改，通过日不可被重复请求改写', () => {
  const db = getDB();
  const assignment = createAssignment(db, {
    studentId: reviewStudentId,
    gradeCode: 'g8',
    subjectCode: 'math',
    questionType: 'fill',
  });
  const first = db.run(`INSERT INTO challenge_submissions_v2(assignment_id,parent_id,attempt_no,status)
    VALUES(?,?,1,'submitted')`, [assignment.id, parentId]);
  db.run("UPDATE challenge_assignments_v2 SET status='submitted' WHERE id=?", [assignment.id]);

  const wrong = reviewSubmission(db, {
    teacherId,
    submissionId: first.lastInsertRowid,
    isCorrect: false,
    teacherNote: '请订正',
  });
  assert.equal(wrong.is_correct, false);
  assert.equal(wrong.idempotent, false);

  const second = db.run(`INSERT INTO challenge_submissions_v2(assignment_id,parent_id,attempt_no,status)
    VALUES(?,?,2,'submitted')`, [assignment.id, parentId]);
  db.run("UPDATE challenge_assignments_v2 SET status='submitted' WHERE id=?", [assignment.id]);
  assert.throws(() => reviewSubmission(db, {
    teacherId,
    submissionId: first.lastInsertRowid,
    isCorrect: false,
  }), (error) => error.statusCode === 409);

  const passed = reviewSubmission(db, {
    teacherId,
    submissionId: second.lastInsertRowid,
    isCorrect: true,
    teacherNote: '通过',
  });
  assert.equal(passed.is_correct, true);
  assert.equal(passed.idempotent, false);
  const firstPassedOn = db.get('SELECT passed_on FROM challenge_assignments_v2 WHERE id=?', [assignment.id]).passed_on;
  assert.equal(firstPassedOn, practiceDateAt(new Date()));

  db.run("UPDATE challenge_assignments_v2 SET updated_at='2001-01-01 00:00:00' WHERE id=?", [assignment.id]);
  const repeated = reviewSubmission(db, {
    teacherId,
    submissionId: second.lastInsertRowid,
    isCorrect: true,
    teacherNote: '重复请求',
  });
  assert.equal(repeated.idempotent, true);
  const unchanged = db.get('SELECT passed_on,updated_at FROM challenge_assignments_v2 WHERE id=?', [assignment.id]);
  assert.equal(unchanged.passed_on, firstPassedOn);
  assert.equal(unchanged.updated_at, '2001-01-01 00:00:00');
  assert.throws(() => reviewSubmission(db, {
    teacherId,
    submissionId: second.lastInsertRowid,
    isCorrect: false,
  }), (error) => error.statusCode === 409);
});

test('旧库双活跃题迁移后只保留一题，并由唯一索引阻止复发', () => {
  const db = getDB();
  db.run('DROP INDEX IF EXISTS idx_challenge_v2_one_current');
  const questions = db.all(`SELECT id,question_type FROM weekly_challenge_questions
    WHERE grade_code='g8' AND subject_code='math' ORDER BY question_type,id`);
  const fill = questions.find((item) => item.question_type === 'fill');
  const subjective = questions.find((item) => item.question_type === 'subjective');
  db.run(`INSERT INTO challenge_assignments_v2
    (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
    VALUES(?,?,'g8','math','fill','active',?)`, [reviewStudentId, fill.id, practiceDateAt(new Date())]);
  db.run(`INSERT INTO challenge_assignments_v2
    (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
    VALUES(?,?,'g8','math','subjective','active',?)`, [reviewStudentId, subjective.id, practiceDateAt(new Date())]);

  runMigrations();
  const current = db.all(`SELECT id FROM challenge_assignments_v2 WHERE student_id=?
    AND grade_code='g8' AND subject_code='math'
    AND status IN ('active','submitted','reviewed_wrong')`, [reviewStudentId]);
  assert.equal(current.length, 1);
  assert.throws(() => db.run(`INSERT INTO challenge_assignments_v2
    (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
    VALUES(?,?,'g8','math','fill','active',?)`, [reviewStudentId, fill.id, practiceDateAt(new Date())]), /UNIQUE/);
});

test('图片解码完成后在写入事务内重新确认挑战仍可提交', () => {
  const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'weekly-challenge.js'), 'utf8');
  const transactionStart = route.indexOf('const result=db.transaction(()=>{');
  const freshCheck = route.indexOf('const freshAssignment=assignmentRowV2(db,assignment.id);');
  const statusWrite = route.indexOf("UPDATE challenge_assignments_v2 SET status='submitted'");
  assert.ok(transactionStart >= 0);
  assert.ok(freshCheck > transactionStart);
  assert.ok(statusWrite > freshCheck);
  assert.match(route, /if\(result\.staleStatus\)return res\.status\(409\)/);
});
