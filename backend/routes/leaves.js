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

router.post('/teacher-mark', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { student_id, class_date, reason } = req.body || {};
  if (!student_id || !class_date) return res.status(400).json({ error: '缺少学生或日期' });
  const db = getDB();
  const student = db.get('SELECT id, name FROM students WHERE id=? AND teacher_id=?', [student_id, req.user.id]);
  if (!student) return res.status(403).json({ error: '无权操作该学生' });
  const exists = db.get('SELECT id FROM leaves WHERE student_id=? AND class_date=?', [student_id, class_date]);
  const finalReason = reason || '老师在签到页标记请假';
  if (exists) {
    db.run('UPDATE leaves SET status=?, reason=? WHERE id=?', ['approved', finalReason, exists.id]);
    return res.json({ ok: true, id: exists.id, updated: true });
  }
  const r = db.run('INSERT INTO leaves (student_id, parent_id, class_date, reason, status) VALUES (?,?,?,?,?)', [student_id, null, class_date, finalReason, 'approved']);
  res.json({ ok: true, id: r.lastInsertRowid, updated: false });
});

router.post('/feedback', auth, (req, res) => {
  console.log(`[家长反馈] user=${req.user.id}: ${(req.body.content||'').slice(0,50)}`);
  res.json({ ok: true });
});

module.exports = router;
