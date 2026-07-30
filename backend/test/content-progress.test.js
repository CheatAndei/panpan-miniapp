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
process.env.DATABASE_PATH = path.join(rubbish, `content-progress-${suffix}.db`);
process.env.UPLOAD_DIR = path.join(rubbish, `content-progress-uploads-${suffix}`);
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbish, `content-progress-private-${suffix}`);
process.env.EXAM_LIBRARY_DIR = path.join(rubbish, `content-progress-exams-${suffix}`);
process.env.JWT_SECRET = 'content-progress-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DISABLE_REMINDER = 'true';
fs.mkdirSync(rubbish, { recursive: true });

const { start } = require('../server');
const { getDB } = require('../db/init');
const { replaceQuestionTopics } = require('../services/content-progress');
const { topicKeys } = require('../resources/g8-content/topics');

let server;
let base;
let teacherToken;
let otherTeacherToken;
let parentToken;
let teacherId;
let classId;
let g7ClassId;
let studentId;
let historyStudentId;
let topicOneChoiceId;
let multiChoiceId;
let topicTwoChoiceId;
let topicOneFillId;
let topicOneSubjectiveId;
let activeAssignmentId;
let submittedAssignmentId;

function token(id, role) {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { algorithm: 'HS256' });
}

async function request(method, url, authToken, body) {
  const response = await fetch(base + url, {
    method,
    headers: {
      authorization: `Bearer ${authToken}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

function addChoice(db, stableCode, keys) {
  const result = db.run(`INSERT INTO choice_king_questions
    (stable_code,stem,options_json,correct_option,explanation,source_label,grade_code,subject_code,topic_key)
    VALUES(?,?,?,'A',?,'范围测试','g8','math',?)`, [
    stableCode,
    `${stableCode} 题干`,
    JSON.stringify({ A: '正确', B: '错误一', C: '错误二', D: '错误三' }),
    `${stableCode} 解析`,
    keys[0],
  ]);
  replaceQuestionTopics(db, {
    relationTable: 'choice_king_question_topics',
    questionId: result.lastInsertRowid,
    topicKeys: keys,
    primaryTopicKey: keys[0],
  });
  return Number(result.lastInsertRowid);
}

function addTerminal(db, assetId, sourceKey, questionType, keys) {
  const result = db.run(`INSERT INTO weekly_challenge_questions
    (source_key,question_type,title,question_asset_id,answer_text,source_label,
      grade_code,subject_code,topic_key,is_active)
    VALUES(?,?,?,?,?,'范围测试','g8','math',?,1)`, [
    sourceKey, questionType, sourceKey, assetId, `${sourceKey} 标准答案`, keys[0],
  ]);
  replaceQuestionTopics(db, {
    relationTable: 'weekly_challenge_question_topics',
    questionId: result.lastInsertRowid,
    topicKeys: keys,
    primaryTopicKey: keys[0],
  });
  return Number(result.lastInsertRowid);
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => (server.listening ? resolve() : server.once('listening', resolve)));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('scope-teacher','teacher','潘老师')");
  const otherTeacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('scope-other','teacher','其他老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('scope-parent','parent','测试家长')");
  db.run("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'teacher')", [teacher.lastInsertRowid]);
  db.run("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'teacher')", [otherTeacher.lastInsertRowid]);
  db.run("INSERT OR IGNORE INTO user_roles(user_id,role) VALUES(?,'parent')", [parent.lastInsertRowid]);
  const cls = db.run(`INSERT INTO classes(teacher_id,name,grade,subject)
    VALUES(?,?,'八年级','数学')`, [teacher.lastInsertRowid, '八年级范围测试班']);
  const g7Class = db.run(`INSERT INTO classes(teacher_id,name,grade,subject)
    VALUES(?,?,'七年级','数学')`, [teacher.lastInsertRowid, '七年级范围测试班']);
  const student = db.run(`INSERT INTO students(teacher_id,class_id,name,grade,invite_code)
    VALUES(?,?,?,'八年级','SCOPE01')`, [teacher.lastInsertRowid, cls.lastInsertRowid, '范围测试同学']);
  const historyStudent = db.run(`INSERT INTO students(teacher_id,class_id,name,grade,invite_code)
    VALUES(?,?,?,'八年级','SCOPE02')`, [teacher.lastInsertRowid, cls.lastInsertRowid, '历史保留同学']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, historyStudent.lastInsertRowid]);

  teacherId = Number(teacher.lastInsertRowid);
  classId = Number(cls.lastInsertRowid);
  g7ClassId = Number(g7Class.lastInsertRowid);
  studentId = Number(student.lastInsertRowid);
  historyStudentId = Number(historyStudent.lastInsertRowid);
  teacherToken = token(teacherId, 'teacher');
  otherTeacherToken = token(otherTeacher.lastInsertRowid, 'teacher');
  parentToken = token(parent.lastInsertRowid, 'parent');

  topicOneChoiceId = addChoice(db, 'GZ8-SCOPE-ONE', [topicKeys[0]]);
  multiChoiceId = addChoice(db, 'GZ8-SCOPE-MULTI', [topicKeys[0], topicKeys[1]]);
  topicTwoChoiceId = addChoice(db, 'GZ8-SCOPE-TWO', [topicKeys[1]]);
  const asset = db.run(`INSERT INTO exam_assets
    (asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES('question','scope/question.png','question.png','image/png',10,?)`, ['c'.repeat(64)]);
  topicOneFillId = addTerminal(db, asset.lastInsertRowid, 'scope-fill-one', 'fill', [topicKeys[0]]);
  addTerminal(db, asset.lastInsertRowid, 'scope-fill-multi', 'fill', [topicKeys[0], topicKeys[1]]);
  addTerminal(db, asset.lastInsertRowid, 'scope-fill-two', 'fill', [topicKeys[1]]);
  topicOneSubjectiveId = addTerminal(db, asset.lastInsertRowid, 'scope-subjective-one', 'subjective', [topicKeys[0]]);
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

test('八年级班默认开放 12 范围，只有所属教师可管理', async () => {
  const state = await request('GET', `/content-progress/classes/${classId}`, teacherToken);
  assert.equal(state.response.status, 200);
  assert.equal(state.payload.supported, true);
  assert.equal(state.payload.topics.length, 12);
  assert.equal(state.payload.scope.configured, false);
  assert.equal(state.payload.scope.all_enabled, true);
  assert.deepEqual(state.payload.scope.allowed_topic_keys, topicKeys);

  const denied = await request('GET', `/content-progress/classes/${classId}`, otherTeacherToken);
  assert.equal(denied.response.status, 404);
  const unsupported = await request('PUT', `/content-progress/classes/${g7ClassId}`, teacherToken, {
    topic_keys: [topicKeys[0]],
  });
  assert.equal(unsupported.response.status, 400);
});

test('单范围开放会撤回未完成题，多标签题要求全部范围同时开启', async () => {
  const db = getDB();
  const first = await request(
    'GET',
    `/choice-king/next?student_id=${studentId}&grade=g8&subject=math`,
    parentToken,
  );
  assert.equal(first.response.status, 200);
  assert.equal(first.payload.question.id, topicOneChoiceId);

  const active = db.run(`INSERT INTO challenge_assignments_v2
    (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
    VALUES(?,?,'g8','math','fill','active',date('now'))`, [studentId, topicOneFillId]);
  const submitted = db.run(`INSERT INTO challenge_assignments_v2
    (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
    VALUES(?,?,'g8','math','subjective','submitted',date('now'))`, [historyStudentId, topicOneSubjectiveId]);
  activeAssignmentId = Number(active.lastInsertRowid);
  submittedAssignmentId = Number(submitted.lastInsertRowid);

  const saved = await request('PUT', `/content-progress/classes/${classId}`, teacherToken, {
    topic_keys: [topicKeys[1]],
  });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.payload.scope.allowed_topic_keys, [topicKeys[1]]);
  assert.equal(saved.payload.scope.withdrawn.choice_issuances, 1);
  assert.equal(saved.payload.scope.withdrawn.challenge_assignments, 1);
  assert.equal(db.get('SELECT status FROM challenge_assignments_v2 WHERE id=?', [activeAssignmentId]).status, 'skipped');
  assert.equal(db.get('SELECT status FROM challenge_assignments_v2 WHERE id=?', [submittedAssignmentId]).status, 'submitted');

  const next = await request(
    'GET',
    `/choice-king/next?student_id=${studentId}&grade=g8&subject=math`,
    parentToken,
  );
  assert.equal(next.response.status, 200);
  assert.equal(next.payload.question.id, topicTwoChoiceId);
  assert.notEqual(next.payload.question.id, multiChoiceId);

  const current = await request(
    'GET',
    `/weekly-challenge/v2/current?student_id=${studentId}&grade=g8&subject=math`,
    parentToken,
  );
  assert.equal(current.response.status, 200);
  assert.equal(current.payload.available.fill, 1);
  assert.equal(current.payload.available.subjective, undefined);
});

test('全部关闭时不下发客观与压轴题，已提交历史保留', async () => {
  const db = getDB();
  const saved = await request('PUT', `/content-progress/classes/${classId}`, teacherToken, {
    topic_keys: [],
  });
  assert.equal(saved.response.status, 200);
  assert.equal(saved.payload.scope.empty, true);

  const next = await request(
    'GET',
    `/choice-king/next?student_id=${studentId}&grade=g8&subject=math`,
    parentToken,
  );
  assert.equal(next.response.status, 200);
  assert.equal(next.payload.question, null);
  assert.equal(next.payload.scope_empty, true);

  const current = await request(
    'GET',
    `/weekly-challenge/v2/current?student_id=${studentId}&grade=g8&subject=math`,
    parentToken,
  );
  assert.equal(current.response.status, 200);
  assert.equal(current.payload.scope_empty, true);
  assert.deepEqual(current.payload.available, {});
  assert.equal(db.get('SELECT status FROM challenge_assignments_v2 WHERE id=?', [submittedAssignmentId]).status, 'submitted');

  const claim = await request('POST', '/weekly-challenge/v2/assignments', parentToken, {
    student_id: studentId,
    grade: 'g8',
    subject: 'math',
    question_type: 'fill',
  });
  assert.equal(claim.response.status, 400);
  assert.match(claim.payload.error, /全部通关|补充新题/);
});
