const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const initSqlJs = require('sql.js');

const practice = require('../services/practice');
const { importQuestionDataset, validateQuestionDataset } = require('../services/practice-question-import');
const g7Bank = require('../resources/practice/g7-calculation-v4');
const g8Bank = require('../resources/practice/g8-calculation-v2');

const TOPIC_FIXTURES = Object.freeze({
  g7: Object.freeze({
    gradeCode: 'g7',
    topicKey: 'absolute_value',
    questionType: practice.TOPICS.absolute_value.questionTypes[0],
    bank: g7Bank,
    expectedBatch: 'panpan-g7-calculation-v4-20260806',
  }),
  g8: Object.freeze({
    gradeCode: 'g8',
    topicKey: 'g8_powers',
    questionType: practice.TOPICS.g8_powers.questionTypes[0],
    bank: g8Bank,
    expectedBatch: 'panpan-g8-calculation-v2-20260806',
  }),
});
const G8_LONG_PLAN_FIXTURES = Object.freeze(Object.keys(practice.GRADE_TOPICS.g8).map((topicKey) => Object.freeze({
  gradeCode: 'g8',
  topicKey,
  questionType: practice.TOPICS[topicKey].questionTypes[0],
  bank: g8Bank,
  expectedBatch: 'panpan-g8-calculation-v2-20260806',
})));

let raw;
let db;
let teacherId;
let parentId;
let sequence = 0;
const classIds = {};

function createDbFacade(database) {
  let transactionDepth = 0;
  const all = (sql, params = []) => {
    const statement = database.prepare(sql);
    try {
      if (params.length) statement.bind(params);
      const rows = [];
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } finally {
      statement.free();
    }
  };
  const get = (sql, params = []) => all(sql, params)[0] || null;
  const run = (sql, params = []) => {
    database.run(sql, params);
    return {
      lastInsertRowid: Number(get('SELECT last_insert_rowid() id').id),
      changes: database.getRowsModified(),
    };
  };
  const transaction = (work) => {
    if (transactionDepth) return work();
    database.run('BEGIN IMMEDIATE');
    transactionDepth = 1;
    try {
      const result = work();
      database.run('COMMIT');
      return result;
    } catch (error) {
      try { database.run('ROLLBACK'); } catch {}
      throw error;
    } finally {
      transactionDepth = 0;
    }
  };
  return { all, get, run, transaction, exec: (sql) => database.run(sql) };
}

function topicDataset(fixture) {
  const questions = fixture.bank.questions.filter((question) => (
    question.question_type === fixture.questionType
  ));
  assert.equal(questions.length, 400, `${fixture.gradeCode}/${fixture.topicKey} must expose all 400 questions`);
  assert.equal(questions.filter((question) => Number(question.difficulty) === 3).length, 200);
  assert.equal(questions.filter((question) => Number(question.difficulty) === 4).length, 200);
  return { metadata: fixture.bank.metadata, questions };
}

function createStudent(gradeCode) {
  sequence += 1;
  const id = Number(db.run(`INSERT INTO students
    (teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)`, [
    teacherId,
    classIds[gradeCode],
    `real-bank-${gradeCode}-student-${sequence}`,
    gradeCode,
    `RB${String(sequence).padStart(5, '0')}`,
  ]).lastInsertRowid);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parentId, id]);
  return id;
}

function createPlan(fixture, startDate, endDate) {
  sequence += 1;
  const firstQuestion = fixture.bank.questions.find((question) => (
    question.question_type === fixture.questionType
  ));
  const id = Number(db.run(`INSERT INTO practice_plans
    (teacher_id,class_id,title,start_date,end_date,grade_band,grade_code,subject,module,
     question_types,topic_keys,difficulty,target_seconds,auto_advance,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,'published')`, [
    teacherId,
    classIds[fixture.gradeCode],
    `real-bank-${fixture.gradeCode}-${sequence}`,
    startDate,
    endDate,
    firstQuestion.grade_band,
    fixture.gradeCode,
    firstQuestion.subject,
    firstQuestion.module,
    JSON.stringify([fixture.questionType]),
    JSON.stringify([fixture.topicKey]),
    3,
    1200,
  ]).lastInsertRowid);
  return db.get('SELECT * FROM practice_plans WHERE id=?', [id]);
}

