const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');
const { ensureRole, setActiveRole, toPublicUser } = require('../utils/roles');
const { authRequired: auth } = require('../middleware/auth');
const { createFailureLimiter } = require('../utils/failure-limiter');
const { withExternalStudentId } = require('../utils/student-identity');

const BIND_FAILURE_WINDOW_MS = 10 * 60 * 1000;
const BIND_FAILURE_LIMIT = 5;
const bindFailureLimiter = createFailureLimiter({
  limit: BIND_FAILURE_LIMIT,
  windowMs: BIND_FAILURE_WINDOW_MS,
  maxKeys: 5000,
});

function rejectIfRateLimited(req, res) {
  const state = bindFailureLimiter.check(req.user.id);
  if (!state.limited) return false;
  res.set('Retry-After', String(state.retryAfter));
  res.status(429).json({ error: '尝试次数过多，请稍后再试' });
  return true;
}

function recordBindFailure(userId) {
  bindFailureLimiter.fail(userId);
}

function clearBindFailures(userId) {
  bindFailureLimiter.clear(userId);
}

function teacherInviteCodes() {
  const pluralCodes = String(process.env.TEACHER_INVITE_CODES || '').trim();
  const configured = (pluralCodes || String(process.env.TEACHER_INVITE_CODE || ''))
    .split(',').map(code => code.trim().toUpperCase()).filter(Boolean);
  return [...new Set(configured)];
}

function studentWithTeacher(db, whereSql, params) {
  return withExternalStudentId(db.get(`SELECT s.*, c.name as className,
    u.id as teacher_id,
    COALESCE(NULLIF(u.nickname,''),'老师') as teacher_name,
    u.avatar_url as teacher_avatar_url
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    LEFT JOIN users u ON u.id=COALESCE(s.teacher_id,c.teacher_id)
    ${whereSql}`, params));
}

function studentsWithTeacher(db, whereSql, params) {
  return db.all(`SELECT s.*, c.name as className,
    u.id as teacher_id,
    COALESCE(NULLIF(u.nickname,''),'老师') as teacher_name,
    u.avatar_url as teacher_avatar_url
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    LEFT JOIN users u ON u.id=COALESCE(s.teacher_id,c.teacher_id)
    ${whereSql}`, params).map(withExternalStudentId);
}

function issueRoleSession(db, userId, role) {
  ensureRole(db, userId, role);
  const user = setActiveRole(db, userId, role);
  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '30d' }
  );
  return { role: user.role, roles: user.roles, token, user: toPublicUser(user) };
}

router.post('/', auth, (req, res) => {
  const db = getDB();
  const code = (req.body.invite_code||'').toUpperCase().trim();
  if (rejectIfRateLimited(req, res)) return;
  if (code.length < 6 || code.length > 32) {
    recordBindFailure(req.user.id);
    return res.status(400).json({ error: '邀请码无效' });
  }

  const teacherCodes = teacherInviteCodes();
  if (teacherCodes.length > 0 && teacherCodes.includes(code)) {
    clearBindFailures(req.user.id);
    return res.json({ ok: true, ...issueRoleSession(db, req.user.id, 'teacher') });
  }

  // 学生邀请码
  const s = studentWithTeacher(db, 'WHERE s.invite_code=? AND s.deleted_at IS NULL AND c.deleted_at IS NULL', [code]);
  if (!s) {
    recordBindFailure(req.user.id);
    return res.status(404).json({ error: '邀请码无效' });
  }
  const exists = db.get('SELECT id FROM bindings WHERE parent_id=? AND student_id=?', [req.user.id, s.id]);
  if (exists) {
    clearBindFailures(req.user.id);
    return res.json({
      ok: true,
      student: s,
      already: true,
      ...issueRoleSession(db, req.user.id, 'parent'),
    });
  }
  const boundCount = db.get('SELECT COUNT(*) AS count FROM bindings WHERE student_id=?', [s.id])?.count || 0;
  if (boundCount >= 3) return res.status(400).json({ error: '该学生已绑定 3 位家长，请联系老师处理' });
  db.run('INSERT INTO bindings (parent_id, student_id) VALUES (?,?)', [req.user.id, s.id]);
  clearBindFailures(req.user.id);
  res.json({
    ok: true,
    student: s,
    ...issueRoleSession(db, req.user.id, 'parent'),
  });
});

router.get('/students', auth, (req, res) => {
  const list = studentsWithTeacher(getDB(), `JOIN bindings b ON b.student_id=s.id
    WHERE b.parent_id=? AND s.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY s.id`, [req.user.id]);
  res.json({ students: list || [] });
});

router.get('/student', auth, (req, res) => {
  const s = studentWithTeacher(getDB(), `JOIN bindings b ON b.student_id=s.id
    WHERE b.parent_id=? AND s.deleted_at IS NULL AND c.deleted_at IS NULL ORDER BY s.id LIMIT 1`, [req.user.id]);
  res.json({ student: s || null });
});

router.delete('/:studentId', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const result = getDB().run('DELETE FROM bindings WHERE parent_id=? AND student_id=?', [req.user.id, req.params.studentId]);
  if (result.changes === 0) return res.status(404).json({ error: '未找到绑定关系' });
  res.json({ ok: true });
});

module.exports = router;
