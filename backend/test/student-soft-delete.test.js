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
process.env.DATABASE_PATH = path.join(rubbish, `student-soft-delete-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `student-soft-delete-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `student-soft-delete-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `student-soft-delete-exams-${suffix}`);
process.env.JWT_SECRET = 'student-soft-delete-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
fs.mkdirSync(rubbish, { recursive: true });

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let parentToken;
let otherParentToken;
let teacherId;
let parentId;
let studentId;
let classId;

function token(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

async function request(method, url, authToken, body) {
  const response = await fetch(base + url, {
    method,
    headers: {
      connection: 'close',
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('soft-delete-teacher','teacher','潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('soft-delete-parent','parent','测试家长')");
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('soft-delete-parent-2','parent','其他家长')");
  const cls = db.run('INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)', [teacher.lastInsertRowid, '软删除测试班', '七年级', '数学']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, cls.lastInsertRowid, '小番', 'DEL001']);
  db.run('INSERT INTO class_students(class_id,student_id) VALUES(?,?)', [cls.lastInsertRowid, student.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  db.run("INSERT INTO checkins(student_id,class_date,status) VALUES(?,?,?)", [student.lastInsertRowid, '2030-01-01', 'checked_in']);
  teacherId = teacher.lastInsertRowid;
  parentId = parent.lastInsertRowid;
  studentId = student.lastInsertRowid;
  classId = cls.lastInsertRowid;
  teacherToken = token(teacherId, 'teacher');
  parentToken = token(parentId, 'parent');
  otherParentToken = token(otherParent.lastInsertRowid, 'parent');
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const target of [process.env.DATABASE_PATH, process.env.UPLOAD_DIR, process.env.PRIVATE_UPLOAD_DIR, process.env.EXAM_LIBRARY_DIR]) {
    try { fs.rmSync(target, { recursive: true, force: true }); } catch {}
  }
});

test('有绑定和历史的学生可软删除，两端隐藏且原记录完整保留', async () => {
  const beforeTeacher = await request('GET', `/students?class_id=${classId}`, teacherToken);
  const beforeParent = await request('GET', '/bind/students', parentToken);
  assert.ok(beforeTeacher.payload.students.some((item) => Number(item.id) === Number(studentId)));
  assert.ok(beforeParent.payload.students.some((item) => Number(item.id) === Number(studentId)));

  const removed = await request('DELETE', `/students/${studentId}`, teacherToken);
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.payload, { ok: true, archived: true });

  const db = getDB();
  const archived = db.get('SELECT id,name,deleted_at,deleted_by FROM students WHERE id=?', [studentId]);
  assert.equal(archived.name, '小番');
  assert.ok(archived.deleted_at);
  assert.equal(Number(archived.deleted_by), Number(teacherId));
  assert.ok(db.get('SELECT id FROM bindings WHERE parent_id=? AND student_id=?', [parentId, studentId]));
  assert.ok(db.get('SELECT id FROM class_students WHERE class_id=? AND student_id=?', [classId, studentId]));
  assert.ok(db.get('SELECT id FROM checkins WHERE student_id=?', [studentId]));
  const log = db.get("SELECT * FROM operation_logs WHERE action='student_archived' AND entity_id=?", [studentId]);
  assert.ok(log);
  assert.equal(JSON.parse(log.detail).history_preserved, true);

  const afterTeacher = await request('GET', `/students?class_id=${classId}`, teacherToken);
  const afterParent = await request('GET', '/bind/students', parentToken);
  const parentDetail = await request('GET', `/students/${studentId}`, parentToken);
  assert.ok(!afterTeacher.payload.students.some((item) => Number(item.id) === Number(studentId)));
  assert.ok(!afterParent.payload.students.some((item) => Number(item.id) === Number(studentId)));
  assert.equal(parentDetail.payload.student, null);

  const parentTask = await request('GET', `/practice/today?student_id=${studentId}`, parentToken);
  const teacherAction = await request('POST', '/checkins/check-in', teacherToken, {
    studentId, classDate: '2030-01-02', studentName: '小番',
  });
  const rebind = await request('POST', '/bind', otherParentToken, { invite_code: 'DEL001' });
  assert.equal(parentTask.response.status, 403);
  assert.equal(teacherAction.response.status, 403);
  assert.equal(rebind.response.status, 404);

  const classes = await request('GET', '/classes', teacherToken);
  assert.equal(Number(classes.payload.classes.find((item) => Number(item.id) === Number(classId)).student_count), 0);
  const duplicate = await request('DELETE', `/students/${studentId}`, teacherToken);
  assert.equal(duplicate.response.status, 404);
});

