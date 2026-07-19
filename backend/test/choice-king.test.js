const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rubbishDir = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbishDir, `choice-king-${process.pid}.db`);
fs.mkdirSync(rubbishDir, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'choice-king-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.UPLOAD_DIR = path.join(rubbishDir, 'choice-king-uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbishDir, 'choice-king-private');
process.env.CHOICE_KING_MANIFEST_PATH = path.join(rubbishDir, 'choice-king-missing-manifest.json');

const { start } = require('../server');
const { getDB } = require('../db/init');
const {
  leaderboard, seedChoiceKingQuestions, studentTeacherId,
} = require('../services/choice-king');

let server;
let base;
let parentToken;
let teacherToken;
let otherParentToken;
let otherTeacherToken;
let parentId;
let teacherId;
let otherTeacherId;
let studentId;
let marathonStudentId;
let otherStudentId;
const questionIds = [];

async function request(method, url, body, token = parentToken) {
  const response = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

function insertQuestion(db, position) {
  const period = position % 2 ? 'recent' : 'older';
  const created = db.run(`INSERT INTO choice_king_questions
    (stable_code,stem,options_json,correct_option,explanation,source_label,source_year,source_period,original_question_no)
    VALUES(?,?,?,?,?,?,?,?,?)`, [
    `CK-${String(position).padStart(4, '0')}`,
    `第 ${position} 道选择题`,
    JSON.stringify({ A: '选项 A', B: '选项 B', C: '选项 C', D: '选项 D' }),
    'A', `第 ${position} 题解析`, `${period === 'recent' ? '近年' : '早年'}试卷`,
    period === 'recent' ? 2025 : 2020, period, String(position),
  ]);
  questionIds.push(Number(created.lastInsertRowid));
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('ck-teacher','teacher','潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('ck-parent','parent','家长')");
  const otherTeacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('ck-other-teacher','teacher','其他老师')");
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('ck-other-parent','parent','其他家长')");
  const classRow = db.run('INSERT INTO classes(teacher_id,name,grade) VALUES(?,?,?)', [teacher.lastInsertRowid, '七年级 1 班', '七年级']);
  const otherClass = db.run('INSERT INTO classes(teacher_id,name,grade) VALUES(?,?,?)', [otherTeacher.lastInsertRowid, '七年级 2 班', '七年级']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.lastInsertRowid, classRow.lastInsertRowid, '小明', '七年级', 'CK001']);
  const marathon = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.lastInsertRowid, classRow.lastInsertRowid, '小跑', '七年级', 'CK002']);
  const otherStudent = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [otherTeacher.lastInsertRowid, otherClass.lastInsertRowid, '小外', '七年级', 'CK003']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, marathon.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [otherParent.lastInsertRowid, otherStudent.lastInsertRowid]);
  parentId = Number(parent.lastInsertRowid);
  teacherId = Number(teacher.lastInsertRowid);
  otherTeacherId = Number(otherTeacher.lastInsertRowid);
  studentId = Number(student.lastInsertRowid);
  marathonStudentId = Number(marathon.lastInsertRowid);
  otherStudentId = Number(otherStudent.lastInsertRowid);
  parentToken = jwt.sign({ id: parentId, openid: 'ck-parent', role: 'parent' }, process.env.JWT_SECRET);
  teacherToken = jwt.sign({ id: teacherId, openid: 'ck-teacher', role: 'teacher' }, process.env.JWT_SECRET);
  otherParentToken = jwt.sign({ id: otherParent.lastInsertRowid, openid: 'ck-other-parent', role: 'parent' }, process.env.JWT_SECRET);
  otherTeacherToken = jwt.sign({ id: otherTeacher.lastInsertRowid, openid: 'ck-other-teacher', role: 'teacher' }, process.env.JWT_SECRET);
  db.transaction(() => {
    for (let position = 1; position <= 805; position += 1) insertQuestion(db, position);
  });
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('manifest 仅同步 GZ7 generated 域：退役旧题、保留手工题与教师停题且重复执行幂等', () => {
  const manifestPath = path.join(rubbishDir, `choice-king-manifest-${process.pid}.json`);
  const db = getDB();
  const insertRaw = (stableCode, active = 1) => db.run(`INSERT INTO choice_king_questions
    (stable_code,stem,options_json,correct_option,source_period,is_active)
    VALUES(?,?,?,'A','recent',?)`, [stableCode, stableCode, JSON.stringify({ A: '1', B: '2', C: '3', D: '4' }), active]);
  const retired = insertRaw('GZ7-RETIRED-OLD');
  const manual = insertRaw('MANUAL-KEEP-1');
  const stopped = insertRaw('GZ7-TEACHER-STOPPED', 0);
  const lease = db.run(`INSERT INTO choice_king_issuances
    (student_id,question_id,issue_type,issued_at,expires_at) VALUES(?,?,'normal',?,?)`, [
    studentId, retired.lastInsertRowid, new Date().toISOString(), new Date(Date.now() + 3600000).toISOString(),
  ]);
  fs.writeFileSync(manifestPath, JSON.stringify({ questions: [{
    source_key: 'GZ7-CURRENT-1', source_year: 2025, recent_bucket: 'recent',
    source_question_no: '6', question_image: 'images/sample.png',
    options: { A: '1', B: '2', C: '3', D: '4' }, correct_option: 'C',
    explanation: '解析', source_label: '导入测试卷',
  }, {
    source_key: 'GZ7-TEACHER-STOPPED', source_year: 2020, recent_bucket: 'older',
    source_question_no: '8', question_image: 'images/stopped.png',
    options: { A: '甲', B: '乙', C: '丙', D: '丁' }, correct_option: 'D',
    explanation: '更新后的解析', source_label: '旧卷',
  }] }));

  assert.deepEqual(seedChoiceKingQuestions(db, manifestPath), {
    imported: 2, skipped: 0, deactivated: 1, missing: false,
  });
  const current = db.get(`SELECT * FROM choice_king_questions WHERE stable_code='GZ7-CURRENT-1'`);
  assert.equal(current.question_image_url, '/api/choice-king/assets/images/sample.png');
  assert.equal(Number(db.get('SELECT is_active FROM choice_king_questions WHERE id=?', [retired.lastInsertRowid]).is_active), 0);
  assert.equal(Number(db.get('SELECT is_active FROM choice_king_questions WHERE id=?', [manual.lastInsertRowid]).is_active), 1);
  assert.equal(Number(db.get('SELECT is_active FROM choice_king_questions WHERE id=?', [stopped.lastInsertRowid]).is_active), 0);
  const closedLease = db.get('SELECT closed_at,close_reason FROM choice_king_issuances WHERE id=?', [lease.lastInsertRowid]);
  assert.ok(closedLease.closed_at);
  assert.equal(closedLease.close_reason, 'question_stopped');

  assert.deepEqual(seedChoiceKingQuestions(db, manifestPath), {
    imported: 2, skipped: 0, deactivated: 0, missing: false,
  });
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions
    WHERE stable_code IN ('GZ7-CURRENT-1','GZ7-TEACHER-STOPPED')`).count), 2);
  assert.equal(Number(db.get('SELECT is_active FROM choice_king_questions WHERE id=?', [stopped.lastInsertRowid]).is_active), 0);
  try { fs.unlinkSync(manifestPath); } catch {}
});

test('next 不泄露答案，A-D 服务端判题且 client_request_id 幂等', async () => {
  const next = await request('GET', `/choice-king/next?student_id=${studentId}`);
  assert.equal(next.response.status, 200);
  assert.equal(next.payload.question.id, questionIds[0]);
  assert.equal(next.payload.question.is_review, false);
  assert.equal(next.payload.question.correct_option, undefined);
  assert.equal(next.payload.question.explanation, undefined);
  assert.ok(next.payload.question.issuance_id);
  const repeatedNext = await request('GET', `/choice-king/next?student_id=${studentId}`);
  assert.equal(repeatedNext.payload.question.id, next.payload.question.id);
  assert.equal(repeatedNext.payload.question.issuance_id, next.payload.question.issuance_id);

  const guessed = await request('POST', `/choice-king/questions/${questionIds[1]}/answer`, {
    student_id: studentId, selected_option: 'A', client_request_id: 'guessing-0001',
  });
  assert.equal(guessed.response.status, 409);

  const body = { student_id: studentId, selected_option: 'b', client_request_id: 'answer-0001' };
  const wrong = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, body);
  assert.equal(wrong.response.status, 200);
  assert.equal(wrong.payload.is_correct, false);
  assert.equal(wrong.payload.correct_option, 'A');
  assert.equal(wrong.payload.is_review, false);
  assert.equal(wrong.payload.stats.attempted_count, 1);

  const replay = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, body);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.payload.attempt_id, wrong.payload.attempt_id);
  assert.equal(replay.payload.selected_option, 'B');
  assert.equal(replay.payload.idempotent_replay, true);
  const mismatchedReplay = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, {
    ...body, selected_option: 'A',
  });
  assert.equal(mismatchedReplay.response.status, 409);
  const retryWithNewKey = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, {
    student_id: studentId, selected_option: 'A', client_request_id: 'answer-0001-new',
  });
  assert.equal(retryWithNewKey.response.status, 409);
  assert.equal(Number(getDB().get('SELECT COUNT(*) count FROM choice_king_attempts WHERE student_id=?', [studentId]).count), 1);
});

test('错题在约 8 道新题后精确重现，并按 1/3/7 天节奏连续两次正确后掌握', async () => {
  for (let index = 1; index <= 8; index += 1) {
    const next = await request('GET', `/choice-king/next?student_id=${studentId}`);
    assert.equal(next.payload.question.id, questionIds[index]);
    const result = await request('POST', `/choice-king/questions/${questionIds[index]}/answer`, {
      student_id: studentId,
      selected_option: 'A',
      client_request_id: `answer-${String(index + 1).padStart(4, '0')}`,
    });
    assert.equal(result.payload.is_correct, true);
    assert.equal(result.payload.is_review, false);
  }
  const review = await request('GET', `/choice-king/next?student_id=${studentId}`);
  assert.equal(review.payload.question.id, questionIds[0]);
  assert.equal(review.payload.question.is_review, true);

  const firstReview = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, {
    student_id: studentId,
    selected_option: 'B',
    client_request_id: 'review-0001',
  });
  assert.equal(firstReview.payload.is_review, true);
  assert.equal(firstReview.payload.wrong_progress.status, 'open');
  assert.equal(firstReview.payload.wrong_progress.consecutive_correct, 0);
  const delay = new Date(firstReview.payload.wrong_progress.next_due_at).getTime() - Date.now();
  assert.ok(delay > 2.9 * 24 * 60 * 60 * 1000 && delay < 3.1 * 24 * 60 * 60 * 1000);

  getDB().run(`UPDATE choice_king_wrong_progress SET next_due_at='2020-01-01T00:00:00.000Z'
    WHERE student_id=? AND question_id=?`, [studentId, questionIds[0]]);
  const secondIssued = await request('GET', `/choice-king/next?student_id=${studentId}`);
  assert.equal(secondIssued.payload.question.id, questionIds[0]);
  const secondReview = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, {
    student_id: studentId,
    selected_option: 'A',
    client_request_id: 'review-0002',
  });
  assert.equal(secondReview.payload.is_review, true);
  assert.equal(secondReview.payload.wrong_progress.status, 'open');
  assert.equal(secondReview.payload.wrong_progress.consecutive_correct, 1);
  const sevenDayDelay = new Date(secondReview.payload.wrong_progress.next_due_at).getTime() - Date.now();
  assert.ok(sevenDayDelay > 6.9 * 24 * 60 * 60 * 1000 && sevenDayDelay < 7.1 * 24 * 60 * 60 * 1000);

  getDB().run(`UPDATE choice_king_wrong_progress SET next_due_at='2020-01-01T00:00:00.000Z'
    WHERE student_id=? AND question_id=?`, [studentId, questionIds[0]]);
  const thirdIssued = await request('GET', `/choice-king/next?student_id=${studentId}`);
  assert.equal(thirdIssued.payload.question.id, questionIds[0]);
  const thirdReview = await request('POST', `/choice-king/questions/${questionIds[0]}/answer`, {
    student_id: studentId,
    selected_option: 'A',
    client_request_id: 'review-0003',
  });
  assert.equal(thirdReview.payload.wrong_progress.status, 'mastered');
  assert.equal(thirdReview.payload.wrong_progress.consecutive_correct, 2);
});

test('历史榜只计首次答对的不同题，本周榜从北京时间周一开始', async () => {
  const db = getDB();
  const firstCorrect = db.get(`SELECT id FROM choice_king_attempts
    WHERE student_id=? AND question_id=? AND is_correct=1`, [studentId, questionIds[1]]);
  db.run(`UPDATE choice_king_attempts SET answered_at='2026-07-12T15:59:59.000Z' WHERE id=?`, [firstCorrect.id]);
  const history = leaderboard(db, { studentId, period: 'history', now: new Date('2026-07-19T10:00:00+08:00') });
  const week = leaderboard(db, { studentId, period: 'week', now: new Date('2026-07-19T10:00:00+08:00') });
  assert.equal(history.my_rank.score, 9);
  assert.equal(week.period_start, '2026-07-12T16:00:00.000Z');
  assert.equal(week.my_rank.score, 8);

  const api = await request('GET', `/choice-king/leaderboard?student_id=${studentId}&period=history`);
  assert.equal(api.response.status, 200);
  assert.equal(api.payload.my_rank.score, 9);
  assert.ok(api.payload.entries.every((item) => item.score <= item.attempted_count));
});

test('题目报错去重、限频，教师只能处理自己学生的记录并可停题', async () => {
  const issued = await request('GET', `/choice-king/next?student_id=${studentId}`);
  const reportedQuestionId = issued.payload.question.id;
  const first = await request('POST', `/choice-king/questions/${reportedQuestionId}/report`, {
    student_id: studentId, reason: 'answer_error', detail: '答案看起来不一致',
  });
  assert.equal(first.response.status, 201);
  const duplicate = await request('POST', `/choice-king/questions/${reportedQuestionId}/report`, {
    student_id: studentId, reason: 'question_error', detail: '重复提交',
  });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.payload.duplicate, true);
  assert.equal(duplicate.payload.report.id, first.payload.report.id);

  for (let index = 1; index <= 4; index += 1) {
    const report = await request('POST', '/choice-king/reports', {
      student_id: studentId, question_id: questionIds[index - 1], reason: 'unclear', note: `第 ${index} 个问题`,
    });
    assert.equal(report.response.status, 201);
  }
  const limited = await request('POST', `/choice-king/questions/${questionIds[5]}/report`, {
    student_id: studentId, reason: 'other', detail: '第六次',
  });
  assert.equal(limited.response.status, 429);

  const queue = await request('GET', '/choice-king/reports?status=pending', undefined, teacherToken);
  assert.equal(queue.response.status, 200);
  assert.equal(queue.payload.reports.length, 5);
  const otherQueue = await request('GET', '/choice-king/reports?status=all', undefined, otherTeacherToken);
  assert.equal(otherQueue.payload.reports.length, 0);
  const forbidden = await request('PUT', `/choice-king/reports/${first.payload.report.id}`, {
    status: 'resolved', stop_question: true,
  }, otherTeacherToken);
  assert.equal(forbidden.response.status, 404);

  const handled = await request('PUT', `/choice-king/reports/${first.payload.report.id}`, {
    status: 'resolved', teacher_note: '已核对，先停用', stop_question: true,
  }, teacherToken);
  assert.equal(handled.response.status, 200);
  assert.equal(Number(handled.payload.report.question_is_active), 0);
  const stopped = await request('POST', `/choice-king/questions/${reportedQuestionId}/answer`, {
    student_id: studentId, selected_option: 'A', client_request_id: 'stopped-0001',
  });
  assert.equal(stopped.response.status, 409);
});

test('正常不同题达到 800 道只生成一次教师提醒，且提醒归属受限', async () => {
  const db = getDB();
  db.transaction(() => {
    for (let index = 0; index < 799; index += 1) {
      db.run(`INSERT INTO choice_king_attempts
        (student_id,parent_id,question_id,selected_option,is_correct,is_review,client_request_id,answered_at,response_json)
        VALUES(?,?,?,'A',1,0,?,?,?)`, [
        marathonStudentId, parentId, questionIds[index], `seed-${String(index).padStart(4, '0')}`,
        '2026-07-19T00:00:00.000Z', '{}',
      ]);
    }
  });
  const thresholdIssued = await request('GET', `/choice-king/next?student_id=${marathonStudentId}`);
  assert.equal(thresholdIssued.payload.question.id, questionIds[799]);
  const threshold = await request('POST', `/choice-king/questions/${questionIds[799]}/answer`, {
    student_id: marathonStudentId, selected_option: 'A', client_request_id: 'marathon-0800',
  });
  assert.equal(threshold.response.status, 200);
  assert.equal(threshold.payload.stats.attempted_count, 800);
  assert.equal(threshold.payload.teacher_alert_created, true);

  const replay = await request('POST', `/choice-king/questions/${questionIds[799]}/answer`, {
    student_id: marathonStudentId, selected_option: 'A', client_request_id: 'marathon-0800',
  });
  assert.equal(replay.payload.idempotent_replay, true);
  const afterThreshold = await request('GET', `/choice-king/next?student_id=${marathonStudentId}`);
  assert.equal(afterThreshold.payload.question.id, questionIds[800]);
  await request('POST', `/choice-king/questions/${questionIds[800]}/answer`, {
    student_id: marathonStudentId, selected_option: 'A', client_request_id: 'marathon-0801',
  });
  assert.equal(Number(db.get(`SELECT COUNT(*) count FROM teacher_alerts
    WHERE alert_key=?`, [`choice_king_800:${marathonStudentId}`]).count), 1);

  const alerts = await request('GET', '/choice-king/alerts', undefined, teacherToken);
  assert.equal(alerts.response.status, 200);
  assert.equal(alerts.payload.alerts.length, 1);
  const alertId = alerts.payload.alerts[0].id;
  const otherRead = await request('PUT', `/choice-king/alerts/${alertId}`, { is_read: true }, otherTeacherToken);
  assert.equal(otherRead.response.status, 404);
  const read = await request('PUT', `/choice-king/alerts/${alertId}/read`, { is_read: true }, teacherToken);
  assert.equal(read.response.status, 200);
  const unread = await request('GET', '/choice-king/alerts', undefined, teacherToken);
  assert.equal(unread.payload.alerts.length, 0);
});

test('迁班后以当前班级教师优先，旧 teacher_id 不再授予报错与提醒访问权', async () => {
  const db = getDB();
  const transferClass = db.run('INSERT INTO classes(teacher_id,name,grade) VALUES(?,?,?)', [teacherId, '转班测试', '七年级']);
  const transferStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,grade,invite_code)
    VALUES(?,?,?,?,?)`, [teacherId, transferClass.lastInsertRowid, '转班生', '七年级', 'CKMOVE']);
  db.run('UPDATE classes SET teacher_id=? WHERE id=?', [otherTeacherId, transferClass.lastInsertRowid]);
  assert.equal(studentTeacherId(db, transferStudent.lastInsertRowid), otherTeacherId);
  db.run(`INSERT INTO choice_king_attempts
    (student_id,parent_id,question_id,selected_option,is_correct,is_review,client_request_id,answered_at,response_json)
    VALUES(?,?,?,'A',1,0,'transfer-score-1',?,'{}')`, [
    transferStudent.lastInsertRowid, parentId, questionIds[30], new Date().toISOString(),
  ]);
  const activeClassBoard = leaderboard(db, {
    studentId: transferStudent.lastInsertRowid, period: 'history',
  });
  assert.ok(!activeClassBoard.entries.some((item) => Number(item.student_id) === studentId));

  const report = db.run(`INSERT INTO choice_king_reports
    (question_id,student_id,parent_id,reason,detail) VALUES(?,?,?,?,?)`, [
    questionIds[30], transferStudent.lastInsertRowid, parentId, 'other', '迁班后的反馈',
  ]);
  const alert = db.run(`INSERT INTO teacher_alerts
    (teacher_id,student_id,alert_type,alert_key,title,message) VALUES(?,?,?,?,?,?)`, [
    teacherId, transferStudent.lastInsertRowid, 'choice_king_800',
    `choice_king_transfer:${transferStudent.lastInsertRowid}`, '迁班提醒', '应由新老师查看',
  ]);

  const oldReports = await request('GET', '/choice-king/reports?status=all', undefined, teacherToken);
  assert.ok(!oldReports.payload.reports.some((item) => Number(item.id) === Number(report.lastInsertRowid)));
  const newReports = await request('GET', '/choice-king/reports?status=all', undefined, otherTeacherToken);
  assert.ok(newReports.payload.reports.some((item) => Number(item.id) === Number(report.lastInsertRowid)));
  const oldUpdate = await request('PUT', `/choice-king/reports/${report.lastInsertRowid}`, { status: 'resolved' }, teacherToken);
  assert.equal(oldUpdate.response.status, 404);
  const newUpdate = await request('PUT', `/choice-king/reports/${report.lastInsertRowid}`, { status: 'resolved' }, otherTeacherToken);
  assert.equal(newUpdate.response.status, 200);

  const oldAlerts = await request('GET', '/choice-king/alerts?status=all', undefined, teacherToken);
  assert.ok(!oldAlerts.payload.alerts.some((item) => Number(item.id) === Number(alert.lastInsertRowid)));
  const newAlerts = await request('GET', '/choice-king/alerts?status=all', undefined, otherTeacherToken);
  assert.ok(newAlerts.payload.alerts.some((item) => Number(item.id) === Number(alert.lastInsertRowid)));
  const oldRead = await request('PUT', `/choice-king/alerts/${alert.lastInsertRowid}`, { is_read: true }, teacherToken);
  assert.equal(oldRead.response.status, 404);
  const newRead = await request('PUT', `/choice-king/alerts/${alert.lastInsertRowid}`, { is_read: true }, otherTeacherToken);
  assert.equal(newRead.response.status, 200);

  db.run('UPDATE classes SET deleted_at=CURRENT_TIMESTAMP WHERE id=?', [transferClass.lastInsertRowid]);
  assert.equal(studentTeacherId(db, transferStudent.lastInsertRowid), teacherId);
  const deletedClassBoard = leaderboard(db, {
    studentId: transferStudent.lastInsertRowid, period: 'history',
  });
  assert.ok(deletedClassBoard.entries.some((item) => Number(item.student_id) === studentId));
  const fallbackReports = await request('GET', '/choice-king/reports?status=all', undefined, teacherToken);
  assert.ok(fallbackReports.payload.reports.some((item) => Number(item.id) === Number(report.lastInsertRowid)));
  const removedClassReports = await request('GET', '/choice-king/reports?status=all', undefined, otherTeacherToken);
  assert.ok(!removedClassReports.payload.reports.some((item) => Number(item.id) === Number(report.lastInsertRowid)));
  const fallbackRead = await request('PUT', `/choice-king/alerts/${alert.lastInsertRowid}`, { is_read: false }, teacherToken);
  assert.equal(fallbackRead.response.status, 200);
  const removedClassRead = await request('PUT', `/choice-king/alerts/${alert.lastInsertRowid}`, { is_read: true }, otherTeacherToken);
  assert.equal(removedClassRead.response.status, 404);
});

test('家长不能查看或提交未绑定学生的数据', async () => {
  const next = await request('GET', `/choice-king/next?student_id=${otherStudentId}`);
  assert.equal(next.response.status, 403);
  const answer = await request('POST', `/choice-king/questions/${questionIds[20]}/answer`, {
    student_id: studentId, selected_option: 'A', client_request_id: 'foreign-0001',
  }, otherParentToken);
  assert.equal(answer.response.status, 403);
});
