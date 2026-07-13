const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');

router.get('/', auth, (req, res) => {
  const db = getDB();
  const classes = db.all('SELECT c.*, (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id) as student_count FROM classes c WHERE c.teacher_id=? ORDER BY c.name', [req.user.id]);
  res.json({ classes: classes.map(c => ({ ...c, studentCount: c.student_count })) });
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { name, grade, subject } = req.body;
  if (!name) return res.status(400).json({ error: '缺少班级名称' });
  const r = getDB().run('INSERT INTO classes (teacher_id, name, grade, subject) VALUES (?,?,?,?)', [req.user.id, name, grade, subject]);
  res.json({ ok: true, class: { id: r.lastInsertRowid, name, grade, subject } });
});

router.get('/:id', auth, (req, res) => {
  const db = getDB();
  const sql = req.user.role === 'teacher'
    ? 'SELECT * FROM classes WHERE id=? AND teacher_id=?'
    : 'SELECT c.* FROM classes c JOIN students s ON s.class_id=c.id JOIN bindings b ON b.student_id=s.id WHERE c.id=? AND b.parent_id=? LIMIT 1';
  const c = db.get(sql, [req.params.id, req.user.id]);
  res.json({ class: c || null });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { name, grade, subject } = req.body;
  getDB().run('UPDATE classes SET name=?, grade=?, subject=? WHERE id=? AND teacher_id=?', [name, grade, subject, req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  getDB().run('DELETE FROM classes WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
