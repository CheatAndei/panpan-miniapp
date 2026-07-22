const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth, requireRole } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const {
  createCalculationReport,
  teacherCalculationReports,
  updateCalculationReport,
} = require('../services/calculation-reports');

const router = express.Router();
const parentOnly = requireRole('parent');
const teacherOnly = requireRole('teacher');

router.post('/', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.body?.student_id);
  if (!Number.isInteger(studentId) || !parentBoundStudent(db, req.user.id, studentId)) {
    return res.status(403).json({ error: '无权为该学生提交报错' });
  }
  try {
    const result = createCalculationReport(db, {
      sourceType: String(req.body?.source_type || ''),
      sourceId: req.body?.source_id,
      sourceQuestionId: String(req.body?.question_id || ''),
      studentId,
      parentId: req.user.id,
      reason: req.body?.reason,
      detail: req.body?.detail,
    });
    return res.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
  } catch (error) {
    const status = error?.code === 'RATE_LIMITED' ? 429 : 400;
    return res.status(status).json({ error: error?.message || '报错提交失败' });
  }
});

router.get('/', auth, teacherOnly, (req, res) => {
  const rawStatus = String(req.query.status || 'pending');
  const status = rawStatus === 'pending' ? 'open' : (rawStatus === 'all' ? '' : rawStatus);
  return res.json({
    reports: teacherCalculationReports(getDB(), {
      teacherId: req.user.id,
      sourceType: String(req.query.source_type || ''),
      status,
      limit: req.query.limit,
    }),
  });
});

router.put('/:id', auth, teacherOnly, (req, res) => {
  const rawStatus = String(req.body?.status || '');
  const report = updateCalculationReport(getDB(), {
    teacherId: req.user.id,
    reportId: Number(req.params.id),
    status: rawStatus === 'pending' ? 'open' : rawStatus,
    teacherNote: req.body?.teacher_note ?? req.body?.note,
    stopQuestion: req.body?.stop_question === true,
  });
  if (!report) return res.status(404).json({ error: '报错记录不存在' });
  return res.json({ ok: true, report });
});

module.exports = router;
