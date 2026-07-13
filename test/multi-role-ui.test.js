const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'pages', 'index', 'index.vue'), 'utf8');
const mine = fs.readFileSync(path.join(root, 'pages', 'mine', 'index.vue'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'utils', 'auth.js'), 'utf8');
const bind = fs.readFileSync(path.join(root, 'pages', 'bind', 'bind.vue'), 'utf8');

test('未登录首页提供登录失败修复并优先请求家长角色', () => {
  assert.match(home, /切换身份 \/ 登录修复/);
  assert.match(home, /handleLoginRepair/);
  assert.match(auth, /prefer_role:\s*options\.preferRole/);
  assert.match(home, /doLogin\(\{\s*preferRole:\s*'parent'/);
  assert.match(home, /clearLocalSession\(\)/);
  assert.match(home, /loggedInUser\.role === 'teacher'[\s\S]*?\/pages\/bind\/bind\?source=repair/);
});

test('我的页只在多角色时显示家长教师切换并调用安全接口', () => {
  assert.match(mine, /user\.roles\.length\s*>\s*1/);
  assert.match(mine, /切换到家长端/);
  assert.match(mine, /切换到教师端/);
  assert.match(mine, /api\.post\('\/auth\/switch-role'/);
  assert.match(mine, /绑定学生并切换到家长端/);
  assert.match(mine, /!user\.roles\.includes\('parent'\)/);
});

test('旧孩子选择不属于新账号时回退到该账号第一个绑定孩子', () => {
  assert.match(home, /const target = boundKids\.value\.find[\s\S]*?\|\| boundKids\.value\[0\][\s\S]*?\|\| null;/);
});

test('教师账号绑定学生后保存家长 JWT 并重启到家长首页', () => {
  assert.match(bind, /res\.token[\s\S]*?uni\.setStorageSync\('token',\s*res\.token\)/);
  assert.match(bind, /res\.user[\s\S]*?saveUser\(res\.user\)/);
  assert.match(bind, /goHome\(\)[\s\S]*?uni\.reLaunch\(\{url:'\/pages\/index\/index'\}\)/);
  assert.match(bind, /当前微信曾登录教师端/);
  assert.match(bind, /options\?\.source==='repair'/);
});
