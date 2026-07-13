const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(__dirname, '..', '..', '..', '..', 'z-rubbish', `auth-production-config-${process.pid}.db`);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
process.env.NODE_ENV = 'production';
process.env.PORT = '0';
process.env.DATABASE_PATH = dbPath;
process.env.JWT_SECRET = 'auth-production-config-test-secret-long-enough';
process.env.CORS_ORIGIN = 'http://localhost';
process.env.APP_ID = '';
process.env.APP_SECRET = '';
process.env.ALLOW_DEV_LOGIN = '';
process.env.DISABLE_REMINDER = 'true';

const { start } = require('../server');
const { getDB } = require('../db/init');

let server;
let base;

test.before(async () => {
  server = await start();
  await new Promise((resolve) => server.listening ? resolve() : server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  try { fs.unlinkSync(dbPath); } catch {}
});

test('生产环境缺微信凭据时禁止把客户端 code 当 openid', async () => {
  const response = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'known-openid' }),
  });
  assert.equal(response.status, 500);
  assert.equal(getDB().get("SELECT id FROM users WHERE openid='known-openid'"), null);
});

test('登录状态明确标记生产配置错误', async () => {
  const response = await fetch(`${base}/auth/status`);
  const payload = await response.json();
  assert.equal(payload.mode, 'misconfigured');
  assert.equal(payload.ready, false);
});

test('任一微信凭据单独缺失都拒绝登录且不创建用户', async () => {
  process.env.APP_ID = 'configured-app-id';
  process.env.APP_SECRET = '';
  let response = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'partial-one' }),
  });
  assert.equal(response.status, 500);

  process.env.APP_ID = '';
  process.env.APP_SECRET = 'configured-secret';
  response = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'partial-two' }),
  });
  assert.equal(response.status, 500);
  assert.equal(getDB().get("SELECT COUNT(*) count FROM users WHERE openid IN ('partial-one','partial-two')").count, 0);

  process.env.APP_ID = '';
  process.env.APP_SECRET = '';
});

test('微信错误、空 openid 与超时都不创建用户且日志不泄露响应敏感字段', async () => {
  process.env.APP_ID = 'configured-app-id';
  process.env.APP_SECRET = 'configured-secret';
  const axios = require('axios');
  const originalGet = axios.get;
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    axios.get = async () => ({ data: { errcode: 40029, errmsg: 'invalid code' } });
    let response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'wx-error' }),
    });
    assert.equal(response.status, 400);

    axios.get = async () => ({ data: { session_key: 'must-not-be-logged', unionid: 'private-union' } });
    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'wx-no-openid' }),
    });
    assert.equal(response.status, 400);

    axios.get = async () => { const error = new Error('sensitive request details'); error.code = 'ETIMEDOUT'; throw error; };
    response = await fetch(`${base}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'wx-timeout' }),
    });
    assert.equal(response.status, 500);
    assert.equal(logs.flat(Infinity).join(' ').includes('must-not-be-logged'), false);
    assert.equal(logs.flat(Infinity).join(' ').includes('private-union'), false);
    assert.equal(getDB().get('SELECT COUNT(*) count FROM users').count, 0);
  } finally {
    axios.get = originalGet;
    console.error = originalError;
    process.env.APP_ID = '';
    process.env.APP_SECRET = '';
  }
});
