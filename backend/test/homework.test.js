const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `homework-test-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let parentToken;

async function request(method, url, token, body) {
  const response = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('teacher-test','teacher','测试老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('parent-test','parent','测试家长')");
  const cls = db.run("INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,?,?,?)", [teacher.lastInsertRowid, '测试班', '数学', '三年级']);
  const student = db.run("INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)", [teacher.lastInsertRowid, cls.lastInsertRowid, '小明', 'TEST01']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'teacher-test', role: 'teacher' }, process.env.JWT_SECRET);
  parentToken = jwt.sign({ id: parent.lastInsertRowid, openid: 'parent-test', role: 'parent' }, process.env.JWT_SECRET);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('人工确认后的单学生作业可以幂等发布并被家长查看', async () => {
  const students = await request('GET', '/students', teacherToken);
  const studentId = students.payload.students[0].id;
  const body = {
    title: '口算练习', subject: '数学', assigned_date: '2026-07-12',
    idempotency_key: 'test-batch-key', prompt_version: 'manual-chatgpt-v1',
    submissions: [{
      student_id: studentId, points_delta: 1, answers: [{
        question_no: '1', student_answer: '42', is_correct: true, wrong_step: '',
        error_type: '', comment: '计算正确', confidence: 0.98,
        teacher_status: 'confirmed', teacher_note: '', question_image_url: '/uploads/test.jpg',
      }],
    }],
  };
  const preview = await request('POST', '/homework/preview', teacherToken, body);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.payload.students, 1);

  const created = await request('POST', '/homework/batches', teacherToken, body);
  assert.equal(created.response.status, 201);
  const duplicate = await request('POST', '/homework/batches', teacherToken, body);
  assert.equal(duplicate.payload.idempotent, true);
  assert.equal(duplicate.payload.batch_id, created.payload.batch_id);

  const published = await request('POST', `/homework/batches/${created.payload.batch_id}/publish`, teacherToken, {
    confirmation: '确认发布 1 名学生', send_notifications: false,
  });
  assert.equal(published.response.status, 200);
  assert.equal(published.payload.status, 'published');

  const list = await request('GET', `/homework/parent?student_id=${studentId}`, parentToken);
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.batches.length, 1);
  assert.equal(list.payload.point_balance, 1);
});

test('未人工确认的题目不能创建批次', async () => {
  const students = await request('GET', '/students', teacherToken);
  const studentId = students.payload.students[0].id;
  const rejected = await request('POST', '/homework/preview', teacherToken, {
    title: '待复核', assigned_date: '2026-07-12', idempotency_key: 'rejected-key',
    submissions: [{ student_id: studentId, answers: [{
      question_no: '1', student_answer: '', is_correct: false, wrong_step: '', error_type: '无法辨认',
      comment: '', confidence: 0.2, teacher_status: 'rejected', teacher_note: '需复核',
    }] }],
  });
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.payload.errors.join(' '), /尚未人工确认/);
});
