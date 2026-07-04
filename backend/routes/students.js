const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(db) {
  let code;
  do { code = ''; for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]; }
  while (db.get('SELECT id FROM students WHERE invite_code=?', [code]));
  return code;
}

router.get('/', auth, (req, res) => {
  const db = getDB();
  const { class_id } = req.query;
  if (req.user.role === 'parent') {
    if (class_id) {
      // 家长只能查看自己已绑定孩子所在班级的学生
      const allowed = db.get('SELECT 1 FROM bindings b JOIN students bs ON bs.id=b.student_id WHERE b.parent_id=? AND bs.class_id=?', [req.user.id, class_id]);
      if (!allowed) return res.status(403).json({ error: '无权限' });
      const students = db.all('SELECT s.id, s.name, s.class_id FROM students s WHERE s.class_id=? ORDER BY s.name', [class_id]);
      return res.json({ students });
    }
    // 查自己的绑定
    const students = db.all('SELECT DISTINCT s.* FROM students s JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? ORDER BY s.name', [req.user.id]);
    return res.json({ students });
  }
  let sql = 'SELECT s.* FROM students s JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=?';
  const params = [req.user.id];
  if (class_id) { sql += ' AND s.class_id=?'; params.push(class_id); }
  sql += ' ORDER BY s.name';
  res.json({ students: db.all(sql, params) });
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { class_id, name, level, personality, gender } = req.body;
  if (!name || !class_id) return res.status(400).json({ error: '缺少信息' });
  const db = getDB();
  const cls = db.get('SELECT id FROM classes WHERE id=? AND teacher_id=?', [class_id, req.user.id]);
  if (!cls) return res.status(403).json({ error: '无权限' });
  const code = genCode(db);
  const r = db.run('INSERT INTO students (teacher_id, class_id, name, level, personality, gender, invite_code) VALUES (?,?,?,?,?,?,?)', [req.user.id, class_id, name, level||'', personality||'', gender||'boy', code]);
  res.json({ ok: true, student: { id: r.lastInsertRowid, name, level, personality, invite_code: code } });
});

router.get('/:id', auth, (req, res) => {
  const db = getDB();
  const sql = req.user.role === 'teacher'
    ? 'SELECT s.*, c.name as class_name FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.teacher_id=?'
    : 'SELECT s.*, c.name as class_name FROM students s JOIN bindings b ON b.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=? AND b.parent_id=?';
  const s = db.get(sql, [req.params.id, req.user.id]);
  res.json({ student: s || null });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { personality, level, name } = req.body;
  const result = getDB().run('UPDATE students SET personality=COALESCE(?,personality), level=COALESCE(?,level), name=COALESCE(?,name) WHERE id=? AND class_id IN (SELECT id FROM classes WHERE teacher_id=?)', [personality||null, level||null, name||null, req.params.id, req.user.id]);
  if (result.changes === 0) return res.status(404).json({ error: '学生不存在' });
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const result = getDB().run('DELETE FROM students WHERE id=? AND class_id IN (SELECT id FROM classes WHERE teacher_id=?)', [req.params.id, req.user.id]);
  if (result.changes === 0) return res.status(404).json({ error: '学生不存在' });
  res.json({ ok: true });
});

module.exports = router;
