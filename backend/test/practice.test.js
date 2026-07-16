const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbish, `practice-test-${process.pid}.db`);
const privateDir = path.join(rubbish, `practice-private-${process.pid}`);
fs.mkdirSync(rubbish, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.PRIVATE_UPLOAD_DIR = privateDir;
process.env.JWT_SECRET = 'practice-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';

const { start } = require('../server');
const { getDB } = require('../db/init');
const { practiceDateAt, generateAssignment } = require('../services/practice');

let server;
let base;
let teacherToken;
let otherTeacherToken;
let parentToken;
let otherParentToken;
let classId;
let otherClassId;
let studentId;
let logicalToday;

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
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, payload };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('practice-teacher','teacher','甲老师')");
  const otherTeacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('practice-teacher-2','teacher','乙老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('practice-parent','parent','甲家长')");
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('practice-parent-2','parent','乙家长')");
  const cls = db.run('INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,?,?,?)', [teacher.lastInsertRowid, '星星班', '数学', '三年级']);
  const otherCls = db.run('INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,?,?,?)', [otherTeacher.lastInsertRowid, '月亮班', '数学', '三年级']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, cls.lastInsertRowid, '小明', 'PRAC01']);
  const otherStudent = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [otherTeacher.lastInsertRowid, otherCls.lastInsertRowid, '小红', 'PRAC02']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [otherParent.lastInsertRowid, otherStudent.lastInsertRowid]);
  teacherToken = token(teacher.lastInsertRowid, 'teacher');
  otherTeacherToken = token(otherTeacher.lastInsertRowid, 'teacher');
  parentToken = token(parent.lastInsertRowid, 'parent');
  otherParentToken = token(otherParent.lastInsertRowid, 'parent');
  classId = cls.lastInsertRowid;
  otherClassId = otherCls.lastInsertRowid;
  studentId = student.lastInsertRowid;
  logicalToday = practiceDateAt();
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
  try { fs.rmSync(privateDir, { recursive: true, force: true }); } catch {}
});

test('每日 01:00 才切换逻辑日', () => {
  assert.equal(practiceDateAt(new Date('2026-07-13T00:59:59+08:00')), '2026-07-12');
  assert.equal(practiceDateAt(new Date('2026-07-13T01:00:00+08:00')), '2026-07-13');
});

