const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = path.join(rubbish, `panpan-v2-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `panpan-v2-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `panpan-v2-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `panpan-v2-exams-${suffix}`);
process.env.JWT_SECRET = 'panpan-v2-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
fs.mkdirSync(rubbish, { recursive: true });

const { start } = require('../server');
const { getDB } = require('../db/init');
const { practiceDateAt } = require('../services/practice');

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
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, payload };
}

function createExamAsset(db, kind, name, content) {
  const buffer = Buffer.from(content);
  const sha = crypto.createHash('sha256').update(buffer).digest('hex');
  const storageKey = `${kind}/${sha.slice(0, 2)}/${sha}.pdf`;
  const target = path.join(process.env.EXAM_LIBRARY_DIR, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, buffer);
  return db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`, [kind, storageKey, name, 'application/pdf', buffer.length, sha]).lastInsertRowid;
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('panpan-v2-teacher','teacher','潘潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('panpan-v2-parent','parent','测试家长')");
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('panpan-v2-other-parent','parent','其他家长')");
  const cls = db.run('INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)', [teacher.lastInsertRowid, '优化测试班', '七年级', '数学']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, cls.lastInsertRowid, '完整姓名同学', 'V2TEST']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
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

test('维护模式可远程切换且家长不能操作', async () => {
  const initial = await request('GET', '/system/status');
  assert.equal(initial.response.status, 200);
  assert.equal(initial.payload.maintenance, false);
  const forbidden = await request('PUT', '/system/maintenance', parentToken, { maintenance: true });
  assert.equal(forbidden.response.status, 403);
  const enabled = await request('PUT', '/system/maintenance', teacherToken, {
    maintenance: true,
    title: '短时维护',
    message: '正在升级，请稍后再试。',
    estimated_restore_at: '今晚 22:00',
  });
  assert.equal(enabled.response.status, 200);
  assert.equal(enabled.payload.maintenance, true);
  const status = await request('GET', '/system/status');
  assert.equal(status.payload.title, '短时维护');
  await request('PUT', '/system/maintenance', teacherToken, { maintenance: false });
});

test('家长反馈保留原文与自定义教师回复', async () => {
  const created = await request('POST', '/leaves/feedback', parentToken, { student_id: studentId, content: '希望增加错题讲解。' });
  assert.equal(created.response.status, 200);
  const teacherList = await request('GET', '/leaves', teacherToken);
  const item = teacherList.payload.leaves.find((row) => row.item_type === 'feedback');
  assert.equal(item.student_name, '完整姓名同学');
  assert.equal(item.reason, '希望增加错题讲解。');
  const missingReply = await request('PUT', `/leaves/${item.id}`, teacherToken, { item_type: 'feedback', status: 'approved', reply: '' });
  assert.equal(missingReply.response.status, 400);
  const replied = await request('PUT', `/leaves/${item.id}`, teacherToken, {
    item_type: 'feedback',
    status: 'approved',
    reply: '收到，下周起增加错题讲解。',
  });
  assert.equal(replied.response.status, 200);
  const history = await request('GET', `/leaves/feedback/history?student_id=${studentId}&limit=3`, parentToken);
  assert.equal(history.response.status, 200);
  assert.equal(history.payload.feedbacks[0].content, '希望增加错题讲解。');
  assert.equal(history.payload.feedbacks[0].reply, '收到，下周起增加错题讲解。');
});

test('答案批准后只对匹配家长、学生和试卷开放', async () => {
  const db = getDB();
  const paperAssetId = createExamAsset(db, 'paper', '测试原卷.pdf', '%PDF-1.4\npaper\n%%EOF');
  const answerAssetId = createExamAsset(db, 'answer', '测试答案.pdf', '%PDF-1.4\nanswer\n%%EOF');
  const paper = db.run(`INSERT INTO exam_papers
    (stable_code,display_title,school_name,school_year,exam_year,grade,grade_code,subject_code,semester,semester_code,exam_type,paper_asset_id,answer_asset_id,source_relative_path,license_status,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    'GZ7-V2-ANSWER-TEST', '答案授权测试卷', '测试学校', '2025-2026', 2026, '七年级', 'g7', 'math',
    '上学期', 's1', 'midterm', paperAssetId, answerAssetId, 'test.pdf', 'teacher_provided', 'published',
  ]);
  const blocked = await request('POST', `/exams/${paper.lastInsertRowid}/download`, parentToken, { student_id: studentId, asset_kind: 'answer' });
  assert.equal(blocked.response.status, 201);
  assert.equal(blocked.payload.asset_kind, 'paper');
  const requested = await request('POST', `/exams/${paper.lastInsertRowid}/answer-requests`, parentToken, { student_id: studentId });
  assert.equal(requested.response.status, 201);
  const todos = await request('GET', '/exams/teacher/answer-todos?limit=3', teacherToken);
  assert.equal(todos.payload.count, 1);
  const approved = await request('PUT', `/exams/teacher/answer-requests/${todos.payload.requests[0].id}`, teacherToken, { status: 'sent' });
  assert.equal(approved.response.status, 200);
  const allowed = await request('POST', `/exams/${paper.lastInsertRowid}/download`, parentToken, { student_id: studentId, asset_kind: 'answer' });
  assert.equal(allowed.response.status, 201);
  assert.equal(allowed.payload.asset_kind, 'answer');
  const file = await request('GET', allowed.payload.download_url.replace('/api', ''), parentToken);
  assert.equal(file.response.status, 200);
  const stranger = await request('GET', allowed.payload.download_url.replace('/api', ''), otherParentToken);
  assert.equal(stranger.response.status, 404);
});

test('计划可按学生搜索，并先锁定再重复导出剩余日期 PDF', async () => {
  const start = practiceDateAt();
  const endDate = new Date(`${start}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const created = await request('POST', '/practice/plans', teacherToken, {
    title: '专属 PDF 测试计划',
    class_id: classId,
    start_date: start,
    end_date: endDate.toISOString().slice(0, 10),
    target_minutes: 20,
  });
  assert.equal(created.response.status, 201);
  const searched = await request('GET', `/practice/plans?keyword=${encodeURIComponent('完整姓名')}`, teacherToken);
  assert.equal(searched.response.status, 200);
  assert.equal(searched.payload.plans[0].id, created.payload.plan.id);
  const settingsBefore = await request('GET', `/practice/plans/${created.payload.plan.id}/settings`, teacherToken);
  assert.equal(settingsBefore.response.status, 200);
  assert.equal(settingsBefore.payload.settings[0].pdf_frozen, false);
  assert.equal(settingsBefore.payload.settings[0].frozen_assignment_count, 0);
  assert.equal(settingsBefore.payload.settings[0].latest_first_round_ability, null);
  const prematurePdf = await request('GET', `/practice/plans/${created.payload.plan.id}/pdf?student_id=${studentId}`, teacherToken);
  assert.equal(prematurePdf.response.status, 409);
  assert.equal((await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    parentToken,
    {},
  )).response.status, 403);
  const strangerTeacherId = getDB().run(
    "INSERT INTO users(openid,role,nickname) VALUES('panpan-v2-stranger-teacher','teacher','其他老师')",
  ).lastInsertRowid;
  assert.equal((await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    token(strangerTeacherId, 'teacher'),
    {},
  )).response.status, 404);
  assert.equal((await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/999999/freeze-remaining`,
    teacherToken,
    {},
  )).response.status, 404);
  assert.equal((await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    teacherToken,
    { from_date: '2026-02-31' },
  )).response.status, 400);
  const afterEnd = new Date(endDate);
  afterEnd.setUTCDate(afterEnd.getUTCDate() + 1);
  assert.equal((await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    teacherToken,
    { from_date: afterEnd.toISOString().slice(0, 10) },
  )).response.status, 409);

  const frozen = await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    teacherToken,
    { from_date: '2000-01-01' },
  );
  assert.equal(frozen.response.status, 200);
  assert.equal(frozen.payload.from_date, start);
  assert.equal(frozen.payload.pdf_frozen, true);
  assert.equal(frozen.payload.frozen_assignment_count, 2);
  assert.equal(frozen.payload.freeze_ability, null);
  assert.deepEqual(frozen.payload.frozen_dates, [start, endDate.toISOString().slice(0, 10)]);

  const repeated = await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    teacherToken,
    {},
  );
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.payload.already_frozen, true);
  assert.deepEqual(repeated.payload.frozen_dates, frozen.payload.frozen_dates);

  const targetClassId = getDB().run(
    'INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)',
    [teacherId, 'PDF 冻结转班测试组', '七年级', '数学'],
  ).lastInsertRowid;
  const transferred = await request('POST', `/students/${studentId}/transfer`, teacherToken, {
    target_class_id: targetClassId,
    reason: '验证永久冻结题单',
  });
  assert.equal(transferred.response.status, 200);
  assert.equal(transferred.payload.removed_future_assignments, 0);
  assert.equal(Number(getDB().get(`SELECT COUNT(*) count FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND is_frozen=1`, [created.payload.plan.id, studentId]).count), 2);

  const missing = getDB().get(`SELECT id,practice_date FROM practice_assignments
    WHERE plan_id=? AND student_id=? AND is_frozen=1 ORDER BY practice_date DESC LIMIT 1`, [
    created.payload.plan.id,
    studentId,
  ]);
  getDB().run('DELETE FROM practice_assignment_items WHERE assignment_id=?', [missing.id]);
  getDB().run('DELETE FROM practice_assignments WHERE id=?', [missing.id]);
  const incompleteSettings = await request('GET', `/practice/plans/${created.payload.plan.id}/settings`, teacherToken);
  assert.equal(incompleteSettings.response.status, 200);
  assert.equal(incompleteSettings.payload.settings[0].pdf_frozen, false);
  assert.equal(incompleteSettings.payload.settings[0].pdf_freeze_incomplete, true);
  assert.deepEqual(incompleteSettings.payload.settings[0].missing_frozen_dates, [missing.practice_date]);
  const incompletePdf = await request('GET', `/practice/plans/${created.payload.plan.id}/pdf?student_id=${studentId}`, teacherToken);
  assert.equal(incompletePdf.response.status, 409);

  const repaired = await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${studentId}/freeze-remaining`,
    teacherToken,
    { from_date: afterEnd.toISOString().slice(0, 10) },
  );
  assert.equal(repaired.response.status, 200);
  assert.equal(repaired.payload.pdf_frozen, true);
  assert.equal(repaired.payload.already_frozen, false);
  assert.deepEqual(repaired.payload.frozen_dates, frozen.payload.frozen_dates);
  const settingsAfter = await request('GET', `/practice/plans/${created.payload.plan.id}/settings`, teacherToken);
  assert.equal(settingsAfter.payload.settings[0].pdf_frozen, true);
  assert.equal(settingsAfter.payload.settings[0].frozen_assignment_count, 2);
  assert.equal(Number(getDB().get(`SELECT COUNT(*) count FROM operation_logs
    WHERE action='practice_remaining_pdf_frozen' AND entity_id=?`, [created.payload.plan.id]).count), 3);

  const pdf = await request('GET', `/practice/plans/${created.payload.plan.id}/pdf?student_id=${studentId}`, teacherToken);
  assert.equal(pdf.response.status, 200);
  assert.match(pdf.response.headers.get('content-type'), /application\/pdf/);
  assert.equal(pdf.payload.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.payload.length > 5000);
});

test('未冻结学生转班后不能从旧计划首次生成题单', async () => {
  const db = getDB();
  const sourceClassId = db.run(
    'INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)',
    [teacherId, '转班冻结源班', '七年级', '数学'],
  ).lastInsertRowid;
  const targetClassId = db.run(
    'INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)',
    [teacherId, '转班冻结目标班', '七年级', '数学'],
  ).lastInsertRowid;
  const movedStudentId = db.run(
    'INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)',
    [teacherId, sourceClassId, '未冻结转班生', 'V2MOVE'],
  ).lastInsertRowid;
  db.run('INSERT INTO class_students(class_id,student_id) VALUES(?,?)', [sourceClassId, movedStudentId]);
  const start = practiceDateAt();
  const created = await request('POST', '/practice/plans', teacherToken, {
    title: '未冻结转班计划',
    class_id: sourceClassId,
    start_date: start,
    end_date: start,
    target_minutes: 20,
  });
  assert.equal(created.response.status, 201);
  const moved = await request('POST', `/students/${movedStudentId}/transfer`, teacherToken, {
    target_class_id: targetClassId,
    reason: '冻结前转班',
  });
  assert.equal(moved.response.status, 200);
  const settings = await request('GET', `/practice/plans/${created.payload.plan.id}/settings`, teacherToken);
  assert.equal(settings.response.status, 200);
  assert.equal(settings.payload.settings.some((item) => Number(item.student_id) === Number(movedStudentId)), false);
  const blocked = await request(
    'POST',
    `/practice/plans/${created.payload.plan.id}/students/${movedStudentId}/freeze-remaining`,
    teacherToken,
    {},
  );
  assert.equal(blocked.response.status, 409);
});
