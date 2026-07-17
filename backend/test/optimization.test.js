const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = path.join(rubbish, `optimization-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `optimization-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `optimization-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `optimization-exams-${suffix}`);
process.env.JWT_SECRET = 'optimization-test-secret-that-is-long-enough';
process.env.EXAM_IMPORT_TOKEN = 'optimization-import-token-1234567890-abcdef';
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
let sourceClassId;
let targetClassId;

function token(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

async function request(method, url, authToken, body, headers = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, payload };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('optimization-teacher','teacher','潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('optimization-parent','parent','测试家长')");
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('optimization-parent-2','parent','其他家长')");
  const source = db.run('INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)', [teacher.lastInsertRowid, '原学习小组', '七年级', '数学']);
  const target = db.run('INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)', [teacher.lastInsertRowid, '新学习小组', '七年级', '数学']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, source.lastInsertRowid, '小番', 'OPT001']);
  db.run('INSERT INTO class_students(class_id,student_id) VALUES(?,?)', [source.lastInsertRowid, student.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  teacherId = teacher.lastInsertRowid;
  parentId = parent.lastInsertRowid;
  studentId = student.lastInsertRowid;
  sourceClassId = source.lastInsertRowid;
  targetClassId = target.lastInsertRowid;
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

test('精选周挑战按三类各 20 题固化，家长永远不能读取教师答案', async () => {
  const db = getDB();
  const counts = db.all(`SELECT question_type,COUNT(*) count FROM weekly_challenge_questions GROUP BY question_type`);
  assert.deepEqual(Object.fromEntries(counts.map((item) => [item.question_type, Number(item.count)])), { choice: 20, fill: 20, subjective: 20 });
  const current = await request('GET', `/weekly-challenge/current?student_id=${studentId}`, parentToken);
  assert.equal(current.response.status, 200);
  assert.equal(current.payload.available.choice, 20);
  const created = await request('POST', '/weekly-challenge/assignments', parentToken, { student_id: studentId, question_type: 'choice' });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.assignment.answer_url, null);
  const question = await request('GET', created.payload.assignment.question_url.replace('/api', ''), parentToken);
  assert.equal(question.response.status, 200);
  assert.match(question.response.headers.get('content-type'), /image\/png/);
  const assignment = db.get(`SELECT q.answer_asset_id FROM weekly_challenge_assignments a
    JOIN weekly_challenge_questions q ON q.id=a.question_id WHERE a.id=?`, [created.payload.assignment.id]);
  const hidden = await request('GET', `/weekly-challenge/assets/${assignment.answer_asset_id}`, parentToken);
  assert.equal(hidden.response.status, 404);
});

test('家长拍照提交周挑战后，所属教师可对照答案批阅', async () => {
  const assignment = getDB().get('SELECT id FROM weekly_challenge_assignments WHERE student_id=?', [studentId]);
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  const uploaded = await request('POST', `/weekly-challenge/assignments/${assignment.id}/upload`, parentToken, { base64: image.toString('base64'), fileName: 'answer.jpg' });
  assert.equal(uploaded.response.status, 201);
  const queue = await request('GET', '/weekly-challenge/teacher/submissions?status=submitted', teacherToken);
  assert.equal(queue.payload.submissions.length, 1);
  assert.match(queue.payload.submissions[0].answer_url, /^\/api\/weekly-challenge\/assets\//);
  const reviewed = await request('PUT', `/weekly-challenge/teacher/submissions/${queue.payload.submissions[0].submission.id}/review`, teacherToken, { is_correct: true, teacher_note: '步骤完整' });
  assert.equal(reviewed.response.status, 200);
  const refreshed = await request('GET', `/weekly-challenge/current?student_id=${studentId}`, parentToken);
  assert.equal(refreshed.payload.assignment.submission.status, 'reviewed');
  assert.equal(refreshed.payload.assignment.submission.teacher_note, '步骤完整');
});

test('学生迁移保留绑定和历史，并在原学习小组历史中记录转出', async () => {
  const moved = await request('POST', `/students/${studentId}/transfer`, teacherToken, { target_class_id: targetClassId, reason: '转班' });
  assert.equal(moved.response.status, 200);
  assert.equal(Number(getDB().get('SELECT class_id FROM students WHERE id=?', [studentId]).class_id), Number(targetClassId));
  assert.ok(getDB().get('SELECT id FROM bindings WHERE parent_id=? AND student_id=?', [parentId, studentId]));
  const history = await request('GET', `/classes/${sourceClassId}/history`, teacherToken);
  assert.equal(history.response.status, 200);
  assert.ok(history.payload.timeline.some((item) => item.type === 'transfer' && /转出/.test(item.title)));
  const removeSource = await request('DELETE', `/classes/${sourceClassId}`, teacherToken);
  assert.equal(removeSource.response.status, 200);
  const activeClasses = await request('GET', '/classes', teacherToken);
  assert.ok(!activeClasses.payload.classes.some((item) => Number(item.id) === Number(sourceClassId)));
});

test('真题私有导入、家长原卷下载、教师答案与下载审计形成闭环', async () => {
  const paperBuffer = Buffer.from('private-paper-content');
  const answerBuffer = Buffer.from('private-answer-content');
  const file = (name, buffer) => ({ original_name: name, sha256: crypto.createHash('sha256').update(buffer).digest('hex'), base64: buffer.toString('base64') });
  const imported = await request('POST', '/exams/admin/import-batch', '', {
    metadata: { stable_code: 'GZ7-MID-TEST000001', display_title: '测试中学 · 24–25 · 七上期中', school_name: '测试中学', school_year: '2024-2025', exam_year: 2024, grade: '七年级', exam_type: 'midterm', source_relative_path: 'test/paper.docx' },
    paper: file('paper.docx', paperBuffer), answer: file('answer.docx', answerBuffer),
  }, { 'x-exam-import-token': process.env.EXAM_IMPORT_TOKEN });
  assert.equal(imported.response.status, 200);
  const forbiddenStatus = await request('GET', '/exams/admin/status', '', undefined, { 'x-exam-import-token': 'wrong-token' });
  assert.equal(forbiddenStatus.response.status, 404);
  const list = await request('GET', `/exams?student_id=${studentId}&exam_type=midterm&year_bucket=recent`, parentToken);
  assert.equal(list.payload.papers.length, 1);
  const paper = list.payload.papers[0];
  const requested = await request('POST', `/exams/${paper.id}/download`, parentToken, { student_id: studentId, asset_kind: 'answer' });
  assert.equal(requested.response.status, 201);
  assert.equal(requested.payload.asset_kind, 'paper');
  const downloaded = await request('GET', requested.payload.download_url.replace('/api', ''), parentToken);
  assert.deepEqual(downloaded.payload, paperBuffer);
  const answerAssetId = getDB().get('SELECT answer_asset_id FROM exam_papers WHERE id=?', [paper.id]).answer_asset_id;
  const hiddenAnswer = await request('GET', `/exams/assets/${answerAssetId}?student_id=${studentId}`, parentToken);
  assert.equal(hiddenAnswer.response.status, 404);
  const answerRequest = await request('POST', `/exams/${paper.id}/answer-requests`, parentToken, { student_id: studentId });
  assert.equal(answerRequest.response.status, 201);
  const activity = await request('GET', '/exams/teacher/activity', teacherToken);
  assert.equal(activity.payload.requests.length, 1);
  assert.equal(activity.payload.downloads.length, 1);
  const unrelated = await request('GET', `/exams?student_id=${studentId}`, otherParentToken);
  assert.equal(unrelated.response.status, 403);
});
