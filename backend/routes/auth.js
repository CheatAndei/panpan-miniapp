const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');
const { ensureRole, getUserWithRoles, setActiveRole, syncFactRoles, toPublicUser } = require('../utils/roles');
const { authRequired: auth } = require('../middleware/auth');

function env(name) {
  return (process.env[name] || '').trim();
}

function devLoginAllowed() {
  return ['test', 'development'].includes(env('NODE_ENV').toLowerCase())
    || env('ALLOW_DEV_LOGIN').toLowerCase() === 'true';
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '30d' }
  );
}

router.get('/status', (req, res) => {
  const appId = !!env('APP_ID');
  const appSecret = !!env('APP_SECRET');
  const devMode = devLoginAllowed();
  const hasAnyWechatCredential = appId || appSecret;
  res.json({
    appId,
    appSecret,
    mode: appId && appSecret ? 'wechat' : !hasAnyWechatCredential && devMode ? 'dev' : 'misconfigured',
    ready: (appId && appSecret) || (!hasAnyWechatCredential && devMode),
  });
});

router.post('/login', async (req, res) => {
  try {
    const { code, prefer_role: preferRole } = req.body;
    if (!code) return res.status(400).json({ error: '缺少code' });

    const appId = env('APP_ID');
    const appSecret = env('APP_SECRET');
    if (!appId) {
      if (!devLoginAllowed()) {
        console.error('[AUTH] APP_ID missing outside dev mode');
        return res.status(500).json({ error: '微信登录配置不完整' });
      }
      console.log('[DEV] 开发模式');
      return handleLogin(code, res, preferRole);
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
      console.error('[AUTH] jscode2session missing openid', {
        errcode: data.errcode || null,
        errmsg: data.errmsg || '',
        hasOpenid: false,
      });
      return res.status(400).json({ error: '微信没有返回 openid' });
    }
    handleLogin(data.openid, res, preferRole);
  } catch (e) {
    console.error('[AUTH] login exception', e.code || e.name || 'unknown');
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

function handleLogin(openid, res, preferRole) {
  const db = getDB();
  let user = db.get('SELECT id,openid,nickname,avatar_url,role FROM users WHERE openid=?', [openid]);

  if (!user) {
    const role = 'parent'; // 所有人默认家长，通过教师邀请码升级
    const r = db.run('INSERT INTO users (openid, role) VALUES (?,?)', [openid, role]);
    user = { id: r.lastInsertRowid, openid, nickname: null, avatar_url: null, role };
    ensureRole(db, user.id, role);
  }

  // fresh 微信登录时重新核对关系事实；修复入口可据此恢复被旧 role 覆盖的家长身份。
  syncFactRoles(db, user.id);
  user = getUserWithRoles(db, user.id, preferRole);
  if (preferRole && user.roles.includes(preferRole) && user.role !== db.get('SELECT role FROM users WHERE id=?', [user.id])?.role) {
    user = setActiveRole(db, user.id, preferRole);
  }
  const token = signToken(user);
  res.json({ token, user: toPublicUser(user) });
}

router.post('/switch-role', auth, (req, res) => {
  const user = setActiveRole(getDB(), req.user.id, String(req.body?.role || '').trim());
  if (!user) return res.status(403).json({ error: '没有该身份，无法切换' });
  res.json({ ok: true, token: signToken(user), user: toPublicUser(user) });
});

router.get('/me', auth, (req, res) => {
  const user = getUserWithRoles(getDB(), req.user.id, req.user.role);
  res.json({ user: toPublicUser(user) });
});

router.put('/me', auth, (req, res) => {
  const db = getDB();
  const current = db.get('SELECT nickname,avatar_url FROM users WHERE id=?', [req.user.id]) || {};
  const nickname = String(req.body?.nickname ?? current.nickname ?? '').trim().slice(0, 20);
  const avatarUrl = String(req.body?.avatar_url ?? current.avatar_url ?? '').trim().slice(0, 300);
  db.run('UPDATE users SET nickname=?, avatar_url=? WHERE id=?', [nickname, avatarUrl, req.user.id]);
  const user = getUserWithRoles(db, req.user.id, req.user.role);
  res.json({ ok: true, user: toPublicUser(user) });
});

module.exports = router;
