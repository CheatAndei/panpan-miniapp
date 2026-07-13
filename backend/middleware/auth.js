const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const { getUserWithRoles } = require('../utils/roles');

const { JWT_SECRET } = require('../config');

/**
 * JWT 鉴权中间件
 * 从 Authorization header 提取 token，验证后挂载 user 到 req
 */
function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }

  try {
    const token = header.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const user = getUserWithRoles(getDB(), payload.id, payload.role);
    if (!user || !user.roles.includes(payload.role)) {
      return res.status(401).json({ error: '登录身份已失效，请重新登录' });
    }
    req.user = { ...payload, openid: user.openid, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

/**
 * 角色校验中间件
 * @param  {...string} roles 允许的角色列表
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '请先登录' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '没有权限执行此操作' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole, JWT_SECRET };
