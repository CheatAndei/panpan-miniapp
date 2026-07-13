const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `feedback-generation-test-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'feedback-generation-test-secret';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.DEEPSEEK_API_KEY = 'test-key';

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;
let teacherToken;
let students;
let originalAxiosPost;
let capturedRequest;

async function post(url, body) {
  const response = await fetch(base + url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

test.before(async () => {
  originalAxiosPost = axios.post;
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const db = getDB();
  db.run("INSERT INTO users(openid,role) VALUES('dummy-parent','parent')");
  const teacher = db.run("INSERT INTO users(openid,role,nickname) VALUES('feedback-teacher','teacher','测试老师')");
  const cls = db.run('INSERT INTO classes(teacher_id,name) VALUES(?,?)', [teacher.lastInsertRowid, '测试班']);
  const first = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, cls.lastInsertRowid, '小明', 'FB0001']);
  const second = db.run('INSERT INTO students(teacher_id,class_id,name,invite_code) VALUES(?,?,?,?)', [teacher.lastInsertRowid, cls.lastInsertRowid, '小红', 'FB0002']);
  students = [{ id: first.lastInsertRowid, name: '小明' }, { id: second.lastInsertRowid, name: '小红' }];
  teacherToken = jwt.sign({ id: teacher.lastInsertRowid, openid: 'feedback-teacher', role: 'teacher' }, process.env.JWT_SECRET);
});

test.after(async () => {
  axios.post = originalAxiosPost;
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('批量反馈把 AI 数组下标恢复为真实学生 id，并为温馨版扩充 token', async () => {
  axios.post = async (_url, request) => {
    capturedRequest = request;
    return { data: { choices: [{ message: { content: JSON.stringify({
      results: [
        { id: 0, feedback: '🏆小明\n课堂列式清晰。✨' },
        { id: 1, feedback: '🪄小红\n今天主动讲出了思路。🌱' }
      ]
    }) } }] } };
  };
  const result = await post('/feedbacks/generate-student-batch', {
    students,
    classInfo: { content: '分数计算', perfScore: 8 },
    style: 'warm'
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.results.map((item) => item.id), students.map((item) => item.id));
  assert.equal(result.payload.results[0].feedback.startsWith('小明：'), false);
  assert.match(result.payload.results[0].feedback, /🏆/u);
  assert.equal(result.payload.results[1].feedback.includes('🪄'), false);
  assert.match(result.payload.results[1].feedback, /🌱/u);
  assert.ok(capturedRequest.max_tokens > 400);
});

test('学习小组反馈提示词用真实 emoji，不再发送 [加油] 死文本', async () => {
  axios.post = async (_url, request) => {
    capturedRequest = request;
    return { data: { choices: [{ message: { content: '测试反馈' } }] } };
  };
  const result = await post('/feedbacks/generate-class', {
    grade: '五年级', subject: '数学', lesson: '第一课', topic: '分数', perfScore: 8
  });
  assert.equal(result.response.status, 200);
  assert.equal(capturedRequest.messages[0].content.includes('[加油]'), false);
  assert.match(capturedRequest.messages[0].content, /💪 课堂表现/u);
  assert.equal(capturedRequest.messages[0].content.includes('📚 作业说明'), false);
  assert.match(capturedRequest.messages[0].content, /不要把作业写进反馈正文/u);
});

test('简洁版批量反馈同样返回真实学生 id，避免前端成功但没有内容', async () => {
  axios.post = async () => ({ data: { choices: [{ message: { content: JSON.stringify({
    results: [
      { id: 0, feedback: '小明：课堂列式清晰。' },
      { id: 1, feedback: '小红：主动讲出了思路。' }
    ]
  }) } }] } });
  const result = await post('/feedbacks/generate-student-batch', { students, classInfo: {}, style: 'concise' });
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.payload.results.map((item) => item.id), students.map((item) => item.id));
});
