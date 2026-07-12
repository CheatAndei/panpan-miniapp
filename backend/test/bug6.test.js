const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `bug6-test-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'bug6-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.APP_ID = '';
process.env.APP_SECRET = '';
process.env.TPL_CHECKIN = '';

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let otherTeacherToken;
let studentId;

async function post(url, token, body) {
  const response = await fetch(base + url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('bug6-teacher','teacher','测试老师')");
  const other = db.run("INSERT INTO users(openid,role,nickname) VALUES('bug6-other','teacher','其他老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('bug6-parent','parent','测试家长')");
  const cls = db.run("INSERT INTO classes(teacher_id,name) VALUES(?,?)", [teacher.lastInsertRowid, '测试班']);
  const student = db.run("INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)", [teacher.lastInsertRowid, cls.lastInsertRowid, '小明', 'BUG601']);
  studentId = student.lastInsertRowid;
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, studentId]);
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'bug6-teacher', role: 'teacher' }, process.env.JWT_SECRET);
  otherTeacherToken = jwt.sign({ id: other.lastInsertRowid, openid: 'bug6-other', role: 'teacher' }, process.env.JWT_SECRET);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('所属老师可以向未到学生发送提醒', async () => {
  const result = await post('/checkins/remind-arrival', teacherToken, { studentId, classDate: '2026-07-12' });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.ok, true);
});

test('其他老师不能向不属于自己的学生发送提醒', async () => {
  const result = await post('/checkins/remind-arrival', otherTeacherToken, { studentId, classDate: '2026-07-12' });
  assert.equal(result.response.status, 403);
});
