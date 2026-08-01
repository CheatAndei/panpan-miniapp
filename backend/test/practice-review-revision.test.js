const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbish, `practice-review-revision-${process.pid}.db`);
const uploadDir = path.join(rubbish, `practice-review-revision-uploads-${process.pid}`);
const privateDir = path.join(rubbish, `practice-review-revision-private-${process.pid}`);
const examDir = path.join(rubbish, `practice-review-revision-exams-${process.pid}`);
fs.mkdirSync(rubbish, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.UPLOAD_DIR = uploadDir;
process.env.PRIVATE_UPLOAD_DIR = privateDir;
process.env.EXAM_LIBRARY_DIR = examDir;
process.env.JWT_SECRET = 'practice-review-revision-secret-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherId;
let otherTeacherId;
let parentId;
let teacherToken;
let otherTeacherToken;
let parentToken;
let planId;
let otherPlanId;
let studentId;
let otherStudentId;
let signatureSequence = 0;

function token(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

async function request(method, url, authToken, body) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    response,
    payload: await response.json(),
  };
}

function createPlan(db, ownerId, classId, title) {
  return db.run(`INSERT INTO practice_plans
    (teacher_id,class_id,title,start_date,end_date,grade_band,subject,module,
     question_types,topic_keys,difficulty,target_seconds,auto_advance,status)
    VALUES(?,?,?,?,?,'初中','数学','综合计算','[]','[]',3,1200,0,'published')`, [
    ownerId, classId, title, '2099-01-01', '2099-01-31',
  ]).lastInsertRowid;
}

