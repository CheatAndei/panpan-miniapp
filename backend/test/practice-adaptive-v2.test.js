const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const { PassThrough } = require('node:stream');

const practice = require('../services/practice');
const {
  FIXED_GRADE,
  FIXED_MODULE,
  questionTypesForTopics,
  generateAssignment,
} = practice;

// Adaptive-v2 service contract. These intentionally fail until the production
// implementation is present; keep the tests service-level so route names may evolve.
const REBUILD_EXPORT = 'rebuildAdaptiveAssignment';
const FREEZE_EXPORT = 'freezeStudentPracticeAssignments';

let raw;
let db;
let teacherId;
let parentId;
let g7ClassId;
let g8ClassId;
let sequence = 0;

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

function insertUser(openid, role) {
  return Number(db.run('INSERT INTO users(openid,role,nickname) VALUES(?,?,?)', [
    openid, role, openid,
  ]).lastInsertRowid);
}

function createStudent(gradeCode = 'g7') {
  sequence += 1;
  const classId = gradeCode === 'g8' ? g8ClassId : g7ClassId;
  const grade = gradeCode === 'g8' ? '八年级' : '七年级';
  const studentId = Number(db.run(`INSERT INTO students
    (teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)`, [
    teacherId, classId, `adaptive-student-${sequence}`, grade, `AV2${String(sequence).padStart(4, '0')}`,
  ]).lastInsertRowid);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parentId, studentId]);
  return studentId;
}

function createPlan({
  gradeCode = 'g7',
  topicKey = gradeCode === 'g8' ? 'g8_powers' : 'rational_numbers',
  startDate = '2099-01-01',
  endDate = '2099-12-31',
} = {}) {
  sequence += 1;
  const classId = gradeCode === 'g8' ? g8ClassId : g7ClassId;
  return db.get('SELECT * FROM practice_plans WHERE id=?', [db.run(`INSERT INTO practice_plans
    (teacher_id,class_id,title,start_date,end_date,grade_band,grade_code,subject,module,
     question_types,topic_keys,difficulty,target_seconds,auto_advance,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1200,0,'published')`, [
    teacherId,
    classId,
    `adaptive-plan-${sequence}`,
    startDate,
    endDate,
    FIXED_GRADE,
    gradeCode,
    '数学',
    FIXED_MODULE,
    JSON.stringify(questionTypesForTopics([topicKey], gradeCode)),
    JSON.stringify([topicKey]),
    3,
  ]).lastInsertRowid]);
}

function seedPool(gradeCode, topicKey, countPerDifficulty = 64) {
  const questionType = questionTypesForTopics([topicKey], gradeCode)[0];
  for (const difficulty of [3, 4]) {
    for (let index = 1; index <= countPerDifficulty; index += 1) {
      const signature = `adaptive-v2-${gradeCode}-${topicKey}-d${difficulty}-${index}`;
      db.run(`INSERT INTO practice_questions
        (grade_band,grade_code,subject,module,question_type,difficulty,template_key,
         topic_key,stem,answer,estimated_seconds,signature,source_type,source_batch,is_active)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`, [
        FIXED_GRADE,
        gradeCode,
        '数学',
        FIXED_MODULE,
        questionType,
        difficulty,
        `tpl-${signature}`,
        topicKey,
        `${signature} = ?`,
        String(index),
        100,
        signature,
        'self_authored',
        'adaptive-v2-test-fixture',
      ]);
    }
  }
}

