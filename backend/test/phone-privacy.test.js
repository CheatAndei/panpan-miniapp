const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `phone-privacy-test-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'phone-privacy-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.APP_ID = '';
process.env.APP_SECRET = '';

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherId;
let parentToken;

async function request(method, url, token, body) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

function assertNoPhoneField(value) {
  assert.equal(Object.hasOwn(value || {}, 'phone'), false);
  assert.equal(Object.hasOwn(value || {}, 'teacher_phone'), false);
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;

  const db = getDB();
  // 模拟升级前数据库：新建库已不再创建该历史字段。
  db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  const teacher = db.run(
    "INSERT INTO users(openid,role,nickname,phone) VALUES('privacy-teacher','teacher','测试老师','13800000000')"
  );
  teacherId = teacher.lastInsertRowid;
  const parent = db.run(
    "INSERT INTO users(openid,role,nickname,phone) VALUES('privacy-parent','parent','测试家长','13900000000')"
  );
  const cls = db.run('INSERT INTO classes(teacher_id,name) VALUES(?,?)', [teacherId, '测试班']);
  const student = db.run(
    'INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)',
    [teacherId, cls.lastInsertRowid, '小明', 'PRIV01']
  );
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  parentToken = jwt.sign(
    { id: parent.lastInsertRowid, openid: 'privacy-parent', role: 'parent' },
    process.env.JWT_SECRET
  );
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('登录和个人资料接口不返回历史电话字段', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'privacy-teacher' });
  assert.equal(login.response.status, 200);
  assertNoPhoneField(login.payload.user);

  const me = await request('GET', '/auth/me', login.payload.token);
  assert.equal(me.response.status, 200);
  assertNoPhoneField(me.payload.user);
});

test('新建数据库 schema 不再包含电话字段', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  assert.equal(/\bphone\s+TEXT\b/i.test(schema), false);
});

test('个人资料接口忽略电话参数且不在响应中回显', async () => {
  const login = await request('POST', '/auth/login', '', { code: 'privacy-teacher' });
  const update = await request('PUT', '/auth/me', login.payload.token, {
    nickname: '新老师',
    phone: '13700000000',
    avatar_url: '',
  });
  assert.equal(update.response.status, 200);
  assertNoPhoneField(update.payload.user);
  assert.equal(getDB().get('SELECT phone FROM users WHERE id=?', [teacherId]).phone, '13800000000');
});

test('家长绑定接口不返回老师历史电话字段', async () => {
  const list = await request('GET', '/bind/students', parentToken);
  assert.equal(list.response.status, 200);
  assert.equal(list.payload.students.length, 1);
  assertNoPhoneField(list.payload.students[0]);

  const first = await request('GET', '/bind/student', parentToken);
  assert.equal(first.response.status, 200);
  assertNoPhoneField(first.payload.student);
});
