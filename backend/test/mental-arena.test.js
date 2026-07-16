const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `mental-arena-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'mental-arena-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'mental-arena-uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'mental-arena-private');

const { QUESTION_BANK } = require('../resources/mental-arena/questions');
const { speedBonus, numericValue, shanghaiWeekStart } = require('../services/mental-arena');
const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let token;
let teacherToken;
let juniorStudentId;
let primaryStudentId;

async function request(method, url, body, authToken = token) {
  const response = await fetch(base + url, {
    method,
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('arena-teacher','teacher','王老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('arena-parent','parent','家长')");
  const juniorClass = db.run('INSERT INTO classes(teacher_id,name,grade) VALUES(?,?,?)', [teacher.lastInsertRowid, '初二数学班', '初二']);
  const primaryClass = db.run('INSERT INTO classes(teacher_id,name,grade) VALUES(?,?,?)', [teacher.lastInsertRowid, '五年级数学班', '五年级']);
  const junior = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.lastInsertRowid, juniorClass.lastInsertRowid, '小初', '初二', 'ARENA1']);
  const primary = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.lastInsertRowid, primaryClass.lastInsertRowid, '小五', '五年级', 'ARENA2']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, junior.lastInsertRowid]);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, primary.lastInsertRowid]);
  juniorStudentId = junior.lastInsertRowid;
  primaryStudentId = primary.lastInsertRowid;
  token = jwt.sign({ id: parent.lastInsertRowid, openid: 'arena-parent', role: 'parent' }, process.env.JWT_SECRET);
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'arena-teacher', role: 'teacher' }, process.env.JWT_SECRET);
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('小学和初中题库各 600 题且题干不重复', () => {
  for (const battle of ['primary', 'junior']) {
    assert.equal(QUESTION_BANK[battle].length, 600);
    assert.equal(new Set(QUESTION_BANK[battle].map((item) => item.stem)).size, 600);
    assert.equal(new Set(QUESTION_BANK[battle].map((item) => item.id)).size, 600);
  }
});

test('小学混合运算仅使用 3-5 个数字且审计中间值不出现负数', () => {
  for (const question of QUESTION_BANK.primary) {
    assert.ok(question.audit);
    assert.ok(question.audit.operands.length >= 3 && question.audit.operands.length <= 5);
    assert.ok(question.audit.operands.every((value) => Number(value) >= 0));
    assert.ok(question.audit.intermediates.every((value) => Number(value) >= 0));
  }
});

test('分数、小数和方程答案可统一比较', () => {
  assert.equal(numericValue('x = -3'), -3);
  assert.equal(numericValue('1/2'), 0.5);
  assert.equal(numericValue('0.5'), 0.5);
  assert.equal(numericValue('1/0'), null);
});

test('计分保证正确率优先且速度奖不超过 99', () => {
  assert.equal(speedBonus('primary', 40), 99);
  assert.equal(speedBonus('primary', 180), 0);
  assert.equal(speedBonus('junior', 60), 99);
  assert.equal(20 * 100 + speedBonus('primary', 999), 2000);
  assert.equal(19 * 100 + speedBonus('primary', 1), 1999);
});

test('本周以北京时间周一零点开始', () => {
  assert.equal(shanghaiWeekStart(new Date('2026-07-16T12:00:00+08:00')).toISOString(), '2026-07-12T16:00:00.000Z');
});

test('初中生进入小学战场会进入排行榜并显示炸鱼选手', async () => {
  const started = await request('POST', '/mental-arena/challenges', { student_id: juniorStudentId, battle: 'primary' });
  assert.equal(started.response.status, 201);
  assert.equal(started.payload.challenge.questions.length, 20);
  assert.equal(started.payload.challenge.is_fishing, true);
  assert.ok(started.payload.challenge.questions.every((item) => item.answer === undefined));

  const row = getDB().get('SELECT questions_json FROM mental_challenges WHERE id=?', [started.payload.challenge.id]);
  const questions = JSON.parse(row.questions_json);
  const completed = await request('POST', `/mental-arena/challenges/${started.payload.challenge.id}/submit`, {
    answers: questions.map((item) => ({ question_id: item.id, answer: item.answer })),
  });
  assert.equal(completed.payload.challenge.correct_count, 20);
  assert.equal(completed.payload.challenge.score, 2099);

  const other = await request('POST', '/mental-arena/challenges', { student_id: primaryStudentId, battle: 'primary' });
  const otherRow = getDB().get('SELECT questions_json FROM mental_challenges WHERE id=?', [other.payload.challenge.id]);
  const otherQuestions = JSON.parse(otherRow.questions_json);
  await request('POST', `/mental-arena/challenges/${other.payload.challenge.id}/submit`, {
    answers: otherQuestions.map((item, index) => ({ question_id: item.id, answer: index === 0 ? '' : item.answer })),
  });

  const board = await request('GET', `/mental-arena/leaderboard?student_id=${juniorStudentId}&battle=primary&period=history`);
  assert.equal(board.response.status, 200);
  assert.equal(board.payload.entries.length, 2);
  assert.equal(board.payload.entries[0].student_name, '小初');
  assert.equal(board.payload.entries[0].is_fishing, true);
  assert.equal(board.payload.my_rank.rank, 1);
  const deletion = await request('DELETE', `/students/${juniorStudentId}`, undefined, teacherToken);
  assert.equal(deletion.response.status, 409);
});