function seedCompleteFirstRound({ plan, studentId, practiceDate, wrongCount }) {
  sequence += 1;
  const status = wrongCount === 0 ? 'reviewed' : 'correction_required';
  const assignmentId = Number(db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta,assignment_source)
    VALUES(?,?,?,?,1080,'{}','adaptive')`, [plan.id, studentId, practiceDate, status]).lastInsertRowid);
  const itemIds = [];
  for (let index = 0; index < 12; index += 1) {
    itemIds.push(Number(db.run(`INSERT INTO practice_assignment_items
      (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,
       snapshot_type,snapshot_difficulty,estimated_seconds,signature,template_key)
      VALUES(?,NULL,?,?,?,?,'ability-fixture',3,90,?,?)`, [
      assignmentId,
      index + 1,
      `ability-stem-${sequence}-${index}`,
      String(index),
      practice.FIXED_MODULE,
      `ability-signature-${sequence}-${index}`,
      `ability-template-${sequence}-${index}`,
    ]).lastInsertRowid));
  }
  const reviewedAt = `${practiceDate} 12:00:00`;
  const submissionId = Number(db.run(`INSERT INTO practice_submissions
    (assignment_id,parent_id,status,current_round,needs_correction,submitted_at,
     reviewed_by,reviewed_at,completed_at)
    VALUES(?,?,?,1,?,?,?,?,?)`, [
    assignmentId,
    parentId,
    status,
    wrongCount > 0 ? 1 : 0,
    reviewedAt,
    teacherId,
    reviewedAt,
    status === 'reviewed' ? reviewedAt : null,
  ]).lastInsertRowid);
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,submitted_at,reviewed_by,reviewed_at)
    VALUES(?,1,?,?,?,?)`, [submissionId, status, reviewedAt, teacherId, reviewedAt]);
  itemIds.forEach((itemId, index) => {
    const isCorrect = index < wrongCount ? 0 : 1;
    db.run(`INSERT INTO practice_review_rounds
      (submission_id,round_no,assignment_item_id,is_correct,reviewed_at)
      VALUES(?,1,?,?,?)`, [submissionId, itemId, isCorrect, reviewedAt]);
    db.run(`INSERT INTO practice_reviews
      (submission_id,assignment_item_id,is_correct,reviewed_at)
      VALUES(?,?,?,?)`, [submissionId, itemId, isCorrect, reviewedAt]);
  });
  return { assignmentId, submissionId, practiceDate, wrongCount };
}

function loadAssignments(plan, studentId) {
  return db.all(`SELECT * FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND practice_date>=? AND practice_date<=?
    ORDER BY practice_date,id`, [plan.id, studentId, plan.start_date, plan.end_date]);
}

function loadItems(assignmentId) {
  return db.all(`SELECT i.position,i.signature,i.snapshot_stem,i.snapshot_answer,
      i.snapshot_difficulty,i.estimated_seconds,q.grade_code,q.question_type,q.source_batch
    FROM practice_assignment_items i
    JOIN practice_questions q ON q.id=i.question_id
    WHERE i.assignment_id=? ORDER BY i.position`, [assignmentId]);
}