function seedFirstRound({
  plan,
  studentId,
  practiceDate,
  wrongCount,
  reviewedCount = 12,
}) {
  sequence += 1;
  const complete = reviewedCount === 12;
  const status = complete && wrongCount === 0 ? 'reviewed' : 'correction_required';
  const assignmentId = Number(db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta,assignment_source)
    VALUES(?,?,?,?,1200,?,'adaptive')`, [
    plan.id,
    studentId,
    practiceDate,
    status,
    JSON.stringify({ policy_version: 'fixture-history' }),
  ]).lastInsertRowid);
  const itemIds = [];
  for (let index = 0; index < 12; index += 1) {
    itemIds.push(Number(db.run(`INSERT INTO practice_assignment_items
      (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,
       snapshot_type,snapshot_difficulty,estimated_seconds,signature,template_key)
      VALUES(?,NULL,?,?,?,?,'fixture',3,100,?,?)`, [
      assignmentId,
      index + 1,
      `history-${sequence}-${index + 1}`,
      String(index + 1),
      FIXED_MODULE,
      `history-signature-${sequence}-${index + 1}`,
      `history-template-${sequence}-${index + 1}`,
    ]).lastInsertRowid));
  }
  const reviewedAt = `${practiceDate} 12:00:00`;
  const submissionId = Number(db.run(`INSERT INTO practice_submissions
    (assignment_id,parent_id,status,current_round,needs_correction,submitted_at,reviewed_by,reviewed_at,completed_at)
    VALUES(?,?,?,1,?,?,?, ?,?)`, [
    assignmentId,
    parentId,
    status,
    wrongCount > 0 || !complete ? 1 : 0,
    reviewedAt,
    teacherId,
    reviewedAt,
    status === 'reviewed' ? reviewedAt : null,
  ]).lastInsertRowid);
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,submitted_at,reviewed_by,reviewed_at)
    VALUES(?,1,?,?,?,?)`, [submissionId, status, reviewedAt, teacherId, reviewedAt]);
  for (let index = 0; index < reviewedCount; index += 1) {
    const isCorrect = index < wrongCount ? 0 : 1;
    db.run(`INSERT INTO practice_review_rounds
      (submission_id,round_no,assignment_item_id,is_correct,reviewed_at)
      VALUES(?,1,?,?,?)`, [submissionId, itemIds[index], isCorrect, reviewedAt]);
    db.run(`INSERT INTO practice_reviews
      (submission_id,assignment_item_id,is_correct,reviewed_at)
      VALUES(?,?,?,?)`, [submissionId, itemIds[index], isCorrect, reviewedAt]);
  }
  return { assignmentId, submissionId, itemIds, practiceDate };
}

function reviseFirstRound(history, wrongCount) {
  history.itemIds.forEach((itemId, index) => {
    const isCorrect = index < wrongCount ? 0 : 1;
    db.run(`UPDATE practice_review_rounds SET is_correct=?,reviewed_at=CURRENT_TIMESTAMP
      WHERE submission_id=? AND round_no=1 AND assignment_item_id=?`, [
      isCorrect, history.submissionId, itemId,
    ]);
    db.run(`UPDATE practice_reviews SET is_correct=?,reviewed_at=CURRENT_TIMESTAMP
      WHERE submission_id=? AND assignment_item_id=?`, [
      isCorrect, history.submissionId, itemId,
    ]);
  });
}

function assignmentFor(studentId, practiceDate) {
  return db.get('SELECT * FROM practice_assignments WHERE student_id=? AND practice_date=?', [
    studentId, practiceDate,
  ]);
}

function assignmentItems(assignmentId) {
  return db.all(`SELECT i.position,i.signature,i.snapshot_difficulty,q.grade_code,q.topic_key
    FROM practice_assignment_items i
    LEFT JOIN practice_questions q ON q.id=i.question_id
    WHERE i.assignment_id=? ORDER BY i.position`, [assignmentId]);
}

function selectionMeta(assignment) {
  return JSON.parse(assignment.selection_meta || '{}');
}

function assertAdaptiveAssignment(assignment, {
  enhancedCount,
  history = null,
  wrongCount = null,
}) {
  const items = assignmentItems(assignment.id);
  assert.equal(items.length, 12, 'adaptive-v2 always generates exactly 12 questions');
  assert.equal(items.filter((item) => Number(item.snapshot_difficulty) === 4).length, enhancedCount);
  assert.equal(items.filter((item) => Number(item.snapshot_difficulty) === 3).length, 12 - enhancedCount);
  const meta = selectionMeta(assignment);
  for (const field of [
    'policy_version',
    'ability_source_assignment_id',
    'ability_source_date',
    'ability_wrong_count',
    'ability_review_round',
    'enhanced_target_count',
    'enhanced_selected_count',
  ]) assert.ok(Object.hasOwn(meta, field), `selection_meta.${field} is required`);
  assert.equal(meta.policy_version, 'adaptive-v2');
  assert.equal(Number(meta.enhanced_target_count), enhancedCount);
  assert.equal(Number(meta.enhanced_selected_count), enhancedCount);
  if (history) {
    assert.equal(Number(meta.ability_source_assignment_id), history.assignmentId);
    assert.equal(meta.ability_source_date, history.practiceDate);
    assert.equal(Number(meta.ability_wrong_count), wrongCount);
    assert.equal(Number(meta.ability_review_round), 1);
  }
}

