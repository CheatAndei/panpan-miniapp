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

test('学习闭环迁移可重复执行且五张表完整存在', () => {
  runMigrations();
  runMigrations();
  const db = getDB();
  for (const table of ['learning_attempts', 'wrong_item_progress', 'achievement_awards', 'weekly_reports', 'engagement_events']) {
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
