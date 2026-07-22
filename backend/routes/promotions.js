const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { getAccessToken } = require('../utils/wechat-access');
const { teacherPromotions, serializeEvent } = require('../services/promotions');

const router = express.Router();
const codeCache = new Map();
const codeRequests = new Map();

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error:'仅教师可操作' });
  next();
}

function ownedEvent(db, teacherId, eventId) {
  return db.get('SELECT * FROM teacher_promotion_events WHERE id=? AND teacher_id=?', [eventId, teacherId]);
}

function rateAllowed(userId) {
  const now = Date.now();
  const current = (codeRequests.get(userId) || []).filter((item) => now - item < 60_000);
  if (current.length >= 10) { codeRequests.set(userId, current); return false; }
  current.push(now);
  codeRequests.set(userId, current);
  if (codeRequests.size > 5000) codeRequests.delete(codeRequests.keys().next().value);
  return true;
}

router.get('/', auth, teacherOnly, (req, res) => {
  const unseenOnly = String(req.query.unseen || '0') === '1';
  return res.json(teacherPromotions(getDB(), { teacherId:req.user.id, unseenOnly, limit:req.query.limit }));
});

router.post('/:id/seen', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const event = ownedEvent(db, req.user.id, Number(req.params.id));
  if (!event) return res.status(404).json({ error:'宣传海报不存在' });
  db.run('UPDATE teacher_promotion_events SET seen_at=COALESCE(seen_at,CURRENT_TIMESTAMP) WHERE id=?', [event.id]);
  return res.json({ ok:true, promotion:serializeEvent({ ...event, seen_at:event.seen_at || new Date().toISOString() }) });
});

router.get('/:id/code', auth, teacherOnly, async (req, res) => {
  const db = getDB();
  const event = ownedEvent(db, req.user.id, Number(req.params.id));
  if (!event) return res.status(404).json({ error:'宣传海报不存在' });
  if (!rateAllowed(req.user.id)) return res.status(429).json({ error:'海报生成太频繁，请稍后再试' });
  const cached = codeCache.get(event.scene_token);
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
      scene:`p${event.scene_token.slice(0, 30)}`,
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
    if (!contentType.includes('image') || buffer.length < 100) return res.status(502).json({ error:'小程序码生成失败，请稍后重试' });
    codeCache.set(event.scene_token, { buffer, createdAt:Date.now() });
    if (codeCache.size > 200) codeCache.delete(codeCache.keys().next().value);
    res.set({ 'Content-Type':'image/png', 'Cache-Control':'private, max-age=21600', 'X-Content-Type-Options':'nosniff' });
    return res.end(buffer);
  } catch (error) {
    console.warn('[promotion-code] exception', error?.response?.data?.errcode || error.message);
    return res.status(502).json({ error:'小程序码生成失败，请稍后重试' });
  }
});

module.exports = router;
