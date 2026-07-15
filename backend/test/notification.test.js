const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `notification-test-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'notification-test-secret-that-is-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.APP_ID = 'notification-test-app';
process.env.APP_SECRET = 'notification-test-secret';
process.env.TPL_CHECKIN = 'tpl-checkin';
process.env.TPL_CHECKOUT = 'tpl-checkout';
process.env.TPL_FEEDBACK = 'tpl-feedback';
process.env.TPL_REMINDER = 'tpl-reminder';
process.env.TPL_FIELD_CHECKIN_STUDENT = 'thing1';
process.env.TPL_FIELD_CHECKIN_TIME = 'time3';
process.env.TPL_FIELD_CHECKIN_STATUS = 'phrase2';
process.env.TPL_FIELD_REMINDER_CLASS = 'thing1';
process.env.TPL_FIELD_REMINDER_TIME = 'time2';
process.env.TPL_FIELD_REMINDER_NOTE = 'thing3';
process.env.UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'notification-uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'notification-private-uploads');

const originalAxiosGet = axios.get;
const originalAxiosPost = axios.post;
axios.get = async () => ({ data: { access_token: 'test-access-token', expires_in: 7200 } });

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let classId;
let capturedPayload;

async function post(url, body) {
  const response = await fetch(base + url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('notify-teacher','teacher','测试老师')");
  const parent = db.run("INSERT INTO users(openid,role,nickname) VALUES('notify-parent','parent','测试家长')");
  const cls = db.run('INSERT INTO classes(teacher_id,name) VALUES(?,?)', [teacher.lastInsertRowid, '数学小组']);
  const student = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, cls.lastInsertRowid, '小明', 'NT0001']);
  db.run('INSERT INTO bindings(parent_id,student_id) VALUES(?,?)', [parent.lastInsertRowid, student.lastInsertRowid]);
  classId = cls.lastInsertRowid;
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'notify-teacher', role: 'teacher' }, process.env.JWT_SECRET);
});

test.after(async () => {
  axios.get = originalAxiosGet;
  axios.post = originalAxiosPost;
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('发送数据只包含当前模板配置的字段，不伪造 thing/time/phrase 1-20', async () => {
  axios.post = async (_url, payload) => {
    capturedPayload = payload;
    return { data: { errcode: 0, errmsg: 'ok' } };
  };
  const result = await post('/notify/test', { type: 'checkin' });
  assert.equal(result.response.status, 200);
  assert.deepEqual(Object.keys(capturedPayload.data).sort(), ['phrase2', 'thing1', 'time3']);
});

test('上课提醒显示实际课程日期和时间，而不是发送当天日期', async () => {
  axios.post = async (_url, payload) => {
    capturedPayload = payload;
    return { data: { errcode: 0, errmsg: 'ok' } };
  };
  const result = await post('/schedules/special-publish', {
    class_id: classId,
    class_date: '2026-07-20',
    start_time: '18:30',
    end_time: '20:00',
    location: '黄埔教室'
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.payload.notify.ok, true);
  assert.equal(capturedPayload.data.time2.value, '2026-07-20 18:30');
  assert.equal(capturedPayload.data.thing3.value, '黄埔教室');
});

test('微信模板字段错误会返回可读错误，而不是把英文 errmsg 当页面提示', async () => {
  axios.post = async () => ({ data: { errcode: 47003, errmsg: 'data.thing2.value invalid' } });
  const result = await post('/notify/test', { type: 'feedback' });
  assert.equal(result.response.status, 400);
  assert.equal(result.payload.error, '通知内容与微信模板不匹配，请联系管理员检查模板字段');
  assert.equal(result.payload.errcode, 47003);
});
