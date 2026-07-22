const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `homework-test-${process.pid}.db`);
const privateDir = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `homework-private-${process.pid}`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.PRIVATE_UPLOAD_DIR = privateDir;

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let parentToken;
let secondParentToken;

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
  const secondParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('parent-test-2','parent','第二位家长')");
  const cls = db.run("INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,?,?,?)", [teacher.lastInsertRowid, '测试班', '数学', '三年级']);
  const student = db.run("INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)", [teacher.lastInsertRowid, cls.lastInsertRowid, '小明', 'TEST01']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [secondParent.lastInsertRowid, student.lastInsertRowid]);
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'teacher-test', role: 'teacher' }, process.env.JWT_SECRET);
  parentToken = jwt.sign({ id: parent.lastInsertRowid, openid: 'parent-test', role: 'parent' }, process.env.JWT_SECRET);
  secondParentToken = jwt.sign({ id: secondParent.lastInsertRowid, openid: 'parent-test-2', role: 'parent' }, process.env.JWT_SECRET);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.rmSync(privateDir, { recursive: true, force: true }); } catch {}
});

test('人工确认后的单学生作业可以幂等发布并被家长查看', async () => {
  const students = await request('GET', '/students', teacherToken);
  const studentId = students.payload.students[0].id;
  const externalStudentId = students.payload.students[0].external_student_id;
  assert.match(externalStudentId, /^stu_[a-f0-9]{32}$/);
  const image = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  const uploaded = await request('POST', '/homework/upload-image', teacherToken, {
    external_student_id: externalStudentId,
    base64: image.toString('base64'), fileName: 'question.jpg', purpose: 'homework_question',
  });
  assert.equal(uploaded.response.status, 201);
  assert.match(uploaded.payload.url, /^\/api\/private-files\/[a-f0-9]{32}$/);
  assert.match(uploaded.payload.sha256, /^[a-f0-9]{64}$/);
  const fileUrl = base.replace(/\/api$/, '') + uploaded.payload.url;
  assert.equal((await fetch(fileUrl)).status, 401);
  assert.equal((await fetch(fileUrl, { headers: { Authorization: `Bearer ${parentToken}` } })).status, 404);
  assert.equal((await fetch(fileUrl, { headers: { Authorization: `Bearer ${teacherToken}` } })).status, 200);
  const body = {
    title: '口算练习', subject: '数学', assigned_date: '2026-07-12',
    idempotency_key: '', prompt_version: 'manual-chatgpt-v1',
    submissions: [{
      external_student_id: externalStudentId, points_delta: 1,
      processed_image_urls: [uploaded.payload.url], processed_image_sha256s: [uploaded.payload.sha256],
      answers: [{
        question_no: '1', student_answer: '42', is_correct: true, wrong_step: '',
        error_type: '', comment: '计算正确', confidence: 0.98,
        teacher_status: 'confirmed', teacher_note: '', question_image_url: uploaded.payload.url,
        question_image_sha256: uploaded.payload.sha256,
      }],
    }],
  };
  const { batchPayloadDigest } = require('../routes/homework')._test;
  body.payload_digest = batchPayloadDigest(body);
  body.idempotency_key = body.payload_digest;
  const preview = await request('POST', '/homework/preview', teacherToken, body);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.payload.students, 1);

  const created = await request('POST', '/homework/batches', teacherToken, body);
  assert.equal(created.response.status, 201);
  assert.equal((await fetch(fileUrl, { headers: { Authorization: `Bearer ${parentToken}` } })).status, 404);
  const duplicate = await request('POST', '/homework/batches', teacherToken, body);
  assert.equal(duplicate.payload.idempotent, true);
  assert.equal(duplicate.payload.batch_id, created.payload.batch_id);

  const published = await request('POST', `/homework/batches/${created.payload.batch_id}/publish`, teacherToken, {
    confirmation: '确认发布 1 名学生', send_notifications: false,
  });
  assert.equal(published.response.status, 200);
  assert.equal(published.payload.status, 'published');
  assert.equal((await fetch(fileUrl, { headers: { Authorization: `Bearer ${parentToken}` } })).status, 200);

  const primaryNotices = await request('GET', '/homework/notices?unread=1&limit=10', parentToken);
  const secondNotices = await request('GET', '/homework/notices?unread=1&limit=10', secondParentToken);
  assert.equal(primaryNotices.response.status, 200);
  assert.equal(primaryNotices.payload.total, 1);
  assert.equal(primaryNotices.payload.notices[0].student_name, '小明');
  assert.equal(primaryNotices.payload.notices[0].title, '口算练习');
  assert.equal(secondNotices.payload.total, 1);

  const seen = await request('POST', '/homework/notices/seen', parentToken, {
    notice_ids: primaryNotices.payload.notices.map(item => item.id),
  });
  assert.equal(seen.response.status, 200);
  assert.equal(seen.payload.seen, 1);
  assert.equal((await request('GET', '/homework/notices?unread=1', parentToken)).payload.total, 0);
  assert.equal((await request('GET', '/homework/notices?unread=1', secondParentToken)).payload.total, 1);

  const changed = structuredClone(body);
  changed.submissions[0].answers[0].comment = '同一幂等键下被修改的评语';
  const conflict = await request('POST', '/homework/batches', teacherToken, changed);
  assert.equal(conflict.response.status, 409);
  assert.match(conflict.payload.error, /幂等键/);

  const list = await request('GET', `/homework/parent?student_id=${studentId}`, parentToken);
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.batches.length, 1);
  assert.equal(list.payload.point_balance, 1);

  const detail = await request('GET', `/homework/batches/${created.payload.batch_id}`, teacherToken);
  assert.equal(detail.payload.submissions[0].external_student_id, externalStudentId);
  assert.equal(detail.payload.submissions[0].answers[0].question_image_url, uploaded.payload.url);
});

test('批次持久化中途失败会回滚整个批次', () => {
  const { persistBatch } = require('../routes/homework')._test;
  const db = getDB();
  const before = Number(db.get('SELECT COUNT(*) count FROM homework_batches').count);
  assert.throws(() => persistBatch(db, 1, {
    title: '应回滚', subject: '数学', assigned_date: '2026-07-13',
    prompt_version: 'manual-chatgpt-v1', source_manifest: {}, idempotency_key: 'rollback-key',
  }, [{ student_id: 1, answers: [null] }], 'server-digest'));
  const after = Number(db.get('SELECT COUNT(*) count FROM homework_batches').count);
  assert.equal(after, before);
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

test('统一学生 ID 不能用于跨老师导入，也不能与内部 ID 混配', async () => {
  const db = getDB();
  const otherTeacher = db.run("INSERT INTO users(openid,role) VALUES('other-homework-teacher','teacher')");
  const otherClass = db.run('INSERT INTO classes(teacher_id,name) VALUES(?,?)', [otherTeacher.lastInsertRowid, '其他班']);
  const otherStudent = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [otherTeacher.lastInsertRowid, otherClass.lastInsertRowid, '其他学生', 'OTHER1']);
  const otherExternalId = db.get('SELECT external_id FROM students WHERE id=?', [otherStudent.lastInsertRowid]).external_id;

  const rejected = await request('POST', '/homework/preview', teacherToken, {
    title: '越权导入', assigned_date: '2026-07-12', idempotency_key: 'external-id-scope',
    submissions: [{ external_student_id: otherExternalId, student_id: 1, answers: [{
      question_no: '1', is_correct: true, confidence: 1, teacher_status: 'confirmed'
    }] }]
  });
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.payload.errors.join(' '), /不属于当前老师/);
});
