const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

// 模板ID（审核通过后替换）
const TPLS = {
  checkin:  process.env.TPL_CHECKIN  || '',
  checkout: process.env.TPL_CHECKOUT || '',
  reminder: process.env.TPL_REMINDER || '',
  feedback: process.env.TPL_FEEDBACK || ''
};
const FIELDS = {
  checkin: {
    student: process.env.TPL_FIELD_CHECKIN_STUDENT || 'thing1',
    time: process.env.TPL_FIELD_CHECKIN_TIME || 'time2',
    status: process.env.TPL_FIELD_CHECKIN_STATUS || 'phrase3'
  },
  checkout: {
    student: process.env.TPL_FIELD_CHECKOUT_STUDENT || 'thing1',
    time: process.env.TPL_FIELD_CHECKOUT_TIME || 'time2',
    status: process.env.TPL_FIELD_CHECKOUT_STATUS || 'phrase3'
  },
  reminder: {
    className: process.env.TPL_FIELD_REMINDER_CLASS || 'thing1',
    time: process.env.TPL_FIELD_REMINDER_TIME || 'time2',
    note: process.env.TPL_FIELD_REMINDER_NOTE || 'thing3'
  },
  feedback: {
    title: process.env.TPL_FIELD_FEEDBACK_TITLE || 'thing1',
    time: process.env.TPL_FIELD_FEEDBACK_TIME || 'time2',
    note: process.env.TPL_FIELD_FEEDBACK_NOTE || 'thing3'
  }
};

function templateData(pairs) {
  return Object.fromEntries(pairs.map(([key, value]) => [key, { value: String(value || '').slice(0, 20) }]));
}

// 返回模板ID给前端
router.get('/templates', auth, (req, res) => { res.json(TPLS); });

// 通知配置自检：只返回是否已配置，不暴露密钥
router.get('/status', auth, (req, res) => {
  res.json({
    appId: !!process.env.APP_ID,
    appSecret: !!process.env.APP_SECRET,
    templates: {
      checkin: !!TPLS.checkin,
      checkout: !!TPLS.checkout,
      reminder: !!TPLS.reminder,
      feedback: !!TPLS.feedback
    },
    fields: FIELDS,
    miniprogramState: process.env.WX_MINIPROGRAM_STATE || 'formal'
  });
});

// 存储用户的openid（家长登录后调用）
router.post('/bind-openid', auth, (req, res) => {
  getDB().run('UPDATE users SET openid=? WHERE id=?', [req.body.openid, req.user.id]);
  res.json({ ok: true });
});

// === 消息发送（内部调用）===

let accessToken = null, tokenExpire = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpire) return accessToken;
  const appId = process.env.APP_ID;
  const secret = process.env.APP_SECRET;
  if (!appId || !secret) return null;
  const axios = require('axios');
  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: { grant_type: 'client_credential', appid: appId, secret }
  });
  accessToken = data.access_token;
  tokenExpire = Date.now() + (data.expires_in - 300) * 1000;
  return accessToken;
}

async function sendMsg(openid, tplId, data, page) {
  if (!tplId || !openid) {
    console.warn('[notify] skip subscribe message: missing template id or openid');
    return;
  }
  const token = await getAccessToken();
  if (!token) {
    console.warn('[notify] skip subscribe message: missing access token');
    return;
  }
  const axios = require('axios');
  const state = process.env.WX_MINIPROGRAM_STATE || 'formal';
  const res = await axios.post(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`, {
    touser: openid, template_id: tplId, data, page, miniprogram_state: state
  });
  if (res.data?.errcode) console.warn('[notify] send failed', res.data);
}

// 给某学生关联的家长发消息
async function notifyParents(studentId, tplId, data, page) {
  const db = getDB();
  const parents = db.all('SELECT u.openid FROM users u JOIN bindings b ON b.parent_id=u.id WHERE b.student_id=? AND u.openid IS NOT NULL AND u.openid!=\'\'', [studentId]);
  for (const p of parents) {
    try { await sendMsg(p.openid, tplId, data, page); } catch(e) {}
  }
}

// 通知接口（给其他路由调用）
router.notifyCheckin = (studentId) => {
  const db = getDB();
  const s = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const now = new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
  notifyParents(studentId, TPLS.checkin, templateData([
    [FIELDS.checkin.student, s?.name || '学生'],
    [FIELDS.checkin.time, now],
    [FIELDS.checkin.status, '已安全到达']
  ]), 'pages/index/index');
};

router.notifyCheckout = (studentId) => {
  const db = getDB();
  const s = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const now = new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'});
  notifyParents(studentId, TPLS.checkout, templateData([
    [FIELDS.checkout.student, s?.name || '学生'],
    [FIELDS.checkout.time, now],
    [FIELDS.checkout.status, '已下课离开']
  ]), 'pages/index/index');
};

router.notifyReminder = (classId) => {
  const db = getDB();
  const cls = db.get('SELECT name FROM classes WHERE id=?', [classId]);
  notifyParentsByClass(classId, TPLS.reminder, templateData([
    [FIELDS.reminder.className, cls?.name || '学习小组'],
    [FIELDS.reminder.time, new Date().toLocaleDateString('zh-CN')],
    [FIELDS.reminder.note, '即将上课']
  ]), 'pages/index/index');
};

router.notifyFeedback = (classId) => {
  notifyParentsByClass(classId, TPLS.feedback, templateData([
    [FIELDS.feedback.title, '课后反馈已发布'],
    [FIELDS.feedback.time, new Date().toLocaleDateString('zh-CN')],
    [FIELDS.feedback.note, '点击查看详情']
  ]), 'pages/parent-feedback/index');
};

async function notifyParentsByClass(classId, tplId, data, page) {
  const db = getDB();
  const parents = db.all('SELECT DISTINCT u.openid FROM users u JOIN bindings b ON b.parent_id=u.id JOIN students s ON s.id=b.student_id WHERE s.class_id=? AND u.openid IS NOT NULL AND u.openid!=\'\'', [classId]);
  for (const p of parents) {
    try { await sendMsg(p.openid, tplId, data, page); } catch(e) {}
  }
}

module.exports = router;