function assertAssignmentScope(assignment, fixture, enhancedCount) {
  const items = loadItems(assignment.id);
  assert.equal(items.length, 12, `${assignment.practice_date}: question count`);
  assert.equal(items.filter((item) => Number(item.snapshot_difficulty) === 3).length, 12 - enhancedCount);
  assert.equal(items.filter((item) => Number(item.snapshot_difficulty) === 4).length, enhancedCount);
  assert.ok(Number(assignment.estimated_seconds) >= 18 * 60, `${assignment.practice_date}: under 18 minutes`);
  assert.ok(Number(assignment.estimated_seconds) <= 22 * 60, `${assignment.practice_date}: over 22 minutes`);
  assert.equal(
    items.reduce((sum, item) => sum + Number(item.estimated_seconds), 0),
    Number(assignment.estimated_seconds),
  );
  assert.deepEqual([...new Set(items.map((item) => item.grade_code))], [fixture.gradeCode]);
  assert.deepEqual([...new Set(items.map((item) => item.question_type))], [fixture.questionType]);
  assert.deepEqual([...new Set(items.map((item) => item.source_batch))], [fixture.expectedBatch]);
  const meta = JSON.parse(assignment.selection_meta);
  assert.equal(meta.policy_version, 'adaptive-v2');
  assert.equal(Number(meta.enhanced_target_count), enhancedCount);
  assert.equal(Number(meta.enhanced_selected_count), enhancedCount);
  return { items, meta };
}

function frozenFingerprint(plan, studentId) {
  return loadAssignments(plan, studentId).map((assignment) => ({
    id: Number(assignment.id),
    practice_date: String(assignment.practice_date),
    status: assignment.status,
    estimated_seconds: Number(assignment.estimated_seconds),
    selection_meta: assignment.selection_meta,
    is_frozen: Number(assignment.is_frozen),
    frozen_at: assignment.frozen_at,
    freeze_source: assignment.freeze_source,
    frozen_by: assignment.frozen_by === null ? null : Number(assignment.frozen_by),
    items: loadItems(assignment.id).map((item) => ({
      position: Number(item.position),
      signature: item.signature,
      stem: item.snapshot_stem,
      answer: item.snapshot_answer,
      difficulty: Number(item.snapshot_difficulty),
      estimated_seconds: Number(item.estimated_seconds),
    })),
  }));
}

function renderPdf(plan, studentId) {
  const student = db.get('SELECT * FROM students WHERE id=?', [studentId]);
  const response = new PassThrough();
  response.type = () => response;
  response.set = () => response;
  const chunks = [];
  return new Promise((resolve, reject) => {
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve(Buffer.concat(chunks)));
    response.on('error', reject);
    try {
      practice.generateStudentPlanPdf(db, plan, student, response);
    } catch (error) {
      reject(error);
    }
  });
}

function dateAfter(startDate, offset) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function calendarDayGap(earlier, later) {
  return Math.round((new Date(`${later}T00:00:00Z`) - new Date(`${earlier}T00:00:00Z`)) / 86_400_000);
}

function assertOutsideRollingWindow(assignments, identityOf, label) {
  const lastSeen = new Map();
  let repeated = 0;
  for (const assignment of assignments) {
    for (const item of loadItems(assignment.id)) {
      const identity = identityOf(item);
      const previousDate = lastSeen.get(identity);
      if (previousDate) {
        repeated += 1;
        assert.ok(
          calendarDayGap(previousDate, assignment.practice_date) > 14,
          `${label} ${identity} repeated on ${previousDate} and ${assignment.practice_date}`,
        );
      }
      lastSeen.set(identity, assignment.practice_date);
    }
  }
  assert.ok(repeated > 0, `${label} fixture must exhaust 200 questions and exercise fallback reuse`);
}

test.before(async () => {
  const SQL = await initSqlJs();
  raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys=ON');
  raw.run(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  db = createDbFacade(raw);

  teacherId = Number(db.run(`INSERT INTO users(openid,role,nickname)
    VALUES('real-bank-teacher','teacher','real-bank-teacher')`).lastInsertRowid);
  parentId = Number(db.run(`INSERT INTO users(openid,role,nickname)
    VALUES('real-bank-parent','parent','real-bank-parent')`).lastInsertRowid);
  classIds.g7 = Number(db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,'real-bank-g7','math','g7')`, [teacherId]).lastInsertRowid);
  classIds.g8 = Number(db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,'real-bank-g8','math','g8')`, [teacherId]).lastInsertRowid);

  for (const [dataset, expectedInserted] of [
    [topicDataset(TOPIC_FIXTURES.g7), 400],
    [{ metadata: g8Bank.metadata, questions: g8Bank.questions }, 1600],
  ]) {
    assert.deepEqual(validateQuestionDataset(dataset).errors, []);
    const imported = importQuestionDataset(db, dataset, { dryRun: false });
    assert.equal(imported.inserted, expectedInserted);
  }
});