test('教师只能给自己的小组创建固定初中计算连续计划', async () => {
  const end = new Date(`${logicalToday}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 4);
  const body = {
    title: '测试五日计划', class_id: classId, start_date: logicalToday, end_date: end.toISOString().slice(0, 10),
    grade_band: '小学', module: '应用题', difficulty: 1, target_minutes: 20, auto_advance: true,
  };
  const forbidden = await request('POST', '/practice/plans/preview', otherTeacherToken, body);
  assert.equal(forbidden.response.status, 400);
  assert.match(forbidden.payload.errors.join(' '), /无权/);

  const preview = await request('POST', '/practice/plans/preview', teacherToken, body);
  assert.equal(preview.response.status, 200);
  assert.equal(preview.payload.days, 5);
  assert.equal(preview.payload.students, 1);
  assert.equal(preview.payload.available_questions, 960);
  assert.equal(preview.payload.guangzhou_questions, 960);
  const invalidDate = await request('POST', '/practice/plans/preview', teacherToken, { ...body, start_date: '2026-02-31' });
  assert.equal(invalidDate.response.status, 400);
  assert.match(invalidDate.payload.errors.join(' '), /日期/);

  const created = await request('POST', '/practice/plans', teacherToken, body);
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.days, 5);
  assert.equal(created.payload.plan.grade_band, '初中');
  assert.equal(created.payload.plan.module, '综合计算');
  assert.equal(created.payload.plan.difficulty, 3);
  assert.equal(created.payload.plan.auto_advance, 0);
  const overlap = await request('POST', '/practice/plans', teacherToken, body);
  assert.equal(overlap.response.status, 409);
});

test('家长并发领取幂等且永不返回答案', async () => {
  const results = await Promise.all(Array.from({ length: 5 }, () =>
    request('GET', `/practice/today?student_id=${studentId}`, parentToken)));
  const ids = new Set(results.map((result) => result.payload.assignment.id));
  assert.equal(ids.size, 1);
  assert.ok(results[0].payload.assignment.items.length >= 8);
  assert.ok(results[0].payload.assignment.estimated_seconds >= 1080 && results[0].payload.assignment.estimated_seconds <= 1320);
  for (const item of results[0].payload.assignment.items) {
    assert.equal(Object.hasOwn(item, 'answer'), false);
    assert.equal(Object.hasOwn(item, 'snapshot_answer'), false);
    assert.equal(Object.hasOwn(item, 'difficulty'), false);
    assert.equal(item.module, '综合计算');
  }
  const count = getDB().get('SELECT COUNT(*) count FROM practice_assignments WHERE student_id=? AND practice_date=?', [studentId, logicalToday]);
  assert.equal(Number(count.count), 1);
  const meta = JSON.parse(getDB().get('SELECT selection_meta FROM practice_assignments WHERE student_id=? AND practice_date=?', [studentId, logicalToday]).selection_meta);
  assert.equal(meta.selected_guangzhou, results[0].payload.assignment.items.length, '每日题单应全部来自固定 960 题计算题库');
  const forbidden = await request('GET', `/practice/today?student_id=${studentId}`, otherParentToken);
  assert.equal(forbidden.response.status, 403);
});

test('打卡照片私有存储，未登录和跨学生跨老师都不可读取', async () => {
  const today = await request('GET', `/practice/today?student_id=${studentId}`, parentToken);
  const assignmentId = today.payload.assignment.id;
  const fakePng = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('fake')]).toString('base64');
  const invalid = await request('POST', `/practice/assignments/${assignmentId}/upload`, parentToken, { base64: fakePng, fileName: 'fake.png' });
  assert.equal(invalid.response.status, 400);
  assert.equal(getDB().get('SELECT id FROM practice_submissions WHERE assignment_id=?', [assignmentId]), null);
  const png = (await sharp({ create: { width: 8, height: 8, channels: 3, background: '#2F7D6B' } }).png().toBuffer()).toString('base64');
  const uploaded = await request('POST', `/practice/assignments/${assignmentId}/upload`, parentToken, {
    base64: png, fileName: 'practice.png', mimeType: 'image/png',
  });
  assert.equal(uploaded.response.status, 201);
  assert.match(uploaded.payload.attachment.url, /^\/api\/private-files\/[a-f0-9]{32}$/);
  const duplicate = await request('POST', `/practice/assignments/${assignmentId}/upload`, parentToken, { base64: png, fileName: 'practice.png' });
  assert.equal(duplicate.payload.idempotent, true);

  const fileUrl = uploaded.payload.attachment.url.replace(/^\/api/, '');
  assert.equal((await request('GET', fileUrl, null)).response.status, 401);
  assert.equal((await request('GET', fileUrl, otherParentToken)).response.status, 404);
  assert.equal((await request('GET', fileUrl, otherTeacherToken)).response.status, 404);
  assert.equal((await request('GET', fileUrl, parentToken)).response.status, 200);
  assert.equal((await request('GET', fileUrl, teacherToken)).response.status, 200);
  const db = getDB();
  const otherParentId = db.get("SELECT id FROM users WHERE openid='practice-parent-2'").id;
  const otherTeacherId = db.get('SELECT teacher_id FROM classes WHERE id=?', [otherClassId]).teacher_id;
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [otherParentId, studentId]);
  db.run('UPDATE students SET class_id=?,teacher_id=? WHERE id=?', [otherClassId, otherTeacherId, studentId]);
  assert.equal((await request('GET', fileUrl, parentToken)).response.status, 200, '原上传家长转班后仍可读');
  assert.equal((await request('GET', fileUrl, teacherToken)).response.status, 200, '原计划老师转班后仍可读');
  assert.equal((await request('GET', fileUrl, otherParentToken)).response.status, 404, '新绑定家长不可读历史照片');
  assert.equal((await request('GET', fileUrl, otherTeacherToken)).response.status, 404, '新老师不可读历史照片');
  db.run('DELETE FROM bindings WHERE parent_id=? AND student_id=?', [otherParentId, studentId]);
  const originalTeacherId = db.get('SELECT teacher_id FROM classes WHERE id=?', [classId]).teacher_id;
  db.run('UPDATE students SET class_id=?,teacher_id=? WHERE id=?', [classId, originalTeacherId, studentId]);
  const originalParentId = db.get("SELECT id FROM users WHERE openid='practice-parent'").id;
  db.run('DELETE FROM bindings WHERE parent_id=? AND student_id=?', [originalParentId, studentId]);
  assert.equal((await request('GET', fileUrl, parentToken)).response.status, 404, '解绑后原家长不可继续读取');
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [originalParentId, studentId]);
});

test('所属教师可完整复核，其他教师不可查看或提交复核', async () => {
  const plans = await request('GET', '/practice/plans', teacherToken);
  const planId = plans.payload.plans[0].id;
  const forbiddenList = await request('GET', `/practice/submissions?plan_id=${planId}`, otherTeacherToken);
  assert.equal(forbiddenList.response.status, 404);
  const list = await request('GET', `/practice/submissions?plan_id=${planId}`, teacherToken);
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.submissions.length, 1);
  const submission = list.payload.submissions[0];
  const todos = await request('GET', '/practice/todos?limit=3', teacherToken);
  assert.equal(todos.response.status, 200);
  assert.equal(todos.payload.count, 1);
  assert.equal(Number(todos.payload.todos[0].submission_id), Number(submission.id));
  assert.equal((await request('GET', '/practice/todos', otherTeacherToken)).payload.count, 0);
  assert.equal(Number(submission.student_id), Number(studentId));
  assert.equal(submission.attachments.length, 1);
  assert.ok(submission.items.every((item) => item.answer));
  const answerSnapshots = getDB().all(`SELECT id,position,snapshot_answer answer FROM practice_assignment_items
    WHERE assignment_id=? ORDER BY position`, [submission.assignment_id]);
  assert.deepEqual(submission.items.map(({ id, position, answer }) => ({ id, position, answer })), answerSnapshots,
    '学生照片必须与该学生当天题单的标准答案一起返回');
  const body = { teacher_note: '已认真完成', results: submission.items.map((item, index) => ({ item_id: item.id, is_correct: index >= 3 })) };
  const forbidden = await request('PUT', `/practice/submissions/${submission.id}/review`, otherTeacherToken, body);
  assert.equal(forbidden.response.status, 404);
  const db = getDB();
  const otherTeacherId = db.get('SELECT teacher_id FROM classes WHERE id=?', [otherClassId]).teacher_id;
  const originalTeacherId = db.get('SELECT teacher_id FROM classes WHERE id=?', [classId]).teacher_id;
  db.run('UPDATE students SET class_id=?,teacher_id=? WHERE id=?', [otherClassId, otherTeacherId, studentId]);
  assert.equal((await request('PUT', `/practice/submissions/${submission.id}/review`, otherTeacherToken, body)).response.status, 404);
  const reviewed = await request('PUT', `/practice/submissions/${submission.id}/review`, teacherToken, body);
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.payload.status, 'reviewed');
  assert.equal((await request('GET', '/practice/todos', teacherToken)).payload.count, 0);
  db.run('UPDATE students SET class_id=?,teacher_id=? WHERE id=?', [classId, originalTeacherId, studentId]);
  const today = await request('GET', `/practice/today?student_id=${studentId}`, parentToken);
  assert.equal(today.payload.assignment.submission.status, 'reviewed');
  const pendingOnly = await request('GET', `/practice/submissions?plan_id=${planId}`, teacherToken);
  assert.equal(pendingOnly.payload.submissions.length, 0);
  const all = await request('GET', `/practice/submissions?plan_id=${planId}&status=all&limit=5`, teacherToken);
  assert.equal(all.payload.submissions.length, 1);
  assert.equal(all.payload.pagination.total, 1);
});

test('固定题库不允许按学生调整模块或难度', async () => {
  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE teacher_id=(SELECT teacher_id FROM classes WHERE id=?) LIMIT 1', [classId]);
  const changed = await request('PUT', `/practice/plans/${plan.id}/students/${studentId}`, teacherToken, {
    module: '乘除法', difficulty: 2, auto_advance: false, is_locked: true,
  });
  assert.equal(changed.response.status, 409);
  assert.match(changed.payload.error, /不支持单独调整/);
  const oldDate = new Date(`${logicalToday}T00:00:00Z`);
  oldDate.setUTCDate(oldDate.getUTCDate() - 4);
  db.run('UPDATE practice_assignments SET practice_date=? WHERE student_id=? AND practice_date=?', [oldDate.toISOString().slice(0, 10), studentId, logicalToday]);
  const next = new Date(`${logicalToday}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const assignment = generateAssignment(db, plan, studentId, next.toISOString().slice(0, 10));
  const items = db.all('SELECT snapshot_module,snapshot_difficulty,estimated_seconds FROM practice_assignment_items WHERE assignment_id=?', [assignment.id]);
  const totalSeconds = items.reduce((sum, item) => sum + Number(item.estimated_seconds), 0);
  assert.ok(totalSeconds >= 1080 && totalSeconds <= 1320, `练习时长应为18-22分钟，实际${totalSeconds}秒`);
  assert.ok(items.every((item) => item.snapshot_module === '综合计算'));
  assert.ok(items.every((item) => Number(item.snapshot_difficulty) === 3));
});

test('五日 PDF 是鉴权后的真 PDF，且跨老师不可导出', async () => {
  const plans = await request('GET', '/practice/plans', teacherToken);
  const planId = plans.payload.plans[0].id;
  assert.equal((await request('GET', `/practice/plans/${planId}/pdf`, null)).response.status, 401);
  assert.equal((await request('GET', `/practice/plans/${planId}/pdf`, otherTeacherToken)).response.status, 404);
  const pdf = await request('GET', `/practice/plans/${planId}/pdf`, teacherToken);
  assert.equal(pdf.response.status, 200);
  assert.match(pdf.response.headers.get('content-type'), /application\/pdf/);
  assert.equal(pdf.payload.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.payload.length > 1000);
});

test('计划不能跨越其他老师的小组', async () => {
  const preview = await request('POST', '/practice/plans/preview', teacherToken, {
    title: '越权计划', class_id: otherClassId, start_date: logicalToday, end_date: logicalToday,
    target_minutes: 20,
  });
  assert.equal(preview.response.status, 400);
});

test('已有绑定或练习历史的学生不能被删除成孤儿数据', async () => {
  const removed = await request('DELETE', `/students/${studentId}`, teacherToken);
  assert.equal(removed.response.status, 409);
  assert.match(removed.payload.error, /不能删除/);
});

test('PDF 源码先输出全部学生练习，最后才统一输出教师答案', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'services', 'practice.js'), 'utf8');
  assert.ok(source.indexOf('items.forEach((item) => writePdfText') < source.indexOf("writePdfText(doc, '教师参考答案'"));
});
