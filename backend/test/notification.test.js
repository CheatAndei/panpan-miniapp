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
process.env.TPL_HOMEWORK = 'tpl-homework';
process.env.TPL_FIELD_CHECKIN_TIME = 'time5';
process.env.TPL_FIELD_CHECKIN_STATUS = 'phrase6';
process.env.TPL_FIELD_CHECKIN_NOTE = 'thing3';
process.env.TPL_FIELD_CHECKOUT_TIME = 'time5';
process.env.TPL_FIELD_CHECKOUT_STATUS = 'phrase6';
process.env.TPL_FIELD_CHECKOUT_NOTE = 'thing3';
process.env.TPL_FIELD_REMINDER_CLASS = 'thing1';
process.env.TPL_FIELD_REMINDER_TIME = 'time3';
process.env.TPL_FIELD_REMINDER_NOTE = 'thing4';
process.env.TPL_FIELD_FEEDBACK_TITLE = 'thing1';
process.env.TPL_FIELD_FEEDBACK_TIME = 'time3';
process.env.TPL_FIELD_FEEDBACK_NOTE = 'thing4';
process.env.TPL_FIELD_HOMEWORK_TITLE = 'thing1';
process.env.TPL_FIELD_HOMEWORK_TIME = 'time4';
process.env.TPL_FIELD_HOMEWORK_NOTE = 'thing5';
process.env.TPL_FIELD_HOMEWORK_STATUS = 'phrase2';
process.env.UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'notification-uploads');
process.env.PRIVATE_UPLOAD_DIR = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', 'notification-private-uploads');

const originalAxiosGet = axios.get;
const originalAxiosPost = axios.post;
axios.get = async (url) => {
  if (String(url).includes('/wxaapi/newtmpl/gettemplate')) {
    return { data: { data: [
      { priTmplId: 'tpl-checkin', title: '打卡提醒', content: '{{time5.DATA}}\n{{phrase6.DATA}}\n{{thing3.DATA}}' },
      { priTmplId: 'tpl-checkout', title: '打卡提醒', content: '{{time5.DATA}}\n{{phrase6.DATA}}\n{{thing3.DATA}}' },
      { priTmplId: 'tpl-reminder', title: '上课提醒', content: '{{thing1.DATA}}\n{{time3.DATA}}\n{{thing4.DATA}}' },
      { priTmplId: 'tpl-feedback', title: '课后反馈', content: '{{thing1.DATA}}\n{{time3.DATA}}\n{{thing4.DATA}}' },
      { priTmplId: 'tpl-homework', title: '作业状态通知', content: '{{thing1.DATA}}\n{{time4.DATA}}\n{{thing5.DATA}}\n{{phrase2.DATA}}' },
    ] } };
  }
  return { data: { access_token: 'test-access-token', expires_in: 7200 } };
};

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

async function get(url) {
  const response = await fetch(base + url, { headers: { Authorization: `Bearer ${teacherToken}` } });
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
  assert.deepEqual(Object.keys(capturedPayload.data).sort(), ['phrase6', 'thing3', 'time5']);
});

test('模板诊断由后端固定出口读取真实字段并报告匹配结果', async () => {
  const result = await get('/notify/diagnostics/templates');
  assert.equal(result.response.status, 200);
  const checkin = result.payload.templates.find((item) => item.name === 'checkin');
  const reminder = result.payload.templates.find((item) => item.name === 'reminder');
  assert.equal(checkin.fields_match, true);
  assert.equal(reminder.fields_match, true);
  assert.equal(result.payload.templates.every((item) => item.fields_match), true);
  assert.deepEqual(reminder.actual_fields, ['thing1', 'time3', 'thing4']);
});

test('上课提醒按微信 time 字段发送 HH:mm，并把课程日期放入备注', async () => {
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
  assert.equal(capturedPayload.data.time3.value, '18:30');
  assert.equal(capturedPayload.data.thing4.value, '7月20日 · 黄埔教室');
});

test('作业提醒发送真实模板要求的状态字段', async () => {
  axios.post = async (_url, payload) => {
    capturedPayload = payload;
    return { data: { errcode: 0, errmsg: 'ok' } };
  };
  const result = await post('/notify/test', { type: 'homework' });
  assert.equal(result.response.status, 200);
  assert.deepEqual(Object.keys(capturedPayload.data).sort(), ['phrase2', 'thing1', 'thing5', 'time4']);
  assert.equal(capturedPayload.data.phrase2.value, '已完成');
});

test('微信模板字段错误会返回可读错误，而不是把英文 errmsg 当页面提示', async () => {
  axios.post = async () => ({ data: { errcode: 47003, errmsg: 'data.thing2.value invalid' } });
  const result = await post('/notify/test', { type: 'feedback' });
  assert.equal(result.response.status, 400);
  assert.equal(result.payload.error, '通知内容与微信模板不匹配，请联系管理员检查模板字段');
  assert.equal(result.payload.errcode, 47003);
});
