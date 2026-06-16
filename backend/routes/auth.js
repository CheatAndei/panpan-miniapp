const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

router.post('/login', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: '缺少code' });

    if (!process.env.APP_ID) {
      console.log('[DEV] 开发模式');
      return handleLogin(code, res);
    }

    const axios = require('axios');
    const { data } = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: { appid: process.env.APP_ID, secret: process.env.APP_SECRET, js_code: code, grant_type: 'authorization_code' }
    });
    if (data.errcode) return res.status(400).json({ error: '微信登录失败' });
    handleLogin(data.openid, res);
  } catch (e) { res.status(500).json({ error: '登录失败' }); }
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

module.exports = router;
