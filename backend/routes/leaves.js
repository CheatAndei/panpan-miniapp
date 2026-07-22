const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');
const { leaveBelongsToTeacher, parentFeedbackBelongsToTeacher, parentBoundStudent, teacherOwnsStudent } = require('../utils/scope');

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const { student_id, class_date, reason } = req.body;
  if (!student_id || !reason) return res.status(400).json({ error: '请填写完整' });
  const db = getDB();
  if (!parentBoundStudent(db, req.user.id, student_id)) return res.status(403).json({ error: '无权操作' });
  const r = db.run('INSERT INTO leaves (student_id, parent_id, class_date, reason) VALUES (?,?,?,?)', [student_id, req.user.id, class_date, reason]);
  console.log(`[请假] student=${student_id} date=${class_date}`);
  res.json({ ok: true, id: r.lastInsertRowid });
});

router.get('/', auth, (req, res) => {
  const db = getDB();
  let leaves;
  if (req.user.role === 'teacher') {
    const leaveRows = db.all(`SELECT l.*, s.name as student_name, 'leave' as item_type
      FROM leaves l JOIN students s ON s.id=l.student_id
      LEFT JOIN classes c ON c.id=s.class_id
      WHERE COALESCE(s.teacher_id,c.teacher_id)=?
      ORDER BY l.created_at DESC LIMIT 50`, [req.user.id]);
    const feedbackRows = db.all(`SELECT pf.id, NULL as student_id, pf.parent_id, '' as class_date,
      pf.content as reason, pf.status, pf.reply, pf.created_at,
      COALESCE(NULLIF(u.nickname,''),'家长') as student_name, 'feedback' as item_type
      FROM parent_feedbacks pf LEFT JOIN users u ON u.id=pf.parent_id
      WHERE pf.student_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM students s LEFT JOIN classes c ON c.id=s.class_id
        WHERE s.id=pf.student_id AND COALESCE(s.teacher_id,c.teacher_id)=?
      )
      ORDER BY pf.created_at DESC LIMIT 50`, [req.user.id]);
    leaves = [...leaveRows, ...feedbackRows].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0, 80);
  } else {
    leaves = db.all('SELECT l.* FROM leaves l WHERE l.parent_id=? ORDER BY l.created_at DESC LIMIT 50', [req.user.id]);
  }
  res.json({ leaves });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const db = getDB();
  if (req.body.item_type === 'feedback') {
    if (!parentFeedbackBelongsToTeacher(db, req.user.id, req.params.id)) return res.status(403).json({ error: '无权操作该反馈' });
    db.run('UPDATE parent_feedbacks SET status=?, reply=? WHERE id=?', [req.body.status, req.body.reply||'', req.params.id]);
  } else {
    if (!leaveBelongsToTeacher(db, req.user.id, req.params.id)) return res.status(403).json({ error: '无权操作该请假' });
    db.run('UPDATE leaves SET status=?, reply=? WHERE id=?', [req.body.status, req.body.reply||'', req.params.id]);
  }
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const db = getDB();
  if (req.query.type === 'feedback') {
    if (!parentFeedbackBelongsToTeacher(db, req.user.id, req.params.id)) return res.status(403).json({ error: '无权操作该反馈' });
    db.run('DELETE FROM parent_feedbacks WHERE id=?', [req.params.id]);
  } else {
    if (!leaveBelongsToTeacher(db, req.user.id, req.params.id)) return res.status(403).json({ error: '无权操作该请假' });
    db.run('DELETE FROM leaves WHERE id=?', [req.params.id]);
  }
  res.json({ ok: true });
});

router.post('/teacher-mark', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { student_id, class_date, reason } = req.body || {};
  if (!student_id || !class_date) return res.status(400).json({ error: '缺少学生或日期' });
  const db = getDB();
  const student = teacherOwnsStudent(db, req.user.id, student_id);
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
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: '请填写反馈内容' });
  const { student_id } = req.body || {};
  const db = getDB();
  const targetStudentId = student_id || db.get('SELECT student_id FROM bindings WHERE parent_id=? ORDER BY id LIMIT 1', [req.user.id])?.student_id;
  if (!targetStudentId || !parentBoundStudent(db, req.user.id, targetStudentId)) return res.status(403).json({ error: '请先绑定孩子' });
  const r = db.run('INSERT INTO parent_feedbacks (parent_id, student_id, content) VALUES (?,?,?)', [req.user.id, targetStudentId, content]);
  res.json({ ok: true, id: r.lastInsertRowid });
});

module.exports = router;
