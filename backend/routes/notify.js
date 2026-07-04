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

router.post('/test', auth, async (req, res) => {
  const tplId = TPLS.feedback || TPLS.checkin || TPLS.reminder || TPLS.checkout;
  if (!tplId) return res.status(400).json({ ok: false, error: '服务通知模板未配置' });
  if (!req.user.openid) return res.status(400).json({ ok: false, error: '当前账号缺少 openid，请重新微信登录' });
  try {
    const result = await sendMsg(req.user.openid, tplId, templateData([
      [FIELDS.feedback.title, '服务通知测试'],
      [FIELDS.feedback.time, new Date().toLocaleDateString('zh-CN')],
      [FIELDS.feedback.note, '收到这条说明配置正常']
    ]), 'pages/index/index');
    res.status(result.ok ? 200 : 400).json(result);
  } catch (e) {
    console.error('[notify] test failed', e.message);
    res.status(500).json({ ok: false, error: '测试发送失败', detail: e.message });
  }
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
  if (!data.access_token) {
    console.warn('[notify] get access token failed', { errcode: data.errcode, errmsg: data.errmsg });
    return null;
  }
  accessToken = data.access_token;
  tokenExpire = Date.now() + (data.expires_in - 300) * 1000;
  return accessToken;
}

async function sendMsg(openid, tplId, data, page) {
  if (!tplId || !openid) {
    console.warn('[notify] skip subscribe message: missing template id or openid');
    return { ok: false, error: 'missing template id or openid' };
  }
  const token = await getAccessToken();
  if (!token) {
    console.warn('[notify] skip subscribe message: missing access token');
    return { ok: false, error: 'missing access token' };
  }
  const axios = require('axios');
  const state = process.env.WX_MINIPROGRAM_STATE || 'formal';
  const res = await axios.post(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`, {
    touser: openid, template_id: tplId, data, page, miniprogram_state: state
  });
  const wx = res.data || {};
  if (wx.errcode) console.warn('[notify] send failed', wx);
  return { ok: !wx.errcode, errcode: wx.errcode || 0, errmsg: wx.errmsg || 'ok', miniprogramState: state };
}

// 给某学生关联的家长发消息
async function notifyParents(studentId, tplId, data, page) {
  const db = getDB();
  const parents = db.all('SELECT u.openid FROM users u JOIN bindings b ON b.parent_id=u.id WHERE b.student_id=? AND u.openid IS NOT NULL AND u.openid!=\'\'', [studentId]);
  if (parents.length === 0) console.warn('[notify] no parent openid for student', studentId);
  for (const p of parents) {
    try { await sendMsg(p.openid, tplId, data, page); } catch(e) { console.warn('[notify] parent send exception', e.message); }
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
  if (parents.length === 0) console.warn('[notify] no parent openid for class', classId);
  for (const p of parents) {
    try { await sendMsg(p.openid, tplId, data, page); } catch(e) { console.warn('[notify] class send exception', e.message); }
  }
}

module.exports = router;
