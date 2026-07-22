const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');
const { getAccessToken } = require('../utils/wechat-access');

// 模板ID（审核通过后替换）
const TPLS = {
  checkin:  process.env.TPL_CHECKIN  || '',
  checkout: process.env.TPL_CHECKOUT || '',
  reminder: process.env.TPL_REMINDER || '',
  feedback: process.env.TPL_FEEDBACK || '',
  homework: process.env.TPL_HOMEWORK || ''
};
const FIELDS = {
  checkin: {
    time: process.env.TPL_FIELD_CHECKIN_TIME || 'time5',
    status: process.env.TPL_FIELD_CHECKIN_STATUS || 'phrase6',
    note: process.env.TPL_FIELD_CHECKIN_NOTE || process.env.TPL_FIELD_CHECKIN_STUDENT || 'thing3'
  },
  checkout: {
    time: process.env.TPL_FIELD_CHECKOUT_TIME || 'time5',
    status: process.env.TPL_FIELD_CHECKOUT_STATUS || 'phrase6',
    note: process.env.TPL_FIELD_CHECKOUT_NOTE || process.env.TPL_FIELD_CHECKOUT_STUDENT || 'thing3'
  },
  reminder: {
    className: process.env.TPL_FIELD_REMINDER_CLASS || 'thing1',
    time: process.env.TPL_FIELD_REMINDER_TIME || 'time3',
    note: process.env.TPL_FIELD_REMINDER_NOTE || 'thing4'
  },
  feedback: {
    title: process.env.TPL_FIELD_FEEDBACK_TITLE || 'thing1',
    time: process.env.TPL_FIELD_FEEDBACK_TIME || 'time3',
    note: process.env.TPL_FIELD_FEEDBACK_NOTE || 'thing4'
  },
  homework: {
    title: process.env.TPL_FIELD_HOMEWORK_TITLE || 'thing1',
    time: process.env.TPL_FIELD_HOMEWORK_TIME || 'time4',
    note: process.env.TPL_FIELD_HOMEWORK_NOTE || 'thing5',
    status: process.env.TPL_FIELD_HOMEWORK_STATUS || 'phrase2'
  }
};

function templateData(pairs) {
  const data = {};
  for (const [key, value] of pairs) {
    if (!key) continue;
    const text = String(value || '').trim();
    if (/^time\d+$/.test(key) && text && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
      throw new Error(`${key} 必须使用 HH:mm 时间格式`);
    }
    if (/^date\d+$/.test(key) && text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new Error(`${key} 必须使用 YYYY-MM-DD 日期格式`);
    }
    const max = /^phrase\d+$/.test(key) ? 5 : /^thing\d+$/.test(key) ? 20 : 32;
    data[key] = { value: text.slice(0, max) };
  }
  return data;
}

function reminderNote(classDate, note) {
  const parts = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(classDate || ''))) {
    const [, month, day] = String(classDate).split('-');
    parts.push(`${Number(month)}月${Number(day)}日`);
  }
  if (String(note || '').trim()) parts.push(String(note).trim());
  return parts.join(' · ').slice(0, 20);
}

function templateFieldNames(content) {
  return [...String(content || '').matchAll(/\{\{([a-z]+\d+)\.DATA\}\}/g)].map((match) => match[1]);
}

function checkoutData(studentName, now, note = '') {
  const isSpecial = !!String(note || '').trim();
  const status = isSpecial ? '已离开' : '已下课离开';
  const noteText = [studentName, isSpecial ? note : ''].filter(Boolean).join(' · ');
  return templateData([
    [FIELDS.checkout.time, now],
    [FIELDS.checkout.status, status],
    [FIELDS.checkout.note, noteText]
  ]);
}

