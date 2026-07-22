const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth, requireRole } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const {
  TASKS, createOrGetAttempt, completeAttempt, serializeAttempt, todayOverview, catalog,
  learningPreference, saveLearningPreference,
} = require('../services/learning');

const router = express.Router();
const parentOnly = requireRole('parent');

function boundStudent(db, parentId, rawStudentId) {
  const studentId = Number(rawStudentId);
  return Number.isInteger(studentId) && studentId > 0 && parentBoundStudent(db, parentId, studentId)
    ? studentId
    : null;
}

router.get('/today', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权查看该学生的今日任务' });
  try { return res.json(todayOverview(db, { studentId })); }
  catch (error) { return res.status(400).json({ error: error.message || '今日任务生成失败' }); }
});

router.get('/catalog', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权查看该学生的学习内容' });
  try {
    const preference = learningPreference(db, {
      studentId, requestedGrade: req.query.grade, requestedSubject: req.query.subject,
    });
    return res.json({ ...catalog(db, { studentId, gradeCode: preference.grade_code, subjectCode: preference.subject_code }), ...preference });
  }
  catch (error) { return res.status(400).json({ error: error.message || '学习内容加载失败' }); }
});

router.put('/preferences', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  if (!studentId) return res.status(403).json({ error: '无权修改该学生的学习入口' });
  try {
    return res.json({ ok: true, preference: saveLearningPreference(db, {
      studentId, gradeCode: req.body?.grade, subjectCode: req.body?.subject,
    }) });
  } catch (error) { return res.status(400).json({ error: error.message || '学习入口保存失败' }); }
});

router.post('/sessions', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  const taskType = String(req.body?.task_type || '');
  if (!studentId) return res.status(403).json({ error: '无权为该学生开始学习' });
  if (!TASKS[taskType]) return res.status(400).json({ error: '学习任务不存在' });
  try {
    const attempt = createOrGetAttempt(db, {
      studentId, parentId: req.user.id, taskType,
      gradeCode: req.body?.grade, subjectCode: req.body?.subject,
    });
    return res.status(attempt.status === 'active' ? 201 : 200).json({ attempt });
  } catch (error) {
    return res.status(400).json({ error: error.message || '学习任务创建失败' });
  }
});

router.get('/sessions/:id', auth, parentOnly, (req, res) => {
  const db = getDB();
  const row = db.get('SELECT * FROM learning_attempts WHERE id=?', [Number(req.params.id)]);
  if (!row || !parentBoundStudent(db, req.user.id, Number(row.student_id))) {
    return res.status(404).json({ error: '学习任务不存在' });
  }
  return res.json({ attempt: serializeAttempt(row) });
});

router.post('/sessions/:id/submit', auth, parentOnly, (req, res) => {
  const db = getDB();
  const row = db.get('SELECT * FROM learning_attempts WHERE id=?', [Number(req.params.id)]);
  if (!row || !parentBoundStudent(db, req.user.id, Number(row.student_id))) {
    return res.status(404).json({ error: '学习任务不存在' });
  }
  if (!Array.isArray(req.body?.answers)) return res.status(400).json({ error: '请提交答题结果' });
  try {
    const attempt = completeAttempt(db, {
      attemptId: row.id,
      answers: req.body.answers,
      elapsedSeconds: req.body.elapsed_seconds,
    });
    return res.json({ attempt });
  } catch (error) {
    return res.status(400).json({ error: error.message || '答题提交失败' });
  }
});

module.exports = router;
