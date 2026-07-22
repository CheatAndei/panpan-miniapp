const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
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
let otherParentToken;
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
  const otherParent = db.run("INSERT INTO users(openid,role,nickname) VALUES('arena-other-parent','parent','其他家长')");
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
  otherParentToken = jwt.sign({ id: otherParent.lastInsertRowid, openid: 'arena-other-parent', role: 'parent' }, process.env.JWT_SECRET);
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
  const fixed = QUESTION_BANK.junior.filter((item) => /\+ \(−/u.test(item.stem));
  assert.equal(fixed.length, 84);
  assert.equal(fixed.filter((item) => item.type === '分数口算').length, 41);
  assert.equal(fixed.filter((item) => item.type === '小数口算').length, 43);
  for (const item of fixed) {
    const legacyStem = item.stem.replace(/\+ \(−([^)]+)\)/gu, '+ -$1').replace(/−/gu, '-');
    const legacySuffix = Number.parseInt(crypto.createHash('sha256').update(legacyStem).digest('hex').slice(0, 8), 16).toString(16);
    assert.ok(item.id.endsWith(`-${legacySuffix}`), item.id);
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
  const { answersEqual } = require('../services/mental-arena');
  assert.equal(answersEqual('2x²-3x', '2 * x^2 - 3x'), true);
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
  assert.equal(completed.payload.promotion.event_type, 'mental_first');
  assert.equal(completed.payload.promotion.student_name, '小同学');

  const promotions = await request('GET', '/promotions?unseen=1', undefined, teacherToken);
  assert.equal(promotions.response.status, 200);
  assert.equal(promotions.payload.unseen, 1);
  assert.equal(promotions.payload.promotions[0].rank, 1);

  const repeated = await request('POST', `/mental-arena/challenges/${started.payload.challenge.id}/submit`, {
    answers: questions.map((item) => ({ question_id: item.id, answer: item.answer })),
  });
  assert.equal(repeated.payload.promotion, null);
  assert.equal((await request('GET', '/promotions', undefined, teacherToken)).payload.promotions.length, 1);

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
});

test('口算题可报错、去重、教师停题，且家长响应不泄露答案', async () => {
  const started = await request('POST', '/mental-arena/challenges', { student_id: juniorStudentId, battle: 'junior' });
  const question = started.payload.challenge.questions[0];
  const body = {
    source_type: 'mental_challenge', source_id: started.payload.challenge.id,
    student_id: juniorStudentId, question_id: question.id, reason: 'sign_bracket', detail: '符号看起来不清楚',
  };
  const forbidden = await request('POST', '/calculation-reports', body, otherParentToken);
  assert.equal(forbidden.response.status, 403);
  const created = await request('POST', '/calculation-reports', body);
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.report.snapshot_answer, undefined);
  assert.equal(created.payload.report.correct_answer, undefined);
  const duplicate = await request('POST', '/calculation-reports', body);
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.payload.duplicate, true);

  const queue = await request('GET', '/calculation-reports?source_type=mental_challenge&status=pending', undefined, teacherToken);
  const report = queue.payload.reports.find((item) => Number(item.id) === Number(created.payload.report.id));
  assert.ok(report);
  assert.doesNotMatch(report.question_stem, /\+\s*-/u);
  const handled = await request('PUT', `/calculation-reports/${report.id}`, {
    status: 'resolved', stop_question: true, teacher_note: '确认符号有误',
  }, teacherToken);
  assert.equal(handled.response.status, 200);
  assert.equal(Number(handled.payload.report.question_is_active), 0);
  assert.ok(getDB().get('SELECT * FROM mental_question_controls WHERE battle=? AND question_id=?', ['junior', question.id]));
});

test('停用的口算题不会进入新挑战，历史挑战快照仍保留', () => {
  const db = getDB();
  const teacher = db.get("SELECT id FROM users WHERE openid='arena-teacher'");
  const parent = db.get("SELECT id FROM users WHERE openid='arena-parent'");
  const klass = db.get("SELECT id FROM classes WHERE name='初二数学班'");
  const fresh = db.run('INSERT INTO students(teacher_id,class_id,name,grade,invite_code) VALUES(?,?,?,?,?)', [teacher.id, klass.id, '新同学', '初二', 'ARENA3']);
  const types = [...new Set(QUESTION_BANK.junior.map((item) => item.type))];
  const allowedQuestions = types.flatMap((type) => QUESTION_BANK.junior.filter((item) => item.type === type).slice(0, 3));
  const allowed = new Set(allowedQuestions.map((item) => item.id));
  db.transaction(() => {
    db.run("DELETE FROM mental_question_controls WHERE battle='junior'");
    for (const item of QUESTION_BANK.junior.filter((question) => !allowed.has(question.id))) {
      db.run(`INSERT INTO mental_question_controls
        (battle,question_id,is_active,reason,stopped_by,stopped_at) VALUES('junior',?,0,'测试',?,CURRENT_TIMESTAMP)`, [item.id, teacher.id]);
    }
  });
  const { createChallenge } = require('../services/mental-arena');
  const challenge = createChallenge(db, { studentId: fresh.lastInsertRowid, parentId: parent.id, battle: 'junior' });
  assert.equal(challenge.questions.length, 20);
  assert.ok(challenge.questions.every((item) => allowed.has(item.id)));
  const historical = db.get('SELECT questions_json FROM mental_challenges WHERE id=?', [challenge.id]);
  assert.equal(JSON.parse(historical.questions_json).length, 20);
});