test.after(() => raw?.close());

test('real G7 v4 and G8 v2 topic slices each import all 200 standard + 200 enhanced questions', () => {
  for (const fixture of Object.values(TOPIC_FIXTURES)) {
    const rows = db.all(`SELECT difficulty,COUNT(*) count FROM practice_questions
      WHERE grade_code=? AND question_type=? AND source_batch=? AND is_active=1
      GROUP BY difficulty ORDER BY difficulty`, [
      fixture.gradeCode, fixture.questionType, fixture.expectedBatch,
    ]);
    assert.deepEqual(rows.map((row) => [Number(row.difficulty), Number(row.count)]), [[3, 200], [4, 200]]);
  }
});

for (const scenario of [
  {
    fixture: TOPIC_FIXTURES.g7,
    wrongCount: 0,
    historyDate: '2099-01-01',
    startDate: '2099-01-02',
    endDate: '2099-02-01',
  },
  {
    fixture: TOPIC_FIXTURES.g8,
    wrongCount: 1,
    historyDate: '2099-03-01',
    startDate: '2099-03-02',
    endDate: '2099-04-01',
  },
]) {
  test(`${scenario.fixture.gradeCode} real bank freezes 31 unique 6+6 assignments from ${scenario.wrongCount}-wrong ability`, async () => {
    const plan = createPlan(scenario.fixture, scenario.startDate, scenario.endDate);
    const studentId = createStudent(scenario.fixture.gradeCode);
    const history = seedCompleteFirstRound({
      plan,
      studentId,
      practiceDate: scenario.historyDate,
      wrongCount: scenario.wrongCount,
    });

    const outcome = practice.freezeStudentPracticeAssignments(db, plan, studentId, {
      fromDate: scenario.startDate,
      actorId: teacherId,
    });
    assert.equal(outcome.assignments.length, 31);
    assert.equal(outcome.frozen_count, 31);
    assert.equal(outcome.already_frozen, false);
    assert.equal(Number(outcome.ability.source_assignment_id), history.assignmentId);
    assert.equal(Number(outcome.ability.wrong_count), scenario.wrongCount);

    const assignments = loadAssignments(plan, studentId);
    assert.equal(assignments.length, 31);
    const standardSignatures = new Set();
    const enhancedSignatures = new Set();
    for (const assignment of assignments) {
      assert.equal(Number(assignment.is_frozen), 1);
      assert.equal(assignment.freeze_source, 'pdf_remaining');
      assert.equal(Number(assignment.frozen_by), teacherId);
      const { items, meta } = assertAssignmentScope(assignment, scenario.fixture, 6);
      assert.equal(Number(meta.ability_source_assignment_id), history.assignmentId);
      assert.equal(Number(meta.ability_wrong_count), scenario.wrongCount);
      for (const item of items) {
        const target = Number(item.snapshot_difficulty) === 4 ? enhancedSignatures : standardSignatures;
        assert.equal(target.has(item.signature), false, `${item.signature} repeated in its difficulty pool`);
        target.add(item.signature);
      }
    }
    assert.equal(standardSignatures.size, 31 * 6);
    assert.equal(enhancedSignatures.size, 31 * 6);

    const beforePdf = frozenFingerprint(plan, studentId);
    const firstPdf = await renderPdf(plan, studentId);
    const secondPdf = await renderPdf(plan, studentId);
    assert.ok(firstPdf.length > 10_000);
    assert.ok(secondPdf.length > 10_000);
    assert.deepEqual(frozenFingerprint(plan, studentId), beforePdf);
  });
}