function requiredService(name) {
  assert.equal(typeof practice[name], 'function', `practice service must export ${name}`);
  return practice[name];
}

function assignmentFingerprint(assignmentId) {
  const assignment = db.get('SELECT * FROM practice_assignments WHERE id=?', [assignmentId]);
  return {
    assignment,
    items: assignmentItems(assignmentId).map((item) => ({
      position: Number(item.position),
      signature: item.signature,
      difficulty: Number(item.snapshot_difficulty),
    })),
  };
}

function addPendingSubmission(assignmentId) {
  const submissionId = Number(db.run(`INSERT INTO practice_submissions
    (assignment_id,parent_id,status,current_round,needs_correction,submitted_at)
    VALUES(?,?,'submitted',1,0,CURRENT_TIMESTAMP)`, [assignmentId, parentId]).lastInsertRowid);
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,submitted_at)
    VALUES(?,1,'submitted',CURRENT_TIMESTAMP)`, [submissionId]);
}

function renderStudentPlanPdf(plan, studentId) {
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

test.before(async () => {
  const SQL = await initSqlJs();
  raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys=ON');
  raw.run(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
  // topic_key is a legacy migration column rather than part of the base schema.
  if (!raw.exec('PRAGMA table_info(practice_questions)')[0].values.some((row) => row[1] === 'topic_key')) {
    raw.run('ALTER TABLE practice_questions ADD COLUMN topic_key TEXT');
  }
  db = createDbFacade(raw);
  teacherId = insertUser('adaptive-v2-teacher', 'teacher');
  parentId = insertUser('adaptive-v2-parent', 'parent');
  g7ClassId = Number(db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,'adaptive-g7','数学','七年级')`, [teacherId]).lastInsertRowid);
  g8ClassId = Number(db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,'adaptive-g8','数学','八年级')`, [teacherId]).lastInsertRowid);
  seedPool('g7', 'rational_numbers');
  seedPool('g7', 'linear_equation', 16);
  seedPool('g8', 'g8_powers');
  seedPool('g8', 'g8_factorization', 16);
});

test.after(() => raw?.close());

test('adaptive-v2 schema and service exports exist', () => {
  const columns = new Set(db.all('PRAGMA table_info(practice_assignments)').map((row) => row.name));
  for (const field of ['is_frozen', 'frozen_at', 'freeze_source', 'frozen_by']) {
    assert.ok(columns.has(field), `practice_assignments.${field} is required`);
  }
  requiredService(REBUILD_EXPORT);
  requiredService(FREEZE_EXPORT);
});

for (const wrongCount of [0, 1]) {
  test(`complete round one with ${wrongCount} wrong selects 6 normal + 6 enhanced`, () => {
    const plan = createPlan();
    const studentId = createStudent();
    const history = seedFirstRound({
      plan, studentId, practiceDate: '2099-01-01', wrongCount,
    });
    const assignment = generateAssignment(db, plan, studentId, '2099-01-02');
    assertAdaptiveAssignment(assignment, { enhancedCount: 6, history, wrongCount });
  });
}

test('complete round one with 2 wrong selects 12 normal questions', () => {
  const plan = createPlan();
  const studentId = createStudent();
  const history = seedFirstRound({
    plan, studentId, practiceDate: '2099-01-01', wrongCount: 2,
  });
  const assignment = generateAssignment(db, plan, studentId, '2099-01-02');
  assertAdaptiveAssignment(assignment, { enhancedCount: 0, history, wrongCount: 2 });
});

test('incomplete round-one review selects 12 normal questions', () => {
  const plan = createPlan();
  const studentId = createStudent();
  seedFirstRound({
    plan, studentId, practiceDate: '2099-01-01', wrongCount: 1, reviewedCount: 11,
  });
  const assignment = generateAssignment(db, plan, studentId, '2099-01-02');
  assertAdaptiveAssignment(assignment, { enhancedCount: 0 });
});

test('later correction rounds do not overwrite round-one ability', () => {
  const plan = createPlan();
  const studentId = createStudent();
  const history = seedFirstRound({
    plan, studentId, practiceDate: '2099-01-01', wrongCount: 1,
  });
  const correctedItemId = history.itemIds[0];
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,submitted_at,reviewed_by,reviewed_at)
    VALUES(?,2,'reviewed',CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)`, [history.submissionId, teacherId]);
  db.run(`INSERT INTO practice_review_rounds
    (submission_id,round_no,assignment_item_id,is_correct,reviewed_at)
    VALUES(?,2,?,1,CURRENT_TIMESTAMP)`, [history.submissionId, correctedItemId]);
  db.run(`UPDATE practice_reviews SET is_correct=1,reviewed_at=CURRENT_TIMESTAMP
    WHERE submission_id=? AND assignment_item_id=?`, [history.submissionId, correctedItemId]);
  db.run(`UPDATE practice_submissions SET status='reviewed',current_round=2,needs_correction=0,
    reviewed_at=CURRENT_TIMESTAMP,completed_at=CURRENT_TIMESTAMP WHERE id=?`, [history.submissionId]);
  const assignment = generateAssignment(db, plan, studentId, '2099-01-02');
  assertAdaptiveAssignment(assignment, { enhancedCount: 6, history, wrongCount: 1 });
});

