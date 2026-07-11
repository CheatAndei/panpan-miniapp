const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

// 已发放的邀请码在生产环境漏配变量时仍可登录；部署变量可随时覆盖它们。
const LEGACY_TEACHER_CODES = ['PANPAN','PANAAA','YANGCO','ZHAOLI','ZHUZHU','ZHOUXU','XIAOHE','PINGZI','PAIPAI','DAIDAI','WANGLS','PANPPP'];

function teacherInviteCodes() {
  const configured = [process.env.TEACHER_INVITE_CODE, process.env.TEACHER_INVITE_CODES]
    .filter(Boolean).join(',').split(',').map(code => code.trim().toUpperCase()).filter(Boolean);
  return [...new Set([...LEGACY_TEACHER_CODES, ...configured])];
}

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

function studentWithTeacher(db, whereSql, params) {
  return db.get(`SELECT s.*, c.name as className,
    u.id as teacher_id,
    COALESCE(NULLIF(u.nickname,''),'老师') as teacher_name,
    u.avatar_url as teacher_avatar_url,
    u.phone as teacher_phone
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    LEFT JOIN users u ON u.id=COALESCE(s.teacher_id,c.teacher_id)
    ${whereSql}`, params);
}

function studentsWithTeacher(db, whereSql, params) {
  return db.all(`SELECT s.*, c.name as className,
    u.id as teacher_id,
    COALESCE(NULLIF(u.nickname,''),'老师') as teacher_name,
    u.avatar_url as teacher_avatar_url,
    u.phone as teacher_phone
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    LEFT JOIN users u ON u.id=COALESCE(s.teacher_id,c.teacher_id)
    ${whereSql}`, params);
}

router.post('/', auth, (req, res) => {
  const db = getDB();
  const code = (req.body.invite_code||'').toUpperCase().trim();

  const teacherCodes = teacherInviteCodes();
  if (teacherCodes.includes(code)) {
    db.run('UPDATE users SET role=? WHERE id=?', ['teacher', req.user.id]);
    // 角色变更后必须重新签发 token，否则旧 token 里仍是 parent，老师操作会 403「没有权限」
    const token = jwt.sign({ id: req.user.id, openid: req.user.openid, role: 'teacher' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
    return res.json({ ok: true, role: 'teacher', token });
  }

  // 学生邀请码
  if (req.user.role !== 'parent') return res.status(400).json({ error: '请使用学生邀请码' });
  const s = studentWithTeacher(db, 'WHERE s.invite_code=?', [code]);
  if (!s) return res.status(404).json({ error: '邀请码无效' });
  const exists = db.get('SELECT id FROM bindings WHERE parent_id=? AND student_id=?', [req.user.id, s.id]);
  if (exists) return res.json({ ok: true, student: s, already: true });
  const boundCount = db.get('SELECT COUNT(*) AS count FROM bindings WHERE student_id=?', [s.id])?.count || 0;
  if (boundCount >= 3) return res.status(400).json({ error: '该学生已绑定 3 位家长，请联系老师处理' });
  db.run('INSERT INTO bindings (parent_id, student_id) VALUES (?,?)', [req.user.id, s.id]);
  res.json({ ok: true, student: s });
});

router.get('/students', auth, (req, res) => {
  const list = studentsWithTeacher(getDB(), 'JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? ORDER BY s.id', [req.user.id]);
  res.json({ students: list || [] });
});

router.get('/student', auth, (req, res) => {
  const s = studentWithTeacher(getDB(), 'JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? ORDER BY s.id LIMIT 1', [req.user.id]);
  res.json({ student: s || null });
});

router.delete('/:studentId', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const result = getDB().run('DELETE FROM bindings WHERE parent_id=? AND student_id=?', [req.user.id, req.params.studentId]);
  if (result.changes === 0) return res.status(404).json({ error: '未找到绑定关系' });
  res.json({ ok: true });
});

module.exports = router;