test('31 all-standard days may reuse the batch pool but never inside the hard 14-day window', () => {
  const fixture = TOPIC_FIXTURES.g7;
  const startDate = '2099-09-01';
  const endDate = dateAfter(startDate, 30);
  const plan = createPlan(fixture, startDate, endDate);
  const studentId = createStudent(fixture.gradeCode);
  const outcome = practice.freezeStudentPracticeAssignments(db, plan, studentId, {
    fromDate: startDate,
    actorId: teacherId,
  });
  assert.equal(outcome.assignments.length, 31);
  const assignments = loadAssignments(plan, studentId);
  assert.equal(assignments.length, 31);
  for (const assignment of assignments) assertAssignmentScope(assignment, fixture, 0);
  assertOutsideRollingWindow(assignments, (item) => item.signature, 'signature');
  assertOutsideRollingWindow(
    assignments,
    (item) => `${item.snapshot_stem.normalize('NFKC').replace(/\s+/gu, '').replace(/[\u3002\uff1f]/gu, '')}|${item.snapshot_answer.normalize('NFKC').replace(/\s+/gu, '').replace(/[\u3002\uff1f]/gu, '')}`,
    'fingerprint',
  );
});

for (const [index, fixture] of G8_LONG_PLAN_FIXTURES.entries()) {
  test(`G8 ${fixture.topicKey} supports 31 all-standard days with hard 14-day exclusion`, () => {
    const startDate = dateAfter('2100-01-01', index * 40);
    const plan = createPlan(fixture, startDate, dateAfter(startDate, 30));
    const studentId = createStudent(fixture.gradeCode);
    const outcome = practice.freezeStudentPracticeAssignments(db, plan, studentId, {
      fromDate: startDate,
      actorId: teacherId,
    });
    assert.equal(outcome.assignments.length, 31);
    const assignments = loadAssignments(plan, studentId);
    assert.equal(assignments.length, 31);
    for (const assignment of assignments) assertAssignmentScope(assignment, fixture, 0);
    assertOutsideRollingWindow(assignments, (item) => item.signature, 'signature');
  });
}

test('no ability snapshot generates multiple all-standard days from the real G7 pool', () => {
  const fixture = TOPIC_FIXTURES.g7;
  const startDate = '2099-06-01';
  const endDate = dateAfter(startDate, 4);
  const plan = createPlan(fixture, startDate, endDate);
  const studentId = createStudent(fixture.gradeCode);
  const outcome = practice.freezeStudentPracticeAssignments(db, plan, studentId, {
    fromDate: startDate,
    actorId: teacherId,
  });
  assert.equal(outcome.ability, null);
  assert.equal(outcome.assignments.length, 5);
  for (const assignment of loadAssignments(plan, studentId)) {
    const { meta } = assertAssignmentScope(assignment, fixture, 0);
    assert.equal(meta.ability_source_assignment_id, null);
    assert.equal(meta.ability_wrong_count, null);
  }
});

test('a complete 2-wrong snapshot generates multiple all-standard days from the real G8 pool', () => {
  const fixture = TOPIC_FIXTURES.g8;
  const historyDate = '2099-07-31';
  const startDate = '2099-08-01';
  const endDate = dateAfter(startDate, 4);
  const plan = createPlan(fixture, startDate, endDate);
  const studentId = createStudent(fixture.gradeCode);
  const history = seedCompleteFirstRound({ plan, studentId, practiceDate: historyDate, wrongCount: 2 });
  const outcome = practice.freezeStudentPracticeAssignments(db, plan, studentId, {
    fromDate: startDate,
    actorId: teacherId,
  });
  assert.equal(outcome.assignments.length, 5);
  assert.equal(Number(outcome.ability.source_assignment_id), history.assignmentId);
  assert.equal(Number(outcome.ability.wrong_count), 2);
  for (const assignment of loadAssignments(plan, studentId)) {
    const { meta } = assertAssignmentScope(assignment, fixture, 0);
    assert.equal(Number(meta.ability_source_assignment_id), history.assignmentId);
    assert.equal(Number(meta.ability_wrong_count), 2);
  }
});