function seedReviewedSubmission(db, {
  targetPlanId = planId,
  targetStudentId = studentId,
  targetParentId = parentId,
  reviewerId = teacherId,
  practiceDate,
  reviewedAt,
  status = 'reviewed',
  results = [true, true],
}) {
  const assignment = db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds,selection_meta)
    VALUES(?,?,?,?,1200,'{}')`, [
    targetPlanId, targetStudentId, practiceDate, status,
  ]);
  const items = results.map((_, index) => {
    signatureSequence += 1;
    return db.run(`INSERT INTO practice_assignment_items
      (assignment_id,question_id,position,snapshot_stem,snapshot_answer,
       snapshot_module,snapshot_type,snapshot_difficulty,estimated_seconds,signature,template_key)
      VALUES(?,NULL,?,?,?,'综合计算','计算',3,90,?,?)`, [
      assignment.lastInsertRowid,
      index + 1,
      `第 ${index + 1} 题`,
      String(index + 10),
      `review-revision-signature-${signatureSequence}`,
      `review-revision-template-${signatureSequence}`,
    ]).lastInsertRowid;
  });
  const submission = db.run(`INSERT INTO practice_submissions
    (assignment_id,parent_id,status,current_round,needs_correction,teacher_note,
     submitted_at,reviewed_by,reviewed_at,completed_at,review_revision)
    VALUES(?,?,?,1,?,'原批改备注',?, ?, ?, ?,1)`, [
    assignment.lastInsertRowid,
    targetParentId,
    status,
    status === 'correction_required' ? 1 : 0,
    reviewedAt,
    reviewerId,
    reviewedAt,
    status === 'reviewed' ? reviewedAt : null,
  ]);
  db.run(`INSERT INTO practice_submission_rounds
    (submission_id,round_no,status,teacher_note,submitted_at,reviewed_by,reviewed_at)
    VALUES(?,1,?,'原批改备注',?,?,?)`, [
    submission.lastInsertRowid, status, reviewedAt, reviewerId, reviewedAt,
  ]);
  results.forEach((isCorrect, index) => {
    db.run(`INSERT INTO practice_review_rounds
      (submission_id,round_no,assignment_item_id,is_correct,teacher_note,reviewed_at)
      VALUES(?,1,?,?,?,?)`, [
      submission.lastInsertRowid,
      items[index],
      isCorrect ? 1 : 0,
      `题 ${index + 1} 原备注`,
      reviewedAt,
    ]);
    db.run(`INSERT INTO practice_reviews
      (submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at)
      VALUES(?,?,?,?,?)`, [
      submission.lastInsertRowid,
      items[index],
      isCorrect ? 1 : 0,
      `题 ${index + 1} 原备注`,
      reviewedAt,
    ]);
  });
  return {
    id: Number(submission.lastInsertRowid),
    assignmentId: Number(assignment.lastInsertRowid),
    itemIds: items.map(Number),
  };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  teacherId = Number(db.run("INSERT INTO users(openid,role,nickname) VALUES('revision-teacher','teacher','修订老师')").lastInsertRowid);
  otherTeacherId = Number(db.run("INSERT INTO users(openid,role,nickname) VALUES('revision-other-teacher','teacher','其他老师')").lastInsertRowid);
  parentId = Number(db.run("INSERT INTO users(openid,role,nickname) VALUES('revision-parent','parent','修订家长')").lastInsertRowid);
  const otherParentId = Number(db.run("INSERT INTO users(openid,role,nickname) VALUES('revision-other-parent','parent','其他家长')").lastInsertRowid);
  const classId = Number(db.run("INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,'修订班','数学','七年级')", [teacherId]).lastInsertRowid);
  const otherClassId = Number(db.run("INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,'其他班','数学','七年级')", [otherTeacherId]).lastInsertRowid);
  studentId = Number(db.run("INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,'小修','REV001')", [teacherId, classId]).lastInsertRowid);
  otherStudentId = Number(db.run("INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,'小外','REV002')", [otherTeacherId, otherClassId]).lastInsertRowid);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parentId, studentId]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [otherParentId, otherStudentId]);
  planId = Number(createPlan(db, teacherId, classId, '修订计划'));
  otherPlanId = Number(createPlan(db, otherTeacherId, otherClassId, '其他计划'));
  teacherToken = token(teacherId, 'teacher');
  otherTeacherToken = token(otherTeacherId, 'teacher');
  parentToken = token(parentId, 'parent');
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.rmSync(uploadDir, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(privateDir, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(examDir, { recursive: true, force: true }); } catch {}
});

test('最近批改跨本人计划排序、限量并返回可准确进入记录的轻量摘要', async () => {
  const db = getDB();
  const records = [
    seedReviewedSubmission(db, {
      practiceDate: '2099-01-05',
      reviewedAt: '2099-01-05 12:00:00',
      results: [true, false],
    }),
    seedReviewedSubmission(db, {
      practiceDate: '2099-01-04',
      reviewedAt: '2099-01-04 12:00:00',
      results: [true, true],
    }),
    seedReviewedSubmission(db, {
      practiceDate: '2099-01-03',
      reviewedAt: '2099-01-04 12:00:00',
      status: 'correction_required',
      results: [false, true],
    }),
    seedReviewedSubmission(db, {
      practiceDate: '2099-01-02',
      reviewedAt: '2099-01-03 12:00:00',
    }),
    seedReviewedSubmission(db, {
      practiceDate: '2099-01-01',
      reviewedAt: '2099-01-02 12:00:00',
    }),
  ];
  const otherParentId = Number(db.get("SELECT id FROM users WHERE openid='revision-other-parent'").id);
  const other = seedReviewedSubmission(db, {
    targetPlanId: otherPlanId,
    targetStudentId: otherStudentId,
    targetParentId: otherParentId,
    reviewerId: otherTeacherId,
    practiceDate: '2099-01-10',
    reviewedAt: '2100-01-01 12:00:00',
  });

  assert.equal((await request('GET', '/practice/reviews/recent?limit=4', parentToken)).response.status, 403);
  const recent = await request('GET', '/practice/reviews/recent?limit=4', teacherToken);
  assert.equal(recent.response.status, 200);
  assert.equal(recent.payload.limit, 4);
  assert.deepEqual(
    recent.payload.reviews.map((item) => item.submission_id),
    [records[0].id, records[2].id, records[1].id, records[3].id],
    'reviewed_at 相同时应按 submission id 倒序',
  );
  const first = recent.payload.reviews[0];
  assert.equal(first.plan_id, planId);
  assert.equal(first.student_name, '小修');
  assert.equal(first.current_round, 1);
  assert.equal(first.review_revision, 1);
  assert.deepEqual(first.wrong_positions, [2]);
  assert.equal(first.total_count, 2);
  assert.equal(first.can_revise, true);
  assert.equal(Object.hasOwn(first, 'items'), false);
  assert.equal(Object.hasOwn(first, 'attachments'), false);

  const defaultLimit = await request('GET', '/practice/reviews/recent', teacherToken);
  assert.equal(defaultLimit.payload.limit, 4);
  assert.equal(defaultLimit.payload.reviews.length, 4);
  const capped = await request('GET', '/practice/reviews/recent?limit=999', teacherToken);
  assert.equal(capped.payload.limit, 20);
  const otherTeacherRecent = await request('GET', '/practice/reviews/recent?limit=4', otherTeacherToken);
  assert.deepEqual(otherTeacherRecent.payload.reviews.map((item) => item.submission_id), [other.id]);
});

test('转班后当前教师可从最近批改打开详情并修订，旧教师全链路失权', async () => {
  const db = getDB();
  const oldClassId = Number(db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,'转班原班','数学','七年级')`, [teacherId]).lastInsertRowid);
  const newClassId = Number(db.run(`INSERT INTO classes(teacher_id,name,subject,grade)
    VALUES(?,'转班新班','数学','七年级')`, [otherTeacherId]).lastInsertRowid);
  const transferParentId = Number(db.run(`INSERT INTO users(openid,role,nickname)
    VALUES('revision-transfer-parent','parent','转班家长')`).lastInsertRowid);
  const transferredStudentId = Number(db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,'已转学生','REVTR1')`, [teacherId, oldClassId]).lastInsertRowid);
  const retainedStudentId = Number(db.run(`INSERT INTO students(teacher_id,class_id,name,invite_code)
    VALUES(?,?,'留班学生','REVTR2')`, [teacherId, oldClassId]).lastInsertRowid);
  const transferPlanId = Number(createPlan(db, teacherId, oldClassId, '转班历史计划'));
  const target = seedReviewedSubmission(db, {
    targetPlanId: transferPlanId,
    targetStudentId: transferredStudentId,
    targetParentId: transferParentId,
    practiceDate: '2098-12-26',
    reviewedAt: '2098-12-26 12:00:00',
    results: [true, false],
  });
  const pending = seedReviewedSubmission(db, {
    targetPlanId: transferPlanId,
    targetStudentId: transferredStudentId,
    targetParentId: transferParentId,
    practiceDate: '2098-12-27',
    reviewedAt: '2098-12-27 12:00:00',
    status: 'submitted',
  });
  const retained = seedReviewedSubmission(db, {
    targetPlanId: transferPlanId,
    targetStudentId: retainedStudentId,
    targetParentId: transferParentId,
    practiceDate: '2098-12-25',
    reviewedAt: '2098-12-25 12:00:00',
  });

  db.run('UPDATE students SET teacher_id=?,class_id=? WHERE id=?', [
    otherTeacherId, newClassId, transferredStudentId,
  ]);

  const currentRecent = await request('GET', '/practice/reviews/recent?limit=20', otherTeacherToken);
  assert.ok(currentRecent.payload.reviews.some((item) => Number(item.submission_id) === target.id));
  const oldRecent = await request('GET', '/practice/reviews/recent?limit=20', teacherToken);
  assert.equal(oldRecent.payload.reviews.some((item) => Number(item.submission_id) === target.id), false);

  const detailPath = `/practice/submissions?plan_id=${transferPlanId}&status=all&limit=50&page=1&submission_id=${target.id}`;
  const currentDetail = await request('GET', detailPath, otherTeacherToken);
  assert.equal(currentDetail.response.status, 200);
  assert.deepEqual(currentDetail.payload.submissions.map((item) => Number(item.id)), [target.id]);
  assert.equal((await request('GET', detailPath, teacherToken)).response.status, 404);

  const currentPlanRows = await request(
    'GET', `/practice/submissions?plan_id=${transferPlanId}&status=all&limit=50&page=1`, otherTeacherToken,
  );
  assert.equal(currentPlanRows.response.status, 200);
  assert.ok(currentPlanRows.payload.submissions.some((item) => Number(item.id) === target.id));
  assert.ok(currentPlanRows.payload.submissions.some((item) => Number(item.id) === pending.id));
  assert.equal(currentPlanRows.payload.submissions.some((item) => Number(item.id) === retained.id), false);

  const oldPlanRows = await request(
    'GET', `/practice/submissions?plan_id=${transferPlanId}&status=all&limit=50&page=1`, teacherToken,
  );
  assert.equal(oldPlanRows.response.status, 200);
  assert.ok(oldPlanRows.payload.submissions.some((item) => Number(item.id) === retained.id));
  assert.equal(oldPlanRows.payload.submissions.some((item) => Number(item.id) === target.id), false);
  assert.equal(oldPlanRows.payload.submissions.some((item) => Number(item.id) === pending.id), false);

  const revisionBody = {
    expected_round: 1,
    expected_revision: 1,
    teacher_note: '新老师完成修订',
    results: target.itemIds.map((itemId) => ({ item_id: itemId, is_correct: true })),
  };
  assert.equal((await request('PUT', `/practice/submissions/${target.id}/review/revision`,
    teacherToken, revisionBody)).response.status, 404);
  assert.equal((await request('PUT', `/practice/submissions/${target.id}/review/revision`,
    otherTeacherToken, revisionBody)).response.status, 200);

  const plans = await request('GET', '/practice/plans?limit=100', teacherToken);
  const transferPlan = plans.payload.plans.find((item) => Number(item.id) === transferPlanId);
  assert.ok(transferPlan);
  assert.equal(Number(transferPlan.pending_submission_count), 0);
});

test('历史详情返回当前轮完整评题、修订版本与锁定原因', async () => {
  const recent = await request('GET', '/practice/reviews/recent?limit=1', teacherToken);
  const target = recent.payload.reviews[0];
  const detail = await request(
    'GET',
    `/practice/submissions?plan_id=${target.plan_id}&status=all&limit=50&page=1&submission_id=${target.submission_id}`,
    teacherToken,
  );
  assert.equal(detail.response.status, 200);
  const record = detail.payload.submissions.find((item) => Number(item.id) === target.submission_id);
  assert.equal(record.items.length, 2);
  assert.deepEqual(record.items.map((item) => Number(item.is_correct)), [1, 0]);
  assert.equal(record.review_revision, 1);
  assert.equal(record.can_revise, true);
  assert.equal(record.revision_lock_reason, null);
});

test('重新推送已有批改记录后可在原轮次安全覆盖，不产生重复批改行', async () => {
  const db = getDB();
  const target = seedReviewedSubmission(db, {
    practiceDate: '2099-01-10',
    reviewedAt: '2099-01-10 12:00:00',
    status: 'correction_required',
    results: [false, true],
  });
  const file = db.run(`INSERT INTO private_files
    (token,student_id,purpose,owner_type,owner_id,storage_key,mime_type,byte_size,sha256,created_by)
    VALUES(?,?,'practice_photo','practice_submission',?,?, 'image/jpeg',128,?,?)`, [
    `requeue-token-${target.id}`,
    studentId,
    target.id,
    `2099-01/requeue-${target.id}.jpg`,
    `requeue-sha-${target.id}`,
    parentId,
  ]);
  db.run(`INSERT INTO practice_attachments
    (submission_id,round_no,owner_parent_id,file_id,sha256)
    VALUES(?,1,?,?,?)`, [
    target.id,
    parentId,
    file.lastInsertRowid,
    `requeue-sha-${target.id}`,
  ]);
  db.run(`UPDATE practice_submissions SET
    status='submitted',needs_correction=0,reviewed_by=NULL,reviewed_at=NULL,completed_at=NULL
    WHERE id=?`, [target.id]);
  db.run(`UPDATE practice_submission_rounds SET
    status='submitted',reviewed_by=NULL,reviewed_at=NULL
    WHERE submission_id=? AND round_no=1`, [target.id]);
  db.run("UPDATE practice_assignments SET status='submitted' WHERE id=?", [target.assignmentId]);

  const listed = await request(
    'GET',
    `/practice/submissions?plan_id=${planId}&status=submitted&limit=50&page=1&submission_id=${target.id}`,
    teacherToken,
  );
  const submission = listed.payload.submissions.find((item) => Number(item.id) === target.id);
  assert.ok(submission);
  assert.equal(submission.attachments.length, 1);

  const reviewed = await request(
    'PUT',
    `/practice/submissions/${target.id}/review`,
    teacherToken,
    {
      round_no: 1,
      teacher_note: '重新核对完成',
      results: submission.items.map((item) => ({ item_id: item.id, is_correct: true })),
    },
  );
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.payload.status, 'reviewed');
  assert.equal(reviewed.payload.review_revision, 2);
  const rows = db.all(`SELECT assignment_item_id,is_correct
    FROM practice_review_rounds
    WHERE submission_id=? AND round_no=1
    ORDER BY assignment_item_id`, [target.id]);
  assert.equal(rows.length, target.itemIds.length);
  assert.ok(rows.every((item) => Number(item.is_correct) === 1));
});

test('独立 PUT 修订完整校验、状态双向联动、版本并发与操作日志', async () => {
  const db = getDB();
  const target = seedReviewedSubmission(db, {
    practiceDate: '2099-01-20',
    reviewedAt: '2099-01-20 12:00:00',
    results: [true, true],
  });
  const completeResults = target.itemIds.map((itemId) => ({ item_id: itemId, is_correct: true }));

  assert.equal((await request('PUT', `/practice/submissions/${target.id}/review/revision`, parentToken, {
    expected_round: 1, expected_revision: 1, results: completeResults,
  })).response.status, 403);
  assert.equal((await request('PUT', `/practice/submissions/${target.id}/review/revision`, otherTeacherToken, {
    expected_round: 1, expected_revision: 1, results: completeResults,
  })).response.status, 404);
  assert.equal((await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    results: completeResults,
  })).response.status, 400);
  assert.equal((await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    expected_round: 2, expected_revision: 1, results: completeResults,
  })).response.status, 409);
  const incomplete = await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    expected_round: 1,
    expected_revision: 1,
    results: completeResults.slice(0, 1),
  });
  assert.equal(incomplete.response.status, 400);
  assert.deepEqual(incomplete.payload.item_ids, target.itemIds);
  const originalPut = await request('PUT', `/practice/submissions/${target.id}/review`, teacherToken, {
    round_no: 1,
    results: completeResults,
  });
  assert.equal(originalPut.response.status, 409, '历史修订不得放宽首次批改 PUT');

  const reopened = await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    expected_round: 1,
    expected_revision: 1,
    teacher_note: '发现第一题误判',
    results: [
      { item_id: target.itemIds[0], is_correct: false, note: '需订正' },
      { item_id: target.itemIds[1], is_correct: true },
    ],
  });
  assert.equal(reopened.response.status, 200);
  assert.equal(reopened.payload.status, 'correction_required');
  assert.equal(reopened.payload.needs_correction, true);
  assert.equal(reopened.payload.review_revision, 2);
  assert.deepEqual(reopened.payload.wrong_item_ids, [target.itemIds[0]]);
  assert.equal(db.get('SELECT status FROM practice_assignments WHERE id=?', [target.assignmentId]).status, 'correction_required');
  assert.equal(db.get('SELECT status FROM practice_submission_rounds WHERE submission_id=? AND round_no=1', [target.id]).status, 'correction_required');
  const reopenedState = db.get('SELECT status,needs_correction,completed_at FROM practice_submissions WHERE id=?', [target.id]);
  assert.equal(reopenedState.status, 'correction_required');
  assert.equal(Number(reopenedState.needs_correction), 1);
  assert.equal(reopenedState.completed_at, null);

  const log = db.get(`SELECT * FROM operation_logs
    WHERE action='practice_review_revised' AND entity_id=? ORDER BY id DESC LIMIT 1`, [target.id]);
  assert.equal(Number(log.actor_id), teacherId);
  assert.equal(log.entity_type, 'practice_submission');
  const detail = JSON.parse(log.detail);
  assert.equal(detail.before.status, 'reviewed');
  assert.equal(detail.before.review_revision, 1);
  assert.equal(detail.after.status, 'correction_required');
  assert.equal(detail.after.review_revision, 2);
  assert.equal(detail.after.results[0].is_correct, false);

  const correctionDetail = await request(
    'GET',
    `/practice/submissions?plan_id=${planId}&status=all&limit=50&page=1&submission_id=${target.id}`,
    teacherToken,
  );
  const correctionRecord = correctionDetail.payload.submissions.find((item) => Number(item.id) === target.id);
  assert.equal(correctionRecord.items.length, 2, '待订正历史必须返回当前轮全部已评题');
  assert.deepEqual(correctionRecord.items.map((item) => Number(item.is_correct)), [0, 1]);

  const passed = await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    expected_round: 1,
    expected_revision: 2,
    teacher_note: '确认两题均正确',
    results: completeResults,
  });
  assert.equal(passed.response.status, 200);
  assert.equal(passed.payload.status, 'reviewed');
  assert.equal(passed.payload.needs_correction, false);
  assert.equal(passed.payload.review_revision, 3);
  assert.ok(passed.payload.completed_at);
  assert.equal(db.get('SELECT status FROM practice_assignments WHERE id=?', [target.assignmentId]).status, 'reviewed');

  const stale = await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    expected_round: 1,
    expected_revision: 2,
    results: completeResults,
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.payload.review_revision, 3);

  const concurrent = await Promise.all([
    request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
      expected_round: 1,
      expected_revision: 3,
      teacher_note: '并发甲',
      results: completeResults,
    }),
    request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
      expected_round: 1,
      expected_revision: 3,
      teacher_note: '并发乙',
      results: completeResults,
    }),
  ]);
  assert.deepEqual(concurrent.map((item) => item.response.status).sort(), [200, 409]);
  assert.equal(Number(db.get('SELECT review_revision FROM practice_submissions WHERE id=?', [target.id]).review_revision), 4);
});

test('家长已开始上传下一订正轮后锁定修订并在历史详情返回原因', async () => {
  const db = getDB();
  const target = seedReviewedSubmission(db, {
    practiceDate: '2099-01-21',
    reviewedAt: '2099-01-21 12:00:00',
    status: 'correction_required',
    results: [false, true],
  });
  const privateFile = db.run(`INSERT INTO private_files
    (token,student_id,purpose,owner_type,owner_id,storage_key,mime_type,byte_size,
     sha256,original_name,created_by)
    VALUES(?,?,'practice_photo','practice_submission',?,?,'image/png',12,?,'next-round.png',?)`, [
    `revisiontoken${String(target.id).padStart(19, '0')}`,
    studentId,
    target.id,
    `practice/revision-${target.id}.png`,
    `revision-sha-${target.id}`,
    parentId,
  ]);
  db.run(`INSERT INTO practice_attachments
    (submission_id,round_no,owner_parent_id,file_id,sha256)
    VALUES(?,2,?,?,?)`, [
    target.id, parentId, privateFile.lastInsertRowid, `revision-sha-${target.id}`,
  ]);

  const detail = await request(
    'GET',
    `/practice/submissions?plan_id=${planId}&status=all&limit=50&page=1&submission_id=${target.id}`,
    teacherToken,
  );
  const record = detail.payload.submissions.find((item) => Number(item.id) === target.id);
  assert.equal(record.can_revise, false);
  assert.match(record.revision_lock_reason, /已开始上传下一轮订正/);

  const blocked = await request('PUT', `/practice/submissions/${target.id}/review/revision`, teacherToken, {
    expected_round: 1,
    expected_revision: 1,
    results: target.itemIds.map((itemId) => ({ item_id: itemId, is_correct: true })),
  });
  assert.equal(blocked.response.status, 409);
  assert.match(blocked.payload.error, /已开始上传下一轮订正/);
  assert.equal(Number(db.get('SELECT review_revision FROM practice_submissions WHERE id=?', [target.id]).review_revision), 1);
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM operation_logs
    WHERE action='practice_review_revised' AND entity_id=?`, [target.id]).count), 0);
});