test('explicit remaining-date freeze uses one snapshot and is idempotent', async () => {
  const plan = createPlan({ startDate: '2099-05-02', endDate: '2099-05-05' });
  const studentId = createStudent();
  const history = seedFirstRound({
    plan, studentId, practiceDate: '2099-05-01', wrongCount: 1,
  });
  const freeze = requiredService(FREEZE_EXPORT);
  await freeze(db, plan, studentId, { fromDate: '2099-05-02', actorId: teacherId });
  const first = db.all(`SELECT * FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND practice_date BETWEEN '2099-05-02' AND '2099-05-05'
    ORDER BY practice_date`, [plan.id, studentId]);
  assert.equal(first.length, 4);
  for (const assignment of first) {
    assert.equal(Number(assignment.is_frozen), 1);
    assert.equal(assignment.freeze_source, 'pdf_remaining');
    assert.equal(Number(assignment.frozen_by), teacherId);
    assert.ok(assignment.frozen_at);
    assertAdaptiveAssignment(assignment, { enhancedCount: 6, history, wrongCount: 1 });
  }
  const fingerprint = first.map((assignment) => ({
    ...assignment,
    items: assignmentItems(assignment.id).map((item) => item.signature),
  }));
  await freeze(db, plan, studentId, { fromDate: '2099-05-02', actorId: teacherId });
  const repeated = db.all(`SELECT * FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND practice_date BETWEEN '2099-05-02' AND '2099-05-05'
    ORDER BY practice_date`, [plan.id, studentId]).map((assignment) => ({
    ...assignment,
    items: assignmentItems(assignment.id).map((item) => item.signature),
  }));
  assert.deepEqual(repeated, fingerprint, 'repeat freeze must not regenerate or relock assignments');

  reviseFirstRound(history, 2);
  await requiredService(REBUILD_EXPORT)(db, plan, studentId, '2099-05-02');
  assert.deepEqual(
    db.all(`SELECT * FROM practice_assignments
      WHERE plan_id=? AND student_id=? AND practice_date BETWEEN '2099-05-02' AND '2099-05-05'
      ORDER BY practice_date`, [plan.id, studentId]).map((assignment) => ({
      ...assignment,
      items: assignmentItems(assignment.id).map((item) => item.signature),
    })),
    fingerprint,
    'a frozen assignment must ignore later review revisions',
  );

  const firstPdf = await renderStudentPlanPdf(plan, studentId);
  const secondPdf = await renderStudentPlanPdf(plan, studentId);
  assert.ok(firstPdf.length > 1000);
  assert.ok(secondPdf.length > 1000);
  assert.deepEqual(
    db.all(`SELECT * FROM practice_assignments
      WHERE plan_id=? AND student_id=? AND practice_date BETWEEN '2099-05-02' AND '2099-05-05'
      ORDER BY practice_date`, [plan.id, studentId]).map((assignment) => ({
      ...assignment,
      items: assignmentItems(assignment.id).map((item) => item.signature),
    })),
    fingerprint,
    'repeated PDF downloads must reuse the exact frozen assignment snapshots',
  );
});

