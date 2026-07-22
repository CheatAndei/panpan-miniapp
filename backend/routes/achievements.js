const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { getAccessToken } = require('../utils/wechat-access');
const { achievements } = require('../services/achievements');

const router = express.Router();
const codeCache = new Map();
const codeRequests = new Map();

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error:'请使用家长身份操作' });
  next();
}

function boundStudent(db, parentId, value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 && parentBoundStudent(db, parentId, id) ? id : 0;
}

function recordForParent(db, parentId, achievementId, studentId) {
  return db.get(`SELECT ar.* FROM achievement_records ar JOIN bindings b ON b.student_id=ar.student_id
    WHERE ar.id=? AND ar.student_id=? AND b.parent_id=?`, [achievementId, studentId, parentId]);
}

function rateAllowed(userId) {
  const now = Date.now();
  const state = codeRequests.get(userId) || [];
  const current = state.filter((item) => now - item < 60_000);
  if (current.length >= 10) { codeRequests.set(userId, current); return false; }
  current.push(now);
  codeRequests.set(userId, current);
  if (codeRequests.size > 5000) codeRequests.delete(codeRequests.keys().next().value);
  return true;
}

router.get('/', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error:'无权查看该学生的成就' });
  try { return res.json(achievements(db, studentId)); }
  catch (error) { return res.status(400).json({ error:error.message || '成就加载失败' }); }
});

router.post('/:id/seen', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  const record = studentId ? recordForParent(db, req.user.id, Number(req.params.id), studentId) : null;
  if (!record) return res.status(404).json({ error:'成就不存在' });
  db.run('UPDATE achievement_records SET seen_at=COALESCE(seen_at,CURRENT_TIMESTAMP) WHERE id=?', [record.id]);
  return res.json({ ok:true });
});

router.get('/:id/code', auth, parentOnly, async (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  const record = studentId ? recordForParent(db, req.user.id, Number(req.params.id), studentId) : null;
  if (!record) return res.status(404).json({ error:'成就不存在' });
  if (!rateAllowed(req.user.id)) return res.status(429).json({ error:'海报生成太频繁，请稍后再试' });
  const cached = codeCache.get(record.scene_token);
  if (cached && Date.now() - cached.createdAt < 6 * 60 * 60 * 1000) {
    res.set({ 'Content-Type':'image/png', 'Cache-Control':'private, max-age=21600', 'X-Content-Type-Options':'nosniff' });
    return res.end(cached.buffer);
  }
  try {
    const token = await getAccessToken();
    if (!token) return res.status(503).json({ error:'小程序码服务暂未配置' });
    const axios = require('axios');
    const state = String(process.env.WX_CODE_ENV_VERSION || process.env.WX_MINIPROGRAM_STATE || 'formal').toLowerCase();
    const envVersion = state === 'trial' ? 'trial' : state === 'develop' ? 'develop' : 'release';
    const response = await axios.post(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`, {
      scene:`a${record.scene_token.slice(0, 30)}`,
      page:'pages/guest-experience/index',
      check_path:false,
      env_version:envVersion,
      width:430,
      auto_color:false,
      line_color:{ r:24, g:58, b:54 },
      is_hyaline:false,
    }, { responseType:'arraybuffer', timeout:12000 });
    const contentType = String(response.headers?.['content-type'] || '');
    const buffer = Buffer.from(response.data || []);
    if (!contentType.includes('image') || buffer.length < 100) {
      let detail = {};
      try { detail = JSON.parse(buffer.toString('utf8')); } catch {}
      console.warn('[achievement-code] wx failed', { errcode:detail.errcode, errmsg:detail.errmsg });
      return res.status(502).json({ error:'小程序码生成失败，请稍后重试' });
    }
    codeCache.set(record.scene_token, { buffer, createdAt:Date.now() });
    if (codeCache.size > 200) codeCache.delete(codeCache.keys().next().value);
    res.set({ 'Content-Type':'image/png', 'Cache-Control':'private, max-age=21600', 'X-Content-Type-Options':'nosniff' });
    return res.end(buffer);
  } catch (error) {
    console.warn('[achievement-code] exception', error?.response?.data?.errcode || error.message);
    return res.status(502).json({ error:'小程序码生成失败，请稍后重试' });
  }
});

module.exports = router;
