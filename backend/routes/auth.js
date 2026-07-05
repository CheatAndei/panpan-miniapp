const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function env(name) {
  return (process.env[name] || '').trim();
}

router.get('/status', (req, res) => {
  res.json({
    appId: !!env('APP_ID'),
    appSecret: !!env('APP_SECRET'),
    mode: env('APP_ID') ? 'wechat' : 'dev'
  });
});

router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '缺少code' });

    const appId = env('APP_ID');
    const appSecret = env('APP_SECRET');
    if (!appId) {
      console.log('[DEV] 开发模式');
      return handleLogin(code, res);
    }
    if (!appSecret) {
      console.error('[AUTH] APP_SECRET missing');
      return res.status(500).json({ error: '微信登录配置缺少 APP_SECRET' });
    }

    const axios = require('axios');
    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: { appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' },
      timeout: 8000
    });
    if (data.errcode) {
      console.error('[AUTH] jscode2session failed', { errcode: data.errcode, errmsg: data.errmsg });
      const hint = data.errcode === 40013 ? 'AppID 不正确'
        : data.errcode === 40125 ? 'AppSecret 不正确或已重置'
        : data.errcode === 40164 ? '服务器 IP 未加入微信接口 IP 白名单'
        : data.errcode === 40029 ? '登录 code 无效，请重新打开小程序'
        : data.errcode === 45011 ? '登录太频繁，请稍后再试'
        : '微信登录失败';
      return res.status(400).json({ error: hint, errcode: data.errcode });
    }
    if (!data.openid) {
      console.error('[AUTH] jscode2session missing openid', data);
      return res.status(400).json({ error: '微信没有返回 openid' });
    }
    handleLogin(data.openid, res);
  } catch (e) {
    console.error('[AUTH] login exception', e.message);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

function handleLogin(openid, res) {
  const db = getDB();
  let user = db.get('SELECT * FROM users WHERE openid=?', [openid]);

  if (!user) {
    const role = 'parent'; // 所有人默认家长，通过教师邀请码升级
    const r = db.run('INSERT INTO users (openid, role) VALUES (?,?)', [openid, role]);
    user = { id: r.lastInsertRowid, openid, nickname: null, avatar_url: null, role };
  }

  const token = jwt.sign({ id: user.id, openid: user.openid, role: user.role }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
  res.json({ token, user });
}

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

router.get('/me', auth, (req, res) => {
  const user = getDB().get('SELECT id,openid,nickname,avatar_url,role,phone FROM users WHERE id=?', [req.user.id]);
  res.json({ user: user || null });
});

router.put('/me', auth, (req, res) => {
  const nickname = String(req.body?.nickname || '').trim().slice(0, 20);
  getDB().run('UPDATE users SET nickname=? WHERE id=?', [nickname, req.user.id]);
  const user = getDB().get('SELECT id,openid,nickname,avatar_url,role,phone FROM users WHERE id=?', [req.user.id]);
  res.json({ ok: true, user });
});

module.exports = router;