function wxTime(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const bj = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}`;
}

function bjDate(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function userOpenid(userId, fallback = '') {
  const user = getDB().get('SELECT openid FROM users WHERE id=?', [userId]);
  return user?.openid || fallback || '';
}

function templateByType(type) {
  const key = ['checkin', 'checkout', 'feedback', 'reminder', 'homework'].includes(type) ? type : 'checkin';
  return { key, tplId: TPLS[key], fields: FIELDS[key] };
}

function notifyErrorMessage(errcode) {
  const messages = {
    40003: '接收账号信息已失效，请家长重新进入小程序登录',
    40037: '服务通知模板无效，请联系管理员检查模板 ID',
    41030: '服务通知跳转页面配置有误，请联系管理员处理',
    43101: '家长未订阅该通知，或本次订阅次数已用完',
    43107: '微信已暂停当前账号的订阅消息能力，请联系管理员处理',
    47003: '通知内容与微信模板不匹配，请联系管理员检查模板字段'
  };
  return messages[errcode] || '服务通知发送失败，请稍后重试';
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
      feedback: !!TPLS.feedback,
      homework: !!TPLS.homework
    },
    fields: FIELDS,
    miniprogramState: process.env.WX_MINIPROGRAM_STATE || 'formal'
  });
});

// 必须由已加入微信白名单的生产服务执行；用于核对真实模板字段，不暴露 AppSecret。
router.get('/diagnostics/templates', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可检查通知模板' });
  try {
    const token = await getAccessToken();
    if (!token) return res.status(502).json({ error: '无法获取微信访问令牌' });
    const axios = require('axios');
    const response = await axios.get('https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate', {
      params: { access_token: token },
    });
    if (response.data?.errcode) {
      return res.status(502).json({ error: '微信模板读取失败', errcode: response.data.errcode, errmsg: response.data.errmsg });
    }
    const remote = Array.isArray(response.data?.data) ? response.data.data : [];
    const templates = Object.entries(TPLS).map(([name, templateId]) => {
      const item = remote.find((row) => row.priTmplId === templateId) || null;
      const configuredFields = Object.values(FIELDS[name] || {}).filter(Boolean);
      const actualFields = templateFieldNames(item?.content);
      return {
        name,
        configured: !!templateId,
        found: !!item,
        title: item?.title || '',
        content: item?.content || '',
        configured_fields: configuredFields,
        actual_fields: actualFields,
        fields_match: !!item && configuredFields.every((field) => actualFields.includes(field)),
      };
    });
    res.json({ ok: true, checked_from: 'production-server', templates });
  } catch (error) {
    console.warn('[notify] template diagnostics failed', error.response?.data || error.message);
    res.status(502).json({ error: '微信模板读取失败', detail: error.response?.data?.errmsg || error.message });
  }
});

router.post('/test', auth, async (req, res) => {
  const { key, tplId, fields } = templateByType(req.body?.type);
  if (!tplId) return res.status(400).json({ ok: false, error: `${key} 服务通知模板未配置` });
  const openid = userOpenid(req.user.id, req.user.openid);
  if (!openid) return res.status(400).json({ ok: false, error: '当前账号缺少 openid，请重新微信登录' });
  try {
    const isCheckout = key === 'checkout';
    const isFeedback = key === 'feedback';
    const isReminder = key === 'reminder';
    const isHomework = key === 'homework';
    const result = await sendMsg(openid, tplId, templateData(isHomework ? [
      [fields.title, '作业批改测试'],
      [fields.time, wxTime()],
      [fields.note, '收到说明配置正常'],
      [fields.status, '已完成']
    ] : isFeedback ? [
      [fields.title, '课后反馈测试'],
      [fields.time, wxTime()],
      [fields.note, '收到说明配置正常']
    ] : isReminder ? [
      [fields.className, '测试学习小组'],
      [fields.time, wxTime()],
      [fields.note, '即将上课']
    ] : [
      [fields.time, wxTime()],
      [fields.status, isCheckout ? '已下课离开' : '已安全到达'],
      [fields.note, '测试学生']
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

async function sendMsg(openid, tplId, data, page) {
  if (!tplId || !openid) {
    console.warn('[notify] skip subscribe message: missing template id or openid');
    return { ok: false, error: '服务通知模板或接收账号缺失，请联系管理员检查配置' };
  }
  const token = await getAccessToken();
  if (!token) {
    console.warn('[notify] skip subscribe message: missing access token');
    return { ok: false, error: '暂时无法连接微信通知服务，请联系管理员检查 AppID 和密钥' };
  }
  const axios = require('axios');
  const state = process.env.WX_MINIPROGRAM_STATE || 'formal';
  const res = await axios.post(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`, {
    touser: openid, template_id: tplId, data, page, miniprogram_state: state
  });
  const wx = res.data || {};
  if (wx.errcode) console.warn('[notify] send failed', {
    errcode: wx.errcode,
    errmsg: wx.errmsg,
    template: String(tplId).slice(-8),
    fields: Object.keys(data || {}),
  });
  return {
    ok: !wx.errcode,
    errcode: wx.errcode || 0,
    errmsg: wx.errmsg || 'ok',
    ...(wx.errcode ? { error: notifyErrorMessage(wx.errcode) } : {}),
    miniprogramState: state
  };
}

// 给某学生关联的家长发消息
async function notifyParents(studentId, tplId, data, page, templateName = '服务通知') {
  const db = getDB();
  const parents = db.all('SELECT u.openid FROM users u JOIN bindings b ON b.parent_id=u.id WHERE b.student_id=? AND u.openid IS NOT NULL AND u.openid!=\'\'', [studentId]);
  const result = { ok: true, total: parents.length, sent: 0, failed: 0, errors: [] };
  if (!tplId) return { ...result, ok: false, error: `${templateName}模板未配置` };
  if (parents.length === 0) {
    console.warn('[notify] no parent openid for student', studentId);
    return { ...result, ok: false, error: '没有找到已绑定且有 openid 的家长' };
  }
  for (const p of parents) {
    try {
      const sent = await sendMsg(p.openid, tplId, data, page);
      if (sent.ok) result.sent++;
      else {
        result.failed++;
        result.errors.push(sent.error || sent.errmsg || '服务通知发送失败');
      }
    } catch(e) {
      result.failed++;
      result.errors.push(e.message);
      console.warn('[notify] parent send exception', e.message);
    }
  }
  result.ok = result.sent > 0 && result.failed === 0;
  if (!result.ok && result.errors.length > 0) result.error = result.errors[0];
  return result;
}

