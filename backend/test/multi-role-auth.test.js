const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `multi-role-auth-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'multi-role-auth-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.APP_ID = '';
process.env.APP_SECRET = '';
const TEST_TEACHER_INVITE_CODES = ['TEST-CODE-01', 'TEST-CODE-02', 'TEST-CODE-03', 'TEST-CODE-04', 'TEST-CODE-05'];
process.env.TEACHER_INVITE_CODES = TEST_TEACHER_INVITE_CODES.join(',');
process.env.TEACHER_INVITE_CODE = 'STALE1';

let server;
let base;
let db;

async function createLegacyDatabase() {
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE NOT NULL,
      nickname TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'parent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER,
      name TEXT NOT NULL,
      subject TEXT,
      grade TEXT,
      room TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER,
      class_id INTEGER,
      name TEXT NOT NULL,
      nickname TEXT,
      grade TEXT,
      school TEXT,
      level TEXT,
      personality TEXT,
      gender TEXT DEFAULT 'boy',
      invite_code TEXT UNIQUE,
      avatar_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER,
      student_id INTEGER,
      UNIQUE(parent_id, student_id)
    );
    INSERT INTO users(id,openid,role,nickname) VALUES
      (1,'legacy-dual','teacher','双角色用户'),
      (2,'legacy-teacher','teacher','纯教师'),
      (3,'legacy-parent','parent','普通家长'),
      (4,'class-fact-teacher','parent','事实教师'),
      (5,'binding-teacher','teacher','绑定测试教师');
    INSERT INTO classes(id,teacher_id,name) VALUES (1,2,'教师班'),(2,4,'事实班');
    INSERT INTO students(id,teacher_id,class_id,name,invite_code)
      VALUES (1,2,1,'绑定学生','DUAL01');
    INSERT INTO bindings(parent_id,student_id) VALUES (1,1);
  `);
  fs.writeFileSync(dbPath, Buffer.from(legacy.export()));
  legacy.close();
}

async function request(method, url, token, body, extraHeaders = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  await createLegacyDatabase();
  const backend = require('../server');
  server = await backend.start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  db = require('../db/init').getDB();
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('兼容迁移按旧角色、家长绑定与教师班级事实回填且可重复执行', () => {
  const { runMigrations } = require('../db/init');
  runMigrations();
  runMigrations();

  const dualRoles = db.all('SELECT role FROM user_roles WHERE user_id=1 ORDER BY role').map((row) => row.role);
  const pureTeacherRoles = db.all('SELECT role FROM user_roles WHERE user_id=2 ORDER BY role').map((row) => row.role);
  const factTeacherRoles = db.all('SELECT role FROM user_roles WHERE user_id=4 ORDER BY role').map((row) => row.role);
  assert.deepEqual(dualRoles, ['parent', 'teacher']);
  assert.deepEqual(pureTeacherRoles, ['teacher']);
  assert.deepEqual(factTeacherRoles, ['parent', 'teacher']);
  assert.equal(db.get('SELECT COUNT(*) count FROM user_roles WHERE user_id=1').count, 2);
  const migratedStudent = db.get('SELECT external_id FROM students WHERE id=1');
  assert.match(migratedStudent.external_id, /^stu_[a-f0-9]{32}$/);
});

test('登录返回角色列表，JWT 保存 active role，并可 parent→teacher→parent', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'legacy-dual' });
  assert.equal(login.response.status, 200);
  assert.deepEqual(login.payload.user.roles, ['parent', 'teacher']);
  assert.equal(jwt.verify(login.payload.token, process.env.JWT_SECRET).role, 'teacher');

  const asParent = await request('POST', '/auth/switch-role', login.payload.token, { role: 'parent' });
  assert.equal(asParent.response.status, 200);
  assert.equal(asParent.payload.user.role, 'parent');
  assert.equal(jwt.verify(asParent.payload.token, process.env.JWT_SECRET).role, 'parent');

  const asTeacher = await request('POST', '/auth/switch-role', asParent.payload.token, { role: 'teacher' });
  assert.equal(asTeacher.response.status, 200);
  const backToParent = await request('POST', '/auth/switch-role', asTeacher.payload.token, { role: 'parent' });
  assert.equal(backToParent.response.status, 200);
  assert.equal(backToParent.payload.user.role, 'parent');
});

test('登录失败修复可优先恢复存在绑定事实的家长角色', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'legacy-dual' });
  const teacher = await request('POST', '/auth/switch-role', login.payload.token, { role: 'teacher' });
  const repaired = await request('POST', '/auth/login', '', { code: 'legacy-dual', prefer_role: 'parent' });
  assert.equal(teacher.payload.user.role, 'teacher');
  assert.equal(repaired.payload.user.role, 'parent');
  assert.deepEqual(repaired.payload.user.roles, ['parent', 'teacher']);
});

