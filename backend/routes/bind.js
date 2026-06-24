const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

router.post('/', auth, (req, res) => {
  const db = getDB();
  const code = (req.body.invite_code||'').toUpperCase().trim();

  // 教师邀请码：默认关闭，部署方需在 .env 显式配置
  if (process.env.TEACHER_INVITE_CODE && code === process.env.TEACHER_INVITE_CODE) {
    db.run('UPDATE users SET role=? WHERE id=?', ['teacher', req.user.id]);
    // 角色变更后必须重新签发 token，否则旧 token 里仍是 parent，老师操作会 403「没有权限」
    const token = jwt.sign({ id: req.user.id, openid: req.user.openid, role: 'teacher' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
    return res.json({ ok: true, role: 'teacher', token });
  }

  // 学生邀请码
  if (req.user.role !== 'parent') return res.status(400).json({ error: '请使用学生邀请码' });
  const s = db.get('SELECT s.*, c.name as className FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.invite_code=?', [code]);
  if (!s) return res.status(404).json({ error: '邀请码无效' });
  const exists = db.get('SELECT id FROM bindings WHERE parent_id=? AND student_id=?', [req.user.id, s.id]);
  if (exists) return res.json({ ok: true, student: s, already: true });
  db.run('INSERT INTO bindings (parent_id, student_id) VALUES (?,?)', [req.user.id, s.id]);
  res.json({ ok: true, student: s });
});

router.get('/students', auth, (req, res) => {
  const list = getDB().all('SELECT s.*, c.name as className FROM students s JOIN bindings b ON b.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id WHERE b.parent_id=?', [req.user.id]);
  res.json({ students: list || [] });
});

router.get('/student', auth, (req, res) => {
  const s = getDB().get('SELECT s.*, c.name as className FROM students s JOIN bindings b ON b.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id WHERE b.parent_id=? LIMIT 1', [req.user.id]);
  res.json({ student: s || null });
});

module.exports = router;
