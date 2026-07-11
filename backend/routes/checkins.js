const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');
const { teacherOwnsStudent, parentBoundStudent } = require('../utils/scope');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

function localDateString(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function latestCheckin(db, studentId, date, requireCheckedIn = false) {
  const checkedInClause = requireCheckedIn ? 'AND check_in_time IS NOT NULL' : '';
  return db.get(`SELECT * FROM checkins
    WHERE student_id=? AND class_date=? ${checkedInClause}
    ORDER BY
      CASE status WHEN 'checked_out' THEN 0 WHEN 'checked_in' THEN 1 ELSE 2 END,
      COALESCE(check_out_time, check_in_time, created_at) DESC,
      id DESC
    LIMIT 1`, [studentId, date]);
}

// 家长查今日签到
router.get('/today', auth, (req, res) => {
  const today = req.query.date || localDateString();
  const { student_id } = req.query;
  const db = getDB();
  const leave = db.get('SELECT l.* FROM leaves l JOIN bindings b ON b.student_id=l.student_id WHERE b.parent_id=? AND l.class_date=? AND l.status=? AND (? IS NULL OR l.student_id=?) ORDER BY l.created_at DESC LIMIT 1', [req.user.id, today, 'approved', student_id||null, student_id||null]);
  const s = db.get(`SELECT ci.* FROM checkins ci JOIN students s ON s.id=ci.student_id JOIN bindings b ON b.student_id=s.id
    WHERE b.parent_id=? AND ci.class_date=? AND (? IS NULL OR s.id=?)
    ORDER BY
      CASE ci.status WHEN 'checked_out' THEN 0 WHEN 'checked_in' THEN 1 ELSE 2 END,
      COALESCE(ci.check_out_time, ci.check_in_time, ci.created_at) DESC,
      ci.id DESC
    LIMIT 1`, [req.user.id, today, student_id||null, student_id||null]);
  if (!s) return res.json({ checkedIn: false, checkedOut: false, onLeave: !!leave, status: leave ? 'leave' : 'absent', leaveReason: leave?.reason || '' });
  res.json({
    checkedIn: s.status==='checked_in'||s.status==='checked_out',
    checkedOut: s.status==='checked_out',
    checkInTime: s.check_in_time,
    checkOutTime: s.check_out_time,
    status: s.status,
    checkOutNote: s.check_out_note || '',
    onLeave: !!leave,
    leaveReason: leave?.reason || ''
  });
});

// 老师查单个学生的签到状态
router.get('/status', auth, (req, res) => {
  const { student_id, date } = req.query;
  const db = getDB();
  if (!student_id || !date) return res.status(400).json({ error: '缺少学生或日期' });
  if (req.user.role === 'teacher' && !teacherOwnsStudent(db, req.user.id, student_id)) return res.status(403).json({ error: '无权操作该学生' });
  if (req.user.role === 'parent' && !parentBoundStudent(db, req.user.id, student_id)) return res.status(403).json({ error: '无权查看该学生' });
  const ci = latestCheckin(db, student_id, date);
  // 同时查请假
  const leave = db.get('SELECT id FROM leaves WHERE student_id=? AND class_date=? AND status=?', [student_id, date, 'approved']);
  if (!ci) return res.json({ checkedIn: false, checkedOut: false, onLeave: !!leave });
  res.json({
    checkedIn: ci.status==='checked_in'||ci.status==='checked_out',
    checkedOut: ci.status==='checked_out',
    checkInTime: ci.check_in_time,
    checkOutTime: ci.check_out_time,
    checkOutNote: ci.check_out_note || '',
    onLeave: !!leave
  });
});

// 老师签到
router.post('/check-in', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { studentId, classDate, studentName } = req.body;
  const db = getDB();
  if (!teacherOwnsStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权操作该学生' });
  const now = new Date().toISOString();
  const leave = db.get('SELECT id FROM leaves WHERE student_id=? AND class_date=? AND status=?', [studentId, classDate, 'approved']);
  if (leave) return res.status(400).json({ error: `${studentName || '学生'}已请假，不能签到` });
  const exists = latestCheckin(db, studentId, classDate);
  if (exists) {
    db.run('UPDATE checkins SET check_in_time=?, status=? WHERE id=?', [now, 'checked_in', exists.id]);
  } else {
    db.run('INSERT INTO checkins (student_id, class_date, check_in_time, status) VALUES (?,?,?,?)', [studentId, classDate, now, 'checked_in']);
  }
  let notify = { ok: false, error: '未发送' };
  try { notify = await require('./notify').notifyCheckin(studentId); }
  catch(e) { notify = { ok: false, error: e.message }; }
  res.json({ ok: true, notify });
});

// 老师签退
router.post('/check-out', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { studentId, studentName, classDate, special, teacherName } = req.body;
  const db = getDB();
  if (!teacherOwnsStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权操作该学生' });
  const now = new Date().toISOString();
  const date = classDate || localDateString();
  const teacher = db.get('SELECT nickname FROM users WHERE id=?', [req.user.id]);
  const displayName = String(teacherName || teacher?.nickname || '').trim().replace(/老师$/, '');
  const note = special ? `${displayName ? displayName + '老师' : '老师'}已离开 请主动联系小朋友。` : '';
  const existing = latestCheckin(db, studentId, date, true);
  if (!existing || !existing.check_in_time) {
    return res.status(400).json({ error: '未找到签到记录，请先签到' });
  }
  if (existing.status !== 'checked_out') {
    db.run('UPDATE checkins SET check_out_time=?, status=?, check_out_note=? WHERE id=?', [now, 'checked_out', note, existing.id]);
  } else if (special && !existing.check_out_note) {
    db.run('UPDATE checkins SET check_out_note=? WHERE id=?', [note, existing.id]);
  }
  let notify = { ok: false, error: '未发送' };
  try { notify = await require('./notify').notifyCheckout(studentId, note); }
  catch(e) { notify = { ok: false, error: e.message }; }
  res.json({ ok: true, notify });
});

module.exports = router;
