const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

function localDateString(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// 家长查今日签到
router.get('/today', auth, (req, res) => {
  const today = req.query.date || localDateString();
  const { student_id } = req.query;
  const s = getDB().get('SELECT ci.* FROM checkins ci JOIN students s ON s.id=ci.student_id JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? AND ci.class_date=? AND (? IS NULL OR s.id=?) ORDER BY ci.check_in_time DESC LIMIT 1', [req.user.id, today, student_id||null, student_id||null]);
  if (!s) return res.json({ checkedIn: false });
  res.json({
    checkedIn: s.status==='checked_in'||s.status==='checked_out',
    checkedOut: s.status==='checked_out',
    checkInTime: s.check_in_time,
    checkOutTime: s.check_out_time,
    status: s.status
  });
});

// 老师查单个学生的签到状态
router.get('/status', auth, (req, res) => {
  const { student_id, date } = req.query;
  const ci = getDB().get('SELECT * FROM checkins WHERE student_id=? AND class_date=?', [student_id, date]);
  // 同时查请假
  const leave = getDB().get('SELECT id FROM leaves WHERE student_id=? AND class_date=? AND status=?', [student_id, date, 'approved']);
  if (!ci) return res.json({ checkedIn: false, checkedOut: false, onLeave: !!leave });
  res.json({
    checkedIn: ci.status==='checked_in'||ci.status==='checked_out',
    checkedOut: ci.status==='checked_out',
    checkInTime: ci.check_in_time,
    checkOutTime: ci.check_out_time,
    onLeave: !!leave
  });
});

// 老师签到
router.post('/check-in', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { studentId, classDate, studentName } = req.body;
  const db = getDB();
  const now = new Date().toISOString();
  const exists = db.get('SELECT id FROM checkins WHERE student_id=? AND class_date=?', [studentId, classDate]);
  if (exists) {
    db.run('UPDATE checkins SET check_in_time=?, status=? WHERE id=?', [now, 'checked_in', exists.id]);
  } else {
    db.run('INSERT INTO checkins (student_id, class_date, check_in_time, status) VALUES (?,?,?,?)', [studentId, classDate, now, 'checked_in']);
  }
  // 通知文案
  const student = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  try { require('./notify').notifyCheckin(studentId); } catch(e) {}
  res.json({ ok: true });
});

// 老师签退
router.post('/check-out', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { studentId, studentName, classDate } = req.body;
  const db = getDB();
  const now = new Date().toISOString();
  const date = classDate || new Date().toISOString().slice(0,10);
  const result = db.run('UPDATE checkins SET check_out_time=?, status=? WHERE student_id=? AND class_date=? AND status=?', [now, 'checked_out', studentId, date, 'checked_in']);
  if (result.changes === 0) {
    return res.status(400).json({ error: '未找到签到记录，请先签到' });
  }
  try { require('./notify').notifyCheckout(studentId); } catch(e) {}
  res.json({ ok: true });
});

module.exports = router;
