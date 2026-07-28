const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rubbishDir = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish');
const dbPath = path.join(rubbishDir, `student-learning-records-${process.pid}.db`);
fs.mkdirSync(rubbishDir, { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'student-learning-records-test-secret';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED = '1';
process.env.UPLOAD_DIR = path.join(rubbishDir, 'student-learning-records-uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(rubbishDir, 'student-learning-records-private');
process.env.EXAM_LIBRARY_DIR = path.join(rubbishDir, 'student-learning-records-exams');
process.env.CHOICE_KING_MANIFEST_PATH = path.join(
  rubbishDir,
  'student-learning-records-missing-choice-manifest.json',
);

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let otherTeacherToken;
let parentToken;
let teacherId;
let otherTeacherId;
let classId;
let otherClassId;
let studentId;
let classmateId;
let otherStudentId;
let firstChoiceQuestionId;

function tokenFor(userId, openid, role) {
  return jwt.sign({ id: userId, openid, role }, process.env.JWT_SECRET);
}

async function request(url, token) {
  const response = await fetch(base + url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return { response, payload: await response.json() };
}

function insertPracticeItem(db, assignmentId, position) {
  return db.run(`INSERT INTO practice_assignment_items
    (assignment_id,position,snapshot_stem,snapshot_answer,snapshot_module,snapshot_type,
      snapshot_difficulty,estimated_seconds,signature,template_key,snapshot_payload)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
    assignmentId,
    position,
    `每日打卡第 ${position} 题`,
    String(position * 2),
    '有理数',
    '计算题',
    2,
    60,
    `assignment-${assignmentId}-item-${position}`,
    'test-template',
    '{}',
  ]);
}

function insertPracticeDay(db, {
  planId,
  parentId,
  practiceDate,
  results,
}) {
  const assignment = db.run(`INSERT INTO practice_assignments
    (plan_id,student_id,practice_date,status,estimated_seconds)
    VALUES(?,?,?,'completed',?)`, [
    planId,
    studentId,
    practiceDate,
    results.length * 60,
  ]);
  const submission = db.run(`INSERT INTO practice_submissions
    (assignment_id,parent_id,status,current_round,submitted_at,reviewed_by,reviewed_at,completed_at)
    VALUES(?,?,'reviewed',1,?,?,?,?)`, [
    assignment.lastInsertRowid,
    parentId,
    `${practiceDate}T08:00:00.000Z`,
    teacherId,
    `${practiceDate}T09:00:00.000Z`,
    `${practiceDate}T09:00:00.000Z`,
  ]);
  results.forEach((isCorrect, index) => {
    const item = insertPracticeItem(db, assignment.lastInsertRowid, index + 1);
    db.run(`INSERT INTO practice_reviews
      (submission_id,assignment_item_id,is_correct,reviewed_at) VALUES(?,?,?,?)`, [
      submission.lastInsertRowid,
      item.lastInsertRowid,
      isCorrect,
      `${practiceDate}T09:00:00.000Z`,
    ]);
    db.run(`INSERT INTO practice_review_rounds
      (submission_id,round_no,assignment_item_id,is_correct,reviewed_at) VALUES(?,1,?,?,?)`, [
      submission.lastInsertRowid,
      item.lastInsertRowid,
      isCorrect,
      `${practiceDate}T09:00:00.000Z`,
    ]);
  });
}

function insertChoiceQuestion(db, position) {
  return db.run(`INSERT INTO choice_king_questions
    (stable_code,stem,options_json,correct_option,explanation,topic_key,grade_code,subject_code)
    VALUES(?,?,?,?,?,?,?,?)`, [
    `LEARNING-RECORD-${process.pid}-${position}`,
    `选择题 ${position}`,
    JSON.stringify({ A: '正确选项', B: '干扰项 B', C: '干扰项 C', D: '干扰项 D' }),
    'A',
    `第 ${position} 题解析`,
    'rational-number',
    'g7',
    'math',
  ]);
}

function seedLearningData(db, parentId) {
  const plan = db.run(`INSERT INTO practice_plans
    (teacher_id,class_id,title,start_date,end_date,grade_band,module)
    VALUES(?,?,?,'2026-07-01','2026-07-31','junior','有理数')`, [
    teacherId,
    classId,
    '七月每日打卡',
  ]);
  insertPracticeDay(db, {
    planId: plan.lastInsertRowid,
    parentId,
    practiceDate: '2026-07-26',
    results: [1, 0, 1],
  });
  insertPracticeDay(db, {
    planId: plan.lastInsertRowid,
    parentId,
    practiceDate: '2026-07-27',
    results: [0, 1],
  });

  const choiceResults = [0, 1, 0];
  choiceResults.forEach((isCorrect, index) => {
    const question = insertChoiceQuestion(db, index + 1);
    if (index === 0) firstChoiceQuestionId = Number(question.lastInsertRowid);
    db.run(`INSERT INTO choice_king_attempts
      (student_id,parent_id,question_id,selected_option,is_correct,is_review,
        client_request_id,answered_at)
      VALUES(?,?,?,?,?,0,?,?)`, [
      studentId,
      parentId,
      question.lastInsertRowid,
      isCorrect ? 'A' : 'B',
      isCorrect,
      `learning-record-choice-${index + 1}`,
      `2026-07-27T10:0${index}:00.000Z`,
    ]);
    if (!isCorrect) {
      db.run(`INSERT INTO choice_king_wrong_progress
        (student_id,question_id,status,last_wrong_at,next_due_at)
        VALUES(?,?,'open',?,?)`, [
        studentId,
        question.lastInsertRowid,
        `2026-07-27T10:0${index}:00.000Z`,
        '2026-07-28T10:00:00.000Z',
      ]);
    }
  });

  db.run(`INSERT INTO choice_king_attempts
    (student_id,parent_id,question_id,selected_option,is_correct,is_review,
      client_request_id,answered_at)
    VALUES(?,?,?,?,?,1,?,?)`, [
    studentId,
    parentId,
    firstChoiceQuestionId,
    'B',
    0,
    'learning-record-choice-review',
    '2026-07-27T11:00:00.000Z',
  ]);

  db.run(`INSERT INTO mental_challenges
    (student_id,parent_id,battle,status,questions_json,started_at,completed_at,
      correct_count,total_questions)
    VALUES(?,?,'junior','completed','[]',?,?,7,10)`, [
    studentId,
    parentId,
    '2026-07-27T12:00:00.000Z',
    '2026-07-27T12:10:00.000Z',
  ]);
  db.run(`INSERT INTO mental_challenges
    (student_id,parent_id,battle,status,questions_json,started_at,correct_count,total_questions)
    VALUES(?,?,'junior','active','[]',?,0,20)`, [
    studentId,
    parentId,
    '2026-07-28T12:00:00.000Z',
  ]);

  db.run(`INSERT INTO learning_attempts
    (student_id,parent_id,task_type,task_title,logical_date,status,battle,grade_code,
      subject_code,questions_json,started_at,completed_at,correct_count,total_questions)
    VALUES(?,?,'daily','今日巩固','2026-07-27','completed','junior','g7','math','[]',?,?,6,8)`, [
    studentId,
    parentId,
    '2026-07-27T13:00:00.000Z',
    '2026-07-27T13:08:00.000Z',
  ]);
  db.run(`INSERT INTO learning_attempts
    (student_id,parent_id,task_type,task_title,logical_date,status,battle,grade_code,
      subject_code,questions_json,started_at,correct_count,total_questions)
    VALUES(?,?,'weekly','本周挑战','2026-07-28','active','junior','g7','math','[]',?,0,12)`, [
    studentId,
    parentId,
    '2026-07-28T13:00:00.000Z',
  ]);

  db.run(`INSERT INTO knowledge_topics
    (topic_key,grade_code,subject_code,chapter_name,title,knowledge_card)
    VALUES('record-topic','g7','math','第一章','有理数闯关','测试知识卡')`);
  db.run(`INSERT INTO knowledge_attempts
    (student_id,parent_id,topic_key,question_ids_json,answers_json,status,
      correct_count,started_at,completed_at)
    VALUES(?,?,'record-topic',?,'[]','completed',3,?,?)`, [
    studentId,
    parentId,
    JSON.stringify([101, 102, 103, 104]),
    '2026-07-28T14:00:00.000Z',
    '2026-07-28T14:04:00.000Z',
  ]);
  db.run(`INSERT INTO knowledge_attempts
    (student_id,parent_id,topic_key,question_ids_json,answers_json,status,
      correct_count,started_at)
    VALUES(?,?,'record-topic',?,'[]','active',0,?)`, [
    studentId,
    parentId,
    JSON.stringify([201, 202, 203]),
    '2026-07-28T15:00:00.000Z',
  ]);
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => {
    if (server.listening) resolve();
    else server.once('listening', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;

  const db = getDB();
  const teacher = db.run(
    "INSERT INTO users(openid,role,nickname) VALUES('record-teacher','teacher','本班老师')",
  );
  const otherTeacher = db.run(
    "INSERT INTO users(openid,role,nickname) VALUES('record-other-teacher','teacher','其他老师')",
  );
  const parent = db.run(
    "INSERT INTO users(openid,role,nickname) VALUES('record-parent','parent','学生家长')",
  );
  teacherId = Number(teacher.lastInsertRowid);
  otherTeacherId = Number(otherTeacher.lastInsertRowid);

  const ownClass = db.run(
    'INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,?,?,?)',
    [teacherId, '七年级一班', '数学', '七年级'],
  );
  const otherClass = db.run(
    'INSERT INTO classes(teacher_id,name,subject,grade) VALUES(?,?,?,?)',
    [otherTeacherId, '七年级二班', '数学', '七年级'],
  );
  classId = Number(ownClass.lastInsertRowid);
  otherClassId = Number(otherClass.lastInsertRowid);

  const student = db.run(`INSERT INTO students
    (teacher_id,class_id,name,grade,level,invite_code) VALUES(?,?,?,?,?,?)`, [
    teacherId,
    classId,
    '有记录学生',
    '七年级',
    'junior',
    'LR0001',
  ]);
  const classmate = db.run(`INSERT INTO students
    (teacher_id,class_id,name,grade,level,invite_code) VALUES(?,?,?,?,?,?)`, [
    teacherId,
    classId,
    '同班无记录学生',
    '七年级',
    'junior',
    'LR0002',
  ]);
  const otherStudent = db.run(`INSERT INTO students
    (teacher_id,class_id,name,grade,level,invite_code) VALUES(?,?,?,?,?,?)`, [
    otherTeacherId,
    otherClassId,
    '其他教师学生',
    '七年级',
    'junior',
    'LR0003',
  ]);
  studentId = Number(student.lastInsertRowid);
  classmateId = Number(classmate.lastInsertRowid);
  otherStudentId = Number(otherStudent.lastInsertRowid);
  const parentId = Number(parent.lastInsertRowid);

  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parentId, studentId]);
  seedLearningData(db, parentId);
  db.run(`INSERT INTO mental_challenges
    (student_id,parent_id,battle,status,questions_json,started_at,completed_at,
      correct_count,total_questions)
    VALUES(?,?,'junior','completed','[]',?,?,19,20)`, [
    otherStudentId,
    parentId,
    '2026-07-28T16:00:00.000Z',
    '2026-07-28T16:10:00.000Z',
  ]);

  teacherToken = tokenFor(teacherId, 'record-teacher', 'teacher');
  otherTeacherToken = tokenFor(otherTeacherId, 'record-other-teacher', 'teacher');
  parentToken = tokenFor(parentId, 'record-parent', 'parent');
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('教师列表严格按班级归属隔离，越权详情返回 404', async () => {
  const own = await request('/students/learning-records', teacherToken);
  assert.equal(own.response.status, 200);
  assert.deepEqual(
    new Set(own.payload.students.map((item) => Number(item.id))),
    new Set([studentId, classmateId]),
  );
  assert.ok(!own.payload.students.some((item) => Number(item.id) === otherStudentId));

  const foreignClass = await request(
    `/students/learning-records?class_id=${otherClassId}`,
    teacherToken,
  );
  assert.equal(foreignClass.response.status, 200);
  assert.deepEqual(foreignClass.payload.students, []);

  const foreignDetail = await request(
    `/students/${otherStudentId}/learning-record`,
    teacherToken,
  );
  assert.equal(foreignDetail.response.status, 404);

  const reverseForeignDetail = await request(
    `/students/${studentId}/learning-record`,
    otherTeacherToken,
  );
  assert.equal(reverseForeignDetail.response.status, 404);
});

test('家长不可访问教师学习记录列表和详情', async () => {
  const list = await request('/students/learning-records', parentToken);
  assert.equal(list.response.status, 403);

  const detail = await request(`/students/${studentId}/learning-record`, parentToken);
  assert.equal(detail.response.status, 403);
});

test('详情正确聚合每日打卡、选择题、口算、学习中心和知识闯关', async () => {
  const { response, payload } = await request(
    `/students/${studentId}/learning-record`,
    teacherToken,
  );
  assert.equal(response.status, 200);
  assert.equal(Number(payload.student.id), studentId);

  assert.deepEqual(payload.stats.channels.practice, {
    total: 5,
    correct: 3,
    wrong: 2,
    days: 2,
  });
  assert.deepEqual(payload.stats.channels.choice, {
    total: 3,
    distinct_total: 3,
    correct: 1,
    wrong: 2,
  });
  assert.deepEqual(payload.stats.channels.mental, {
    total: 10,
    correct: 7,
    wrong: 3,
    sessions: 1,
  });
  assert.deepEqual(payload.stats.channels.learning, {
    total: 8,
    correct: 6,
    wrong: 2,
    sessions: 1,
  });
  assert.deepEqual(
    {
      total: payload.stats.channels.knowledge.total,
      correct: payload.stats.channels.knowledge.correct,
      wrong: payload.stats.channels.knowledge.wrong,
    },
    { total: 4, correct: 3, wrong: 1 },
  );
  assert.equal(payload.stats.channels.knowledge.latest_at, '2026-07-28T14:04:00.000Z');

  assert.equal(payload.stats.total_questions, 30);
  assert.equal(payload.stats.correct_questions, 20);
  assert.equal(payload.stats.wrong_questions, 10);
  assert.equal(payload.stats.accuracy, 67);
  assert.equal(payload.stats.open_wrong_count, 4);
  assert.equal(payload.stats.latest_activity_at, '2026-07-28T14:04:00.000Z');
});

test('学生题库同时返回通用错题和选择错题，并与 open wrong 计数一致', async () => {
  const { response, payload } = await request(
    `/students/${studentId}/learning-record`,
    teacherToken,
  );
  assert.equal(response.status, 200);

  const common = payload.question_bank.items.filter(
    (item) => item.source_type === 'practice_review',
  );
  const choices = payload.question_bank.items.filter(
    (item) => item.source_type === 'choice_king',
  );
  assert.equal(common.length, 2);
  assert.ok(common.every((item) => item.id.startsWith('learning:')));
  assert.ok(common.every((item) => item.status === 'open'));
  assert.ok(common.every((item) => item.question_type === '计算题'));
  assert.ok(common.every((item) => item.stem.startsWith('每日打卡第 ')));

  assert.equal(choices.length, 2);
  assert.ok(choices.every((item) => item.id.startsWith('choice:')));
  assert.ok(choices.every((item) => item.question_type === '选择题'));
  assert.ok(choices.every((item) => item.answer === 'A'));
  assert.deepEqual(choices[0].options, {
    A: '正确选项',
    B: '干扰项 B',
    C: '干扰项 C',
    D: '干扰项 D',
  });
  assert.ok(choices.some((item) => Number(item.source_id) === firstChoiceQuestionId));

  assert.deepEqual(payload.question_bank.summary, {
    total: 4,
    open: 4,
    mastered: 0,
  });
  assert.equal(payload.stats.open_wrong_count, payload.question_bank.summary.open);
});
