const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `learning-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'learning-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'learning-uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'learning-private');

const { start } = require('../server');
const { getDB, runMigrations } = require('../db/init');
const { createOrGetAttempt, completeAttempt, growthSummary } = require('../services/learning');

let server;
let base;
let parentToken;
let otherParentToken;
let teacherToken;
let parentId;
let studentId;

async function request(method, url, body, token = parentToken) {
  const response = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('learning-teacher','teacher','潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('learning-parent','parent','家长')");
  const other = db.run("INSERT INTO users(openid,role,nickname) VALUES('learning-other','parent','其他家长')");
  const klass = db.run('INSERT INTO classes(teacher_id,name,grade) VALUES(?,?,?)', [teacher.lastInsertRowid, '初一数学', '初一']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.lastInsertRowid, klass.lastInsertRowid, '小番', '初一', 'LEARN1']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  parentId = parent.lastInsertRowid;
  studentId = student.lastInsertRowid;
  parentToken = jwt.sign({ id: parentId, openid: 'learning-parent', role: 'parent' }, process.env.JWT_SECRET);
  otherParentToken = jwt.sign({ id: other.lastInsertRowid, openid: 'learning-other', role: 'parent' }, process.env.JWT_SECRET);
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'learning-teacher', role: 'teacher' }, process.env.JWT_SECRET);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('学习闭环迁移可重复执行且相关数据表完整存在', () => {
  runMigrations();
  runMigrations();
  const db = getDB();
  for (const table of ['learning_attempts', 'wrong_item_progress', 'achievement_awards', 'weekly_reports', 'engagement_events', 'calculation_question_reports', 'mental_question_controls', 'calculation_score_reviews']) {
    assert.ok(db.get("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]));
  }
});

test('今日任务固定为三项并返回进度与成长指标', async () => {
  const result = await request('GET', `/learning/today?student_id=${studentId}`);
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.tasks.length, 3);
  assert.equal(result.payload.tasks[0].key, 'warmup');
  assert.equal(result.payload.progress.total, 3);
  assert.equal(typeof result.payload.stats.streak_days, 'number');
});

test('未绑定家长和教师都不能读取或创建孩子的学习任务', async () => {
  const other = await request('GET', `/learning/today?student_id=${studentId}`, undefined, otherParentToken);
  assert.equal(other.response.status, 403);
  const teacher = await request('POST', '/learning/sessions', { student_id: studentId, task_type: 'warmup' }, teacherToken);
  assert.equal(teacher.response.status, 403);
});

test('同日领取幂等、答题前不泄露答案、提交后服务端判分', async () => {
  const first = await request('POST', '/learning/sessions', { student_id: studentId, task_type: 'warmup' });
  const second = await request('POST', '/learning/sessions', { student_id: studentId, task_type: 'warmup' });
  assert.equal(first.response.status, 201);
  assert.equal(second.payload.attempt.id, first.payload.attempt.id);
  assert.equal(first.payload.attempt.questions.length, 5);
  assert.ok(first.payload.attempt.questions.every((item) => item.answer === undefined && item.correct_answer === undefined));

  const row = getDB().get('SELECT questions_json FROM learning_attempts WHERE id=?', [first.payload.attempt.id]);
  const questions = JSON.parse(row.questions_json);
  const submitted = await request('POST', `/learning/sessions/${first.payload.attempt.id}/submit`, {
    answers: questions.map((item) => ({ question_id: item.id, answer: item.answer })),
    elapsed_seconds: 42,
  });
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.payload.attempt.score, 100);
  assert.equal(submitted.payload.attempt.answers.length, 5);
});

test('错题同类练习连续答对两次后标记为已掌握', () => {
  const db = getDB();
  const wrong = db.run(`INSERT INTO wrong_item_progress
    (student_id,source_type,source_id,grade_band,module,question_type,snapshot_stem,snapshot_answer)
    VALUES(?,?,?,?,?,?,?,?)`, [studentId, 'test', 'two-days', '初中', '口算', '有理数加减', '1+1=?', '2']);
  for (const day of ['2026-07-14T09:00:00+08:00', '2026-07-15T09:00:00+08:00']) {
    const attempt = createOrGetAttempt(db, { studentId, parentId, taskType: 'wrong', now: new Date(day) });
    const stored = db.get('SELECT questions_json FROM learning_attempts WHERE id=?', [attempt.id]);
    const questions = JSON.parse(stored.questions_json);
    completeAttempt(db, {
      attemptId: attempt.id,
      answers: questions.map((item) => ({ question_id: item.id, answer: item.answer })),
      elapsedSeconds: 30,
      now: new Date(day),
    });
  }
  const progress = db.get('SELECT * FROM wrong_item_progress WHERE id=?', [wrong.lastInsertRowid]);
  assert.equal(progress.status, 'mastered');
  assert.equal(Number(progress.consecutive_correct), 2);
});

test('成长页生成周报、六枚徽章和匿名分享信息', () => {
  const summary = growthSummary(getDB(), { studentId, now: new Date() });
  assert.equal(summary.badges.length, 6);
  assert.equal(summary.share.anonymous, true);
  assert.ok(summary.report.summary.length > 10);
  assert.ok(getDB().get('SELECT id FROM weekly_reports WHERE student_id=?', [studentId]));
});

test('学习计算题报错支持权限、去重、限频、教师停题与历史快照', async () => {
  const session = await request('POST', '/learning/sessions', { student_id: studentId, task_type: 'basics' });
  assert.equal(session.response.status, 201);
  const questions = session.payload.attempt.questions;
  assert.ok(questions.length >= 6);
  assert.ok(questions.every((item) => String(item.id).startsWith('practice:')));
  const stored = getDB().get('SELECT questions_json FROM learning_attempts WHERE id=?', [session.payload.attempt.id]);
  const storedQuestions = JSON.parse(stored.questions_json);
  const completed = await request('POST', `/learning/sessions/${session.payload.attempt.id}/submit`, {
    answers: storedQuestions.map((item) => ({ question_id: item.id, answer: item.answer })), elapsed_seconds: 60,
  });
  const scoreBeforeReview = Number(completed.payload.attempt.score);
  const reportBody = (question) => ({
    source_type: 'learning_attempt', source_id: session.payload.attempt.id,
    student_id: studentId, question_id: question.id, reason: 'answer_error', detail: '请老师核对',
  });
  const forbidden = await request('POST', '/calculation-reports', reportBody(questions[0]), otherParentToken);
  assert.equal(forbidden.response.status, 403);
  const first = await request('POST', '/calculation-reports', reportBody(questions[0]));
  assert.equal(first.response.status, 201);
  assert.equal(first.payload.report.snapshot_answer, undefined);
  const duplicate = await request('POST', '/calculation-reports', reportBody(questions[0]));
  assert.equal(duplicate.response.status, 200);
  for (const question of questions.slice(1, 5)) {
    const created = await request('POST', '/calculation-reports', reportBody(question));
    assert.equal(created.response.status, 201);
  }
  const limited = await request('POST', '/calculation-reports', reportBody(questions[5]));
  assert.equal(limited.response.status, 429);

  const queue = await request('GET', '/calculation-reports?source_type=learning_attempt&status=pending', undefined, teacherToken);
  const report = queue.payload.reports.find((item) => Number(item.id) === Number(first.payload.report.id));
  assert.ok(report);
  const practiceQuestionId = Number(String(questions[0].id).split(':')[1]);
  const handled = await request('PUT', `/calculation-reports/${report.id}`, {
    status: 'resolved', stop_question: true, teacher_note: '答案需要修正',
  }, teacherToken);
  assert.equal(handled.response.status, 200);
  assert.equal(Number(getDB().get('SELECT is_active FROM practice_questions WHERE id=?', [practiceQuestionId]).is_active), 0);
  assert.ok(Number(handled.payload.report.affected_review_count) >= 1);
  assert.ok(getDB().get(`SELECT id FROM calculation_score_reviews
    WHERE source_type='learning_attempt' AND source_id=? AND bank_question_id=?`, [session.payload.attempt.id, String(practiceQuestionId)]));
  assert.equal(Number(getDB().get('SELECT score FROM learning_attempts WHERE id=?', [session.payload.attempt.id]).score), scoreBeforeReview);
  const historical = await request('GET', `/learning/sessions/${session.payload.attempt.id}`);
  assert.ok(historical.payload.attempt.questions.some((item) => item.id === questions[0].id));
});

test('同题 3 名学生报错生成高优先级提醒，迁班后仅新教师可处理', async () => {
  const db = getDB();
  const klass = db.get("SELECT * FROM classes WHERE name='初一数学'");
  const teacher = db.get("SELECT id FROM users WHERE openid='learning-teacher'");
  const sharedQuestion = { id: 'mental:junior-priority-test', type: '有理数加减', stem: '1 + (−2) = ?', answer: '-1' };
  const { createCalculationReport } = require('../services/calculation-reports');
  let lastReport;
  for (let index = 0; index < 3; index += 1) {
    const parent = db.run('INSERT INTO users(openid,role,nickname) VALUES(?,?,?)', [`priority-parent-${index}`, 'parent', `家长${index}`]);
    const student = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.id, klass.id, `学生${index}`, '初一', `PRIORITY${index}`]);
    db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
    const attempt = db.run(`INSERT INTO learning_attempts
      (student_id,parent_id,task_type,task_title,logical_date,status,battle,questions_json,total_questions,started_at)
      VALUES(?,?,'warmup','优先级测试',?,'active','junior',?,1,?)`, [
      student.lastInsertRowid, parent.lastInsertRowid, `2026-08-0${index + 1}`, JSON.stringify([sharedQuestion]), new Date().toISOString(),
    ]);
    lastReport = createCalculationReport(db, {
      sourceType: 'learning_attempt', sourceId: attempt.lastInsertRowid, sourceQuestionId: sharedQuestion.id,
      studentId: student.lastInsertRowid, parentId: parent.lastInsertRowid, reason: 'sign_bracket',
    }).report;
  }
  assert.ok(db.get("SELECT id FROM teacher_alerts WHERE alert_type='calculation_report_3'"));
  const priority = await request('GET', '/calculation-reports?source_type=learning_attempt&status=pending', undefined, teacherToken);
  assert.ok(priority.payload.reports.some((item) => Number(item.id) === Number(lastReport.id) && item.high_priority));

  const nextTeacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('learning-next-teacher','teacher','新老师')");
  db.run('INSERT INTO user_roles(user_id,role) VALUES(?,?)', [nextTeacher.lastInsertRowid, 'teacher']);
  const nextToken = jwt.sign({ id: nextTeacher.lastInsertRowid, openid: 'learning-next-teacher', role: 'teacher' }, process.env.JWT_SECRET);
  db.run('UPDATE classes SET teacher_id=? WHERE id=?', [nextTeacher.lastInsertRowid, klass.id]);
  const oldQueue = await request('GET', '/calculation-reports?source_type=learning_attempt&status=all', undefined, teacherToken);
  const newQueue = await request('GET', '/calculation-reports?source_type=learning_attempt&status=all', undefined, nextToken);
  assert.ok(!oldQueue.payload.reports.some((item) => Number(item.id) === Number(lastReport.id)));
  assert.ok(newQueue.payload.reports.some((item) => Number(item.id) === Number(lastReport.id)));
});