test('review revision rebuilds an unclaimed adaptive assignment', async () => {
  const plan = createPlan();
  const studentId = createStudent();
  const history = seedFirstRound({
    plan, studentId, practiceDate: '2099-06-01', wrongCount: 1,
  });
  const initial = generateAssignment(db, plan, studentId, '2099-06-02');
  assertAdaptiveAssignment(initial, { enhancedCount: 6, history, wrongCount: 1 });
  reviseFirstRound(history, 2);
  await requiredService(REBUILD_EXPORT)(db, plan, studentId, '2099-06-02');
  const rebuilt = assignmentFor(studentId, '2099-06-02');
  assertAdaptiveAssignment(rebuilt, { enhancedCount: 0, history, wrongCount: 2 });
});

test('generated questions stay inside the plan grade and topic', async (t) => {
  for (const fixture of [
    { gradeCode: 'g7', topicKey: 'rational_numbers' },
    { gradeCode: 'g8', topicKey: 'g8_powers' },
  ]) {
    await t.test(`${fixture.gradeCode}/${fixture.topicKey}`, () => {
      const plan = createPlan(fixture);
      const studentId = createStudent(fixture.gradeCode);
      const assignment = generateAssignment(db, plan, studentId, '2099-07-15');
      const items = assignmentItems(assignment.id);
      assert.equal(items.length, 12);
      assert.deepEqual([...new Set(items.map((item) => item.grade_code))], [fixture.gradeCode]);
      assert.deepEqual([...new Set(items.map((item) => item.topic_key))], [fixture.topicKey]);
    });
  }
});

test('claimed, submitted, frozen, and custom-curriculum assignments are not rebuilt', async (t) => {
  const cases = [
    {
      name: 'claimed',
      lock(assignment) {
        db.run("UPDATE practice_assignments SET claimed_at='2099-08-02 08:00:00' WHERE id=?", [assignment.id]);
      },
    },
    {
      name: 'with submission',
      lock(assignment) { addPendingSubmission(assignment.id); },
    },
    {
      name: 'PDF-frozen',
      lock(assignment) {
        db.run(`UPDATE practice_assignments SET is_frozen=1,
          frozen_at='2099-08-02 08:00:00',freeze_source='pdf_remaining',frozen_by=? WHERE id=?`, [
          teacherId, assignment.id,
        ]);
      },
    },
    {
      name: 'student curriculum',
      lock(assignment) {
        db.run("UPDATE practice_assignments SET assignment_source='student_curriculum' WHERE id=?", [assignment.id]);
      },
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async () => {
      const plan = createPlan();
      const studentId = createStudent();
      const history = seedFirstRound({
        plan, studentId, practiceDate: '2099-08-01', wrongCount: 1,
      });
      const assignment = generateAssignment(db, plan, studentId, '2099-08-02');
      assertAdaptiveAssignment(assignment, { enhancedCount: 6, history, wrongCount: 1 });
      reviseFirstRound(history, 2);
      fixture.lock(assignment);
      const before = assignmentFingerprint(assignment.id);
      await requiredService(REBUILD_EXPORT)(db, plan, studentId, '2099-08-02');
      assert.deepEqual(
        assignmentFingerprint(assignment.id),
        before,
        `${fixture.name} assignment must retain its row, metadata, and item snapshots`,
      );
    });
  }
});

test('concurrent generation still leaves exactly one assignment', async () => {
  const plan = createPlan();
  const studentId = createStudent();
  const generated = await Promise.all(Array.from({ length: 12 }, () => Promise.resolve().then(
    () => generateAssignment(db, plan, studentId, '2099-07-01'),
  )));
  assert.equal(new Set(generated.map((assignment) => Number(assignment.id))).size, 1);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM practice_assignments
    WHERE student_id=? AND practice_date='2099-07-01'`, [studentId]).count), 1);
});
