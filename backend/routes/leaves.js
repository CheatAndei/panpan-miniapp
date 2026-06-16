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
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const { student_id, class_date, reason } = req.body;
  if (!student_id || !reason) return res.status(400).json({ error: '请填写完整' });
  const db = getDB();
  const bound = db.get('SELECT id FROM bindings WHERE parent_id=? AND student_id=?', [req.user.id, student_id]);
  if (!bound) return res.status(403).json({ error: '无权操作' });
  const r = db.run('INSERT INTO leaves (student_id, parent_id, class_date, reason) VALUES (?,?,?,?)', [student_id, req.user.id, class_date, reason]);
  console.log(`[请假] student=${student_id} date=${class_date}`);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.get('/', auth, (req, res) => {
  const db = getDB();
  let leaves;
  if (req.user.role === 'teacher') {
    leaves = db.all('SELECT l.*, s.name as student_name FROM leaves l JOIN students s ON s.id=l.student_id ORDER BY l.created_at DESC LIMIT 50', []);
  } else {
    leaves = db.all('SELECT l.* FROM leaves l WHERE l.parent_id=? ORDER BY l.created_at DESC LIMIT 50', [req.user.id]);
  }
  res.json({ leaves });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  getDB().run('UPDATE leaves SET status=?, reply=? WHERE id=?', [req.body.status, req.body.reply||'', req.params.id]);
  res.json({ ok: true });
});

router.post('/feedback', auth, (req, res) => {
  console.log(`[家长反馈] user=${req.user.id}: ${(req.body.content||'').slice(0,50)}`);
  res.json({ ok: true });
});

module.exports = router;