// 通知接口（给其他路由调用）
router.notifyCheckin = async (studentId) => {
  const db = getDB();
  const s = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const now = wxTime();
  return notifyParents(studentId, TPLS.checkin, templateData([
    [FIELDS.checkin.time, now],
    [FIELDS.checkin.status, '已安全到达'],
    [FIELDS.checkin.note, s?.name || '学生']
  ]), 'pages/index/index', '签到提醒');
};

router.notifyArrivalReminder = async (studentId) => {
  const db = getDB();
  const s = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const now = wxTime();
  return notifyParents(studentId, TPLS.checkin, templateData([
    [FIELDS.checkin.time, now],
    [FIELDS.checkin.status, '仍未到达'],
    [FIELDS.checkin.note, s?.name || '学生']
  ]), 'pages/index/index', '到达提醒');
};

router.notifyCheckout = async (studentId, note = '') => {
  const db = getDB();
  const s = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const now = wxTime();
  return notifyParents(studentId, TPLS.checkout, checkoutData(s?.name || '学生', now, note), 'pages/index/index', '签退提醒');
};

router.notifyReminder = async (classId, options = {}) => {
  const db = getDB();
  const cls = db.get('SELECT name FROM classes WHERE id=?', [classId]);
  const details = typeof options === 'string' ? { note: options } : (options || {});
  const classTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(details.startTime || '')) ? details.startTime : wxTime();
  return notifyParentsByClass(classId, TPLS.reminder, templateData([
    [FIELDS.reminder.className, cls?.name || '学习小组'],
    [FIELDS.reminder.time, classTime],
    [FIELDS.reminder.note, reminderNote(details.classDate, details.note)]
  ]), 'pages/index/index', '上课提醒');
};

router.notifyFeedback = async (classId) => {
  const db = getDB();
  const cls = db.get('SELECT name FROM classes WHERE id=?', [classId]);
  return notifyParentsByClass(classId, TPLS.feedback, templateData([
    [FIELDS.feedback.title, '课后反馈已发布'],
    [FIELDS.feedback.time, wxTime()],
    [FIELDS.feedback.note, cls?.name || '学习小组']
  ]), 'pages/index/index', '课后反馈');
};

router.notifyHomework = async (studentId, batchId, title = '作业批改已完成') => {
  const db = getDB();
  const student = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  return notifyParents(studentId, TPLS.homework, templateData([
    [FIELDS.homework.title, title],
    [FIELDS.homework.time, wxTime()],
    [FIELDS.homework.note, student?.name || '学生'],
    [FIELDS.homework.status, '已完成']
  ]), `pages/parent-homework/index?batch_id=${batchId}`, '作业批改提醒');
};

router.notifyHomeworkParent = async (parentId, studentId, batchId, title = '作业批改已完成') => {
  const db = getDB();
  const student = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const openid = userOpenid(parentId);
  return sendMsg(openid, TPLS.homework, templateData([
    [FIELDS.homework.title, title],
    [FIELDS.homework.time, wxTime()],
    [FIELDS.homework.note, student?.name || '学生'],
    [FIELDS.homework.status, '已完成']
  ]), `pages/parent-homework/index?batch_id=${batchId}`);
};

async function notifyParentsByClass(classId, tplId, data, page, templateName = '服务通知') {
  const db = getDB();
  const parents = db.all('SELECT DISTINCT u.openid FROM users u JOIN bindings b ON b.parent_id=u.id JOIN students s ON s.id=b.student_id WHERE s.class_id=? AND u.openid IS NOT NULL AND u.openid!=\'\'', [classId]);
  const result = { ok: true, total: parents.length, sent: 0, failed: 0, errors: [] };
  if (!tplId) return { ...result, ok: false, error: `${templateName}模板未配置` };
  if (parents.length === 0) {
    console.warn('[notify] no parent openid for class', classId);
    return { ...result, ok: false, error: '没有找到已绑定且有 openid 的家长' };
  }
  for (const p of parents) {
    try {
      const sent = await sendMsg(p.openid, tplId, data, page);
      if (sent.ok) result.sent++;
      else {
        result.failed++;
        result.errors.push(sent.error || sent.errmsg || '服务通知发送失败');
      }
    } catch(e) {
      result.failed++;
      result.errors.push(e.message);
      console.warn('[notify] class send exception', e.message);
    }
  }
  result.ok = result.sent > 0 && result.failed === 0;
  if (!result.ok && result.errors.length > 0) result.error = result.errors[0];
  return result;
}

module.exports = router;
