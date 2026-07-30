const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.DATABASE_PATH = path.join(rubbish, `practice-grade-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `practice-grade-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `practice-grade-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `practice-grade-exams-${suffix}`);
process.env.JWT_SECRET = 'practice-grade-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
fs.mkdirSync(rubbish, { recursive: true });

const { start } = require('../server');
const { getDB } = require('../db/init');
const { importQuestionDataset, validateQuestionDataset } = require('../services/practice-question-import');
const { generateAssignment } = require('../services/practice');
const g8Dataset = require('../resources/practice/g8-calculation-v1');

let server;
let base;
let teacherToken;
let teacherId;
let g7ClassId;
let g8ClassId;
let g7StudentId;
let g8StudentId;

async function request(method, url, body) {
  const response = await fetch(base + url, {
    method,
    headers: {
      authorization: `Bearer ${teacherToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => (server.listening ? resolve() : server.once('listening', resolve)));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  assert.deepEqual(validateQuestionDataset(g8Dataset).errors, []);
  assert.equal(importQuestionDataset(db, g8Dataset, { dryRun: false }).inserted, 480);
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('practice-grade-teacher','teacher','潘老师')");
  db.run("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'teacher')", [teacher.lastInsertRowid]);
  const g7Class = db.run(`INSERT INTO classes(teacher_id,name,grade,subject)
    VALUES(?,?,'七年级','数学')`, [teacher.lastInsertRowid, '七年级打卡班']);
  const g8Class = db.run(`INSERT INTO classes(teacher_id,name,grade,subject)
    VALUES(?,?,'八年级','数学')`, [teacher.lastInsertRowid, '八年级打卡班']);
  const g7Student = db.run(`INSERT INTO students(teacher_id,class_id,name,grade,invite_code)
    VALUES(?,?,?,'七年级','PGI001')`, [teacher.lastInsertRowid, g7Class.lastInsertRowid, '初一同学']);
  const g8Student = db.run(`INSERT INTO students(teacher_id,class_id,name,grade,invite_code)
    VALUES(?,?,?,'八年级','PGI002')`, [teacher.lastInsertRowid, g8Class.lastInsertRowid, '初二同学']);
  teacherId = Number(teacher.lastInsertRowid);
  g7ClassId = Number(g7Class.lastInsertRowid);
  g8ClassId = Number(g8Class.lastInsertRowid);
  g7StudentId = Number(g7Student.lastInsertRowid);
  g8StudentId = Number(g8Student.lastInsertRowid);
  teacherToken = jwt.sign({ id: teacherId, role: 'teacher' }, process.env.JWT_SECRET, { algorithm: 'HS256' });
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const target of [
    process.env.DATABASE_PATH,
    process.env.UPLOAD_DIR,
    process.env.PRIVATE_UPLOAD_DIR,
    process.env.EXAM_LIBRARY_DIR,
  ]) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
  }
});

test('打卡题库目录按班级年级返回，八年级四类各 120 题', async () => {
  const g7 = await request('GET', `/content-progress/practice-catalog?class_id=${g7ClassId}`);
  const g8 = await request('GET', `/content-progress/practice-catalog?class_id=${g8ClassId}`);
  assert.equal(g7.response.status, 200);
  assert.equal(g7.payload.class.grade_code, 'g7');
  assert.ok(g7.payload.topics.every((topic) => !topic.key.startsWith('g8_')));
  assert.equal(g8.response.status, 200);
  assert.equal(g8.payload.class.grade_code, 'g8');
  assert.deepEqual(g8.payload.default_topic_keys, [
    'g8_powers',
    'g8_polynomial_multiplication',
    'g8_multiplication_formulas',
    'g8_factorization',
  ]);
  assert.equal(g8.payload.total_questions, 480);
  assert.ok(g8.payload.topics.every((topic) => topic.question_count === 120));
});

test('新计划继承班级年级，生成题目严格同年级，班级改年级不改历史计划', async () => {
  const body = {
    class_id: g8ClassId,
    title: '初二计算打卡',
    start_date: '2099-01-01',
    end_date: '2099-01-03',
    target_minutes: 20,
    topic_keys: ['g8_powers'],
  };
  const preview = await request('POST', '/practice/plans/preview', body);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.payload.available_questions, 120);
  const created = await request('POST', '/practice/plans', body);
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.plan.grade_code, 'g8');

  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE id=?', [created.payload.plan.id]);
  const assignment = generateAssignment(db, plan, g8StudentId, '2099-01-01');
  const grades = db.all(`SELECT DISTINCT q.grade_code FROM practice_assignment_items i
    JOIN practice_questions q ON q.id=i.question_id WHERE i.assignment_id=?`, [assignment.id]);
  assert.deepEqual(grades.map((row) => row.grade_code), ['g8']);

  const g7Question = db.get(`SELECT * FROM practice_questions
    WHERE grade_code='g7' AND is_active=1 ORDER BY id LIMIT 1`);
  assert.throws(() => db.run(`INSERT INTO practice_assignment_items
    (assignment_id,question_id,position,snapshot_stem,snapshot_answer,snapshot_module,
      snapshot_type,snapshot_difficulty,estimated_seconds,signature,template_key)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
    assignment.id, g7Question.id, 99, g7Question.stem, g7Question.answer, g7Question.module,
    g7Question.question_type, g7Question.difficulty, g7Question.estimated_seconds,
    `${g7Question.signature}-cross-grade`, g7Question.template_key,
  ]), /年级与计划不一致/);

  db.run("UPDATE classes SET grade='七年级' WHERE id=?", [g8ClassId]);
  assert.equal(db.get('SELECT grade_code FROM practice_plans WHERE id=?', [plan.id]).grade_code, 'g8');
});

test('七年级计划继续只使用七年级题库', async () => {
  const created = await request('POST', '/practice/plans', {
    class_id: g7ClassId,
    title: '初一计算打卡',
    start_date: '2099-02-01',
    end_date: '2099-02-02',
    target_minutes: 20,
    topic_keys: ['rational_numbers', 'absolute_value'],
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.plan.grade_code, 'g7');
  const db = getDB();
  const assignment = generateAssignment(
    db,
    db.get('SELECT * FROM practice_plans WHERE id=?', [created.payload.plan.id]),
    g7StudentId,
    '2099-02-01',
  );
  const grades = db.all(`SELECT DISTINCT q.grade_code FROM practice_assignment_items i
    JOIN practice_questions q ON q.id=i.question_id WHERE i.assignment_id=?`, [assignment.id]);
  assert.deepEqual(grades.map((row) => row.grade_code), ['g7']);
});
