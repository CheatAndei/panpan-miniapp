const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const sharp = require('sharp');

const rubbish = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const suffix = process.pid;
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.DATABASE_PATH = path.join(rubbish, `weekend-mastery-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `weekend-mastery-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `weekend-mastery-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `weekend-mastery-exams-${suffix}`);
process.env.JWT_SECRET = 'weekend-mastery-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
fs.mkdirSync(rubbish, { recursive: true });

const { start } = require('../server');
const { getDB } = require('../db/init');
const {
  normalizeManifest,
  resetNowProviderForTests,
  seedWeekendMastery,
  setNowProviderForTests,
  weekendCycleAt,
} = require('../services/weekend-mastery');
const defaultManifest = require('../resources/weekend-mastery/g7-two-weeks-v1');

let server;
let origin;
let base;
let teacherToken;
let parentToken;
let otherParentToken;
let studentId;

function token(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

async function request(method, url, authToken, body, capabilities = 'weekend-mastery-v1') {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      ...(capabilities ? { 'x-panpan-client-capabilities': capabilities } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : {} };
}

function latestSubmission(db, assignmentId) {
  return db.get(`SELECT * FROM weekend_mastery_submissions
    WHERE assignment_id=? ORDER BY attempt_no DESC,id DESC LIMIT 1`, [assignmentId]);
}

async function upload(assignmentId, buffer, complete = false) {
  return request(
    'POST',
    `/weekend-mastery/assignments/${assignmentId}/upload?upload_complete=${complete ? 1 : 0}`,
    parentToken,
    { base64: buffer.toString('base64'), fileName: `answer-${Date.now()}.jpg` },
  );
}

test.before(async () => {
  setNowProviderForTests(() => new Date('2026-08-07T01:00:00+08:00'));
  server = await start();
  await new Promise((resolve) => (server.listening ? resolve() : server.once('listening', resolve)));
  origin = `http://127.0.0.1:${server.address().port}`;
  base = `${origin}/api`;
  const db = getDB();
  seedWeekendMastery(db);
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('wm-teacher','teacher','潘老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('wm-parent','parent','严木家长')");
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('wm-other-parent','parent','其他家长')");
  for (const [id, role] of [
    [teacher.lastInsertRowid, 'teacher'],
    [parent.lastInsertRowid, 'parent'],
    [otherParent.lastInsertRowid, 'parent'],
  ]) db.run('INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,?)', [id, role]);
  const cls = db.run('INSERT INTO classes(teacher_id,name,grade,subject) VALUES(?,?,?,?)', [
    teacher.lastInsertRowid, '七年级数学', '七年级', '数学',
  ]);
  const student = db.run(`INSERT INTO students(teacher_id,class_id,name,grade,invite_code)
    VALUES(?,?,?,?,?)`, [teacher.lastInsertRowid, cls.lastInsertRowid, '严木', '七年级', 'WM001']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  teacherToken = token(teacher.lastInsertRowid, 'teacher');
  parentToken = token(parent.lastInsertRowid, 'parent');
  otherParentToken = token(otherParent.lastInsertRowid, 'parent');
  studentId = student.lastInsertRowid;
});

test.after(async () => {
  resetNowProviderForTests();
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

test('上海时间周五 01:00 切题，周一 01:00 关闭压轴门禁', () => {
  assert.equal(weekendCycleAt(new Date('2026-08-07T00:59:59+08:00')).cycle_start, '2026-07-31');
  assert.equal(weekendCycleAt(new Date('2026-08-07T00:59:59+08:00')).gate_active, false);
  assert.equal(weekendCycleAt(new Date('2026-08-07T01:00:00+08:00')).cycle_start, '2026-08-07');
  assert.equal(weekendCycleAt(new Date('2026-08-07T01:00:00+08:00')).gate_active, true);
  assert.equal(weekendCycleAt(new Date('2026-08-10T00:59:59+08:00')).gate_active, true);
  assert.equal(weekendCycleAt(new Date('2026-08-10T01:00:00+08:00')).gate_active, false);
  assert.equal(weekendCycleAt(new Date('2026-08-14T01:00:00+08:00')).cycle_start, '2026-08-14');
});

test('发布清单拒绝未知题面结构，避免学生端静默空白', () => {
  const invalidManifest = JSON.parse(JSON.stringify(defaultManifest));
  invalidManifest.sets[0].questions[0].render.sections[0].type = 'question_screenshot';
  assert.throws(() => normalizeManifest(invalidManifest), /题干结构无效/);
});

test('两关状态机、答案隔离、批错恢复门禁与双通过海报条件', async () => {
  const initial = await request('GET', `/weekend-mastery/current?student_id=${studentId}`, parentToken);
  assert.equal(initial.response.status, 200);
  assert.equal(initial.payload.available, true);
  assert.equal(initial.payload.cycle_start, '2026-08-07');
  assert.equal(initial.payload.student_name, '严木');
  assert.deepEqual(initial.payload.stages, []);
  assert.equal(initial.payload.gate.allowed, false);
  assert.equal(initial.payload.gate.reason, 'stage1_not_passed');
  assert.equal(JSON.stringify(initial.payload).includes('"answer"'), false);
  assert.equal(JSON.stringify(initial.payload).includes('"solution"'), false);

  const terminalBlocked = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(terminalBlocked.response.status, 423);
  assert.equal(terminalBlocked.payload.code, 'WEEKEND_MASTERY_REQUIRED');
  const legacyClientAllowed = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken, undefined, '',
  );
  assert.equal(legacyClientAllowed.response.status, 200);

  const first = await request('POST', '/weekend-mastery/assignments', parentToken, { student_id: studentId });
  assert.equal(first.response.status, 201);
  assert.equal(first.payload.assignment.stage, 1);
  const repeatedFirst = await request('POST', '/weekend-mastery/assignments', parentToken, { student_id: studentId });
  assert.equal(repeatedFirst.payload.assignment.id, first.payload.assignment.id);

  const prematureAdvance = await request(
    'POST', `/weekend-mastery/assignments/${first.payload.assignment.id}/advance`, parentToken, {},
  );
  assert.equal(prematureAdvance.response.status, 409);
  assert.equal(prematureAdvance.payload.code, 'WEEKEND_MASTERY_STAGE_ONE_REQUIRED');

  const imageOne = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
  const imageTwo = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#ddeeff' } }).jpeg().toBuffer();
  const imageThree = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#ffeedd' } }).jpeg().toBuffer();
  const imageFour = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#ddffee' } }).jpeg().toBuffer();

  const firstUpload = await upload(first.payload.assignment.id, imageOne);
  assert.equal(firstUpload.response.status, 201);
  const privateUrl = firstUpload.payload.attachment.url;
  const draftHiddenFromAllQueue = await request(
    'GET', '/weekend-mastery/teacher/submissions?status=all', teacherToken,
  );
  assert.equal(draftHiddenFromAllQueue.payload.count, 0);
  assert.deepEqual(draftHiddenFromAllQueue.payload.submissions, []);
  const submittedFirst = await request(
    'POST', `/weekend-mastery/assignments/${first.payload.assignment.id}/submit`, parentToken,
    { student_note: '先求中点。' },
  );
  assert.equal(submittedFirst.payload.assignment.status, 'submitted');

  const queueWithAnswer = await request('GET', '/weekend-mastery/teacher/submissions?status=submitted', teacherToken);
  assert.equal(queueWithAnswer.payload.count, 1);
  assert.ok(queueWithAnswer.payload.submissions[0].question.answer);
  assert.ok(queueWithAnswer.payload.submissions[0].question.solution);
  const firstSubmissionId = queueWithAnswer.payload.submissions[0].submission.id;
  const firstWrong = await request(
    'PUT', `/weekend-mastery/teacher/submissions/${firstSubmissionId}/review`, teacherToken,
    { is_correct: false, teacher_note: '请补写分类过程。' },
  );
  assert.equal(firstWrong.payload.is_correct, false);
  assert.equal(firstWrong.payload.poster_ready, false);

  const correctionBeforeUpload = await request('GET', `/weekend-mastery/current?student_id=${studentId}`, parentToken);
  assert.equal(correctionBeforeUpload.payload.current_assignment.correction_note, '请补写分类过程。');

  await upload(first.payload.assignment.id, imageTwo);
  const correctionDraft = await request('GET', `/weekend-mastery/current?student_id=${studentId}`, parentToken);
  assert.equal(correctionDraft.payload.current_assignment.correction_note, '请补写分类过程。');
  assert.equal(correctionDraft.payload.current_assignment.submission.status, 'draft');
  assert.equal(correctionDraft.payload.current_assignment.submission.attachments.length, 1);
  await request('POST', `/weekend-mastery/assignments/${first.payload.assignment.id}/submit`, parentToken, {
    student_note: '已补充完整过程。',
  });
  const correctedFirstSubmission = latestSubmission(getDB(), first.payload.assignment.id);
  const firstPassed = await request(
    'PUT', `/weekend-mastery/teacher/submissions/${correctedFirstSubmission.id}/review`, teacherToken,
    { is_correct: true, teacher_note: '第一关通过。' },
  );
  assert.equal(firstPassed.payload.is_correct, true);

  const ready = await request('GET', `/weekend-mastery/current?student_id=${studentId}`, parentToken);
  assert.equal(ready.payload.stages.find((item) => item.stage === 1).status, 'passed');
  assert.equal(ready.payload.stages.some((item) => item.stage === 2), false);
  const second = await request(
    'POST', `/weekend-mastery/assignments/${first.payload.assignment.id}/advance`, parentToken, {},
  );
  assert.equal(second.response.status, 201);
  assert.equal(second.payload.assignment.stage, 2);
  assert.ok(second.payload.assignment.question.render);
  const repeatedSecond = await request(
    'POST', `/weekend-mastery/assignments/${first.payload.assignment.id}/advance`, parentToken, {},
  );
  assert.equal(repeatedSecond.payload.assignment.id, second.payload.assignment.id);

  const stillBlocked = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(stillBlocked.response.status, 423);
  assert.equal(stillBlocked.payload.reason, 'stage2_not_submitted');

  await upload(second.payload.assignment.id, imageThree);
  await request('POST', `/weekend-mastery/assignments/${second.payload.assignment.id}/submit`, parentToken, {
    student_note: '第二关已完成。',
  });
  const pendingAllowsTerminal = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(pendingAllowsTerminal.response.status, 200);

  const secondSubmission = latestSubmission(getDB(), second.payload.assignment.id);
  const secondWrong = await request(
    'PUT', `/weekend-mastery/teacher/submissions/${secondSubmission.id}/review`, teacherToken,
    { is_correct: false, teacher_note: '第二问需要订正。' },
  );
  assert.equal(secondWrong.payload.is_correct, false);
  const blockedAgain = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(blockedAgain.response.status, 423);
  assert.equal(blockedAgain.payload.reason, 'stage2_correction_required');

  await upload(second.payload.assignment.id, imageFour);
  await request('POST', `/weekend-mastery/assignments/${second.payload.assignment.id}/submit`, parentToken, {
    student_note: '第二关订正完成。',
  });
  const resubmittedAllowsTerminal = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(resubmittedAllowsTerminal.response.status, 200);
  const correctedSecondSubmission = latestSubmission(getDB(), second.payload.assignment.id);
  const secondPassed = await request(
    'PUT', `/weekend-mastery/teacher/submissions/${correctedSecondSubmission.id}/review`, teacherToken,
    { is_correct: true, teacher_note: '双关通过。' },
  );
  assert.equal(secondPassed.payload.poster_ready, true);
  const completed = await request('GET', `/weekend-mastery/current?student_id=${studentId}`, parentToken);
  assert.equal(completed.payload.poster_ready, true);
  assert.equal(completed.payload.gate.allowed, true);
  const recentAll = await request(
    'GET', '/weekend-mastery/teacher/submissions?status=all&limit=3', teacherToken,
  );
  assert.equal(recentAll.payload.submissions.length, 3);
  assert.equal(recentAll.payload.submissions[0].submission.id, correctedSecondSubmission.id,
    '全部记录应从最新一次提交或批阅开始返回');

  const ownBroadcasts = await request('GET', '/weekend-mastery/broadcasts?limit=10', parentToken);
  assert.equal(ownBroadcasts.response.status, 200);
  assert.equal(ownBroadcasts.payload.broadcasts.length, 0, '学生家庭账号不播自己的通关捷报');
  const publicBroadcasts = await request('GET', '/weekend-mastery/broadcasts?limit=10', otherParentToken);
  assert.equal(publicBroadcasts.response.status, 200);
  assert.equal(publicBroadcasts.payload.broadcasts.length, 1);
  assert.equal(publicBroadcasts.payload.broadcasts[0].student_name, completed.payload.student_name);
  assert.match(publicBroadcasts.payload.broadcasts[0].message, new RegExp(completed.payload.student_name));
  const broadcastId = publicBroadcasts.payload.broadcasts[0].assignment_id;
  const markedRead = await request(
    'POST', `/weekend-mastery/broadcasts/${broadcastId}/read`, otherParentToken, {},
  );
  assert.equal(markedRead.response.status, 200);
  assert.equal(markedRead.payload.idempotent, false);
  const markedAgain = await request(
    'POST', `/weekend-mastery/broadcasts/${broadcastId}/read`, otherParentToken, {},
  );
  assert.equal(markedAgain.payload.idempotent, true);
  const noReplay = await request('GET', '/weekend-mastery/broadcasts?limit=10', otherParentToken);
  assert.equal(noReplay.payload.broadcasts.length, 0, '同一登录账号只展示一次');

  const ownFile = await fetch(origin + privateUrl, { headers: { authorization: `Bearer ${parentToken}` } });
  assert.equal(ownFile.status, 200);
  const teacherFile = await fetch(origin + privateUrl, { headers: { authorization: `Bearer ${teacherToken}` } });
  assert.equal(teacherFile.status, 200);
  const forbiddenFile = await fetch(origin + privateUrl, { headers: { authorization: `Bearer ${otherParentToken}` } });
  assert.equal(forbiddenFile.status, 404);
});

test('门禁只在周末窗口生效；缺少已发布题组时 fail-open', async () => {
  setNowProviderForTests(() => new Date('2026-08-10T01:00:00+08:00'));
  const outsideWindow = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(outsideWindow.response.status, 200);

  setNowProviderForTests(() => new Date('2026-08-21T01:00:00+08:00'));
  const unavailable = await request('GET', `/weekend-mastery/current?student_id=${studentId}`, parentToken);
  assert.equal(unavailable.payload.available, false);
  assert.equal(unavailable.payload.gate.active, true);
  assert.equal(unavailable.payload.gate.allowed, true);
  assert.equal(unavailable.payload.gate.reason, 'content_unavailable');
  const failOpen = await request(
    'GET', `/weekly-challenge/v2/current?student_id=${studentId}&grade=g7&subject=math`, parentToken,
  );
  assert.equal(failOpen.response.status, 200);
});