test('旧 JWT 仍可按其中的合法角色访问，不要求先重签', async () => {
  const oldToken = jwt.sign(
    { id: 1, openid: 'legacy-dual', role: 'parent' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
  const result = await request('GET', '/bind/students', oldToken);
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.students.length, 1);
});

test('复数教师邀请码配置是唯一权威且精确开放五个码', async () => {
  for (const [index, inviteCode] of TEST_TEACHER_INVITE_CODES.entries()) {
    const login = await request('POST', '/auth/login', '', { code: `teacher-code-parent-${index}` });
    const upgraded = await request('POST', '/bind', login.payload.token, { invite_code: inviteCode });
    assert.equal(upgraded.response.status, 200, inviteCode);
    assert.equal(upgraded.payload.user.role, 'teacher');
    assert.deepEqual(upgraded.payload.user.roles, ['parent', 'teacher']);
  }

  const staleLogin = await request('POST', '/auth/login', '', { code: 'stale-teacher-code-parent' });
  const stale = await request('POST', '/bind', staleLogin.payload.token, { invite_code: 'STALE1' });
  assert.equal(stale.response.status, 404);
});

test('未配置复数教师邀请码时兼容旧单数变量', async () => {
  const configuredCodes = process.env.TEACHER_INVITE_CODES;
  delete process.env.TEACHER_INVITE_CODES;
  process.env.TEACHER_INVITE_CODE = 'LEGACY';
  try {
    const login = await request('POST', '/auth/login', '', { code: 'legacy-invite-parent' });
    const upgraded = await request('POST', '/bind', login.payload.token, { invite_code: 'LEGACY' });
    assert.equal(upgraded.response.status, 200);
    assert.equal(upgraded.payload.user.role, 'teacher');
  } finally {
    process.env.TEACHER_INVITE_CODES = configuredCodes;
    process.env.TEACHER_INVITE_CODE = 'STALE1';
  }
});

test('纯教师不能通过 switch-role 伪造家长身份', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'legacy-teacher' });
  assert.deepEqual(login.payload.user.roles, ['teacher']);
  const forged = await request('POST', '/auth/switch-role', login.payload.token, { role: 'parent' });
  assert.equal(forged.response.status, 403);
});

test('教师当前身份持有效学生邀请码可完成绑定并切换到家长端', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'binding-teacher' });
  assert.equal(login.payload.user.role, 'teacher');

  const bound = await request('POST', '/bind', login.payload.token, { invite_code: 'DUAL01' });
  assert.equal(bound.response.status, 200);
  assert.equal(bound.payload.student.name, '绑定学生');
  assert.equal(bound.payload.user.role, 'parent');
  assert.deepEqual(bound.payload.user.roles, ['parent', 'teacher']);
  assert.equal(jwt.verify(bound.payload.token, process.env.JWT_SECRET).role, 'parent');
  assert.equal(db.get('SELECT COUNT(*) count FROM bindings WHERE parent_id=5 AND student_id=1').count, 1);
});

test('签名有效但不属于用户的角色不能跨路由越权', async () => {
  const parentLogin = await request('POST', '/auth/login', '', { code: 'membership-parent' });
  const forgedTeacherToken = jwt.sign(
    { id: parentLogin.payload.user.id, role: 'teacher' },
    process.env.JWT_SECRET
  );
  const before = db.get('SELECT COUNT(*) count FROM classes').count;
  const createClass = await request('POST', '/classes', forgedTeacherToken, { name: '越权班级' });
  assert.equal(createClass.response.status, 401);
  assert.equal(db.get('SELECT COUNT(*) count FROM classes').count, before);

  const forgedParentToken = jwt.sign({ id: 2, role: 'parent' }, process.env.JWT_SECRET);
  const createLeave = await request('POST', '/leaves', forgedParentToken, {
    student_id: 1,
    class_date: '2026-07-13',
    reason: '越权请假',
  });
  assert.equal(createLeave.response.status, 401);
});

test('邀请码连续失败会被限速并返回重试时间', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'rate-limit-parent' });
  for (let index = 0; index < 5; index += 1) {
    const failed = await request('POST', '/bind', login.payload.token, { invite_code: `BAD0${index}X` });
    assert.equal(failed.response.status, 404);
  }
  const limited = await request(
    'POST',
    '/bind',
    login.payload.token,
    { invite_code: 'BAD999' },
    { 'X-Forwarded-For': '203.0.113.99' }
  );
  assert.equal(limited.response.status, 429);
  assert.ok(Number(limited.response.headers.get('retry-after')) > 0);
});
