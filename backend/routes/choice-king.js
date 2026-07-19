const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { getDB } = require('../db/init');
const { authRequired: auth, requireRole } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const {
  nextQuestion,
  submitAnswer,
  leaderboard,
  createReport,
  teacherReports,
  updateReport,
  teacherAlerts,
  markAlertRead,
  CHOICE_KING_RESOURCE_DIR,
} = require('../services/choice-king');

const router = express.Router();
const parentOnly = requireRole('parent');
const teacherOnly = requireRole('teacher');

function boundStudent(db, parentId, rawStudentId) {
  const studentId = Number(rawStudentId);
  return Number.isInteger(studentId) && studentId > 0 && parentBoundStudent(db, parentId, studentId)
    ? studentId
    : 0;
}

function serviceError(res, error, fallback) {
  const message = error?.message || fallback;
  if (error?.code === 'RATE_LIMITED') return res.status(429).json({ error: message });
  if (['NO_ACTIVE_ISSUANCE', 'IDEMPOTENCY_MISMATCH'].includes(error?.code) || /已暂停/.test(message)) {
    return res.status(409).json({ error: message });
  }
  return res.status(400).json({ error: message });
}

// 题图只允许读取随 manifest 发布的图片文件；无目录浏览、无任意路径穿越。
router.get('/assets/*', (req, res) => {
  const relative = String(req.params[0] || '').replace(/\\/g, '/');
  if (!relative || relative.split('/').includes('..') || !/\.(?:png|jpe?g|webp)$/i.test(relative)) {
    return res.status(404).end();
  }
  const filePath = path.resolve(CHOICE_KING_RESOURCE_DIR, relative);
  const root = path.resolve(CHOICE_KING_RESOURCE_DIR);
  if (!filePath.startsWith(`${root}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return res.status(404).end();
  }
  res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' });
  return res.sendFile(filePath);
});

router.get('/next', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权为该学生领取题目' });
  try { return res.json(nextQuestion(db, { studentId })); }
  catch (error) { return serviceError(res, error, '题目领取失败'); }
});

router.post('/questions/:id/answer', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  if (!studentId) return res.status(403).json({ error: '无权为该学生提交答案' });
  const questionId = Number(req.params.id);
  if (!Number.isInteger(questionId) || questionId < 1) return res.status(400).json({ error: '题目编号无效' });
  try {
    return res.json(submitAnswer(db, {
      studentId,
      parentId: req.user.id,
      questionId,
      selectedOption: req.body?.selected_option,
      clientRequestId: req.body?.client_request_id,
    }));
  } catch (error) {
    return serviceError(res, error, '答案提交失败');
  }
});

function reportQuestion(req, res, questionId) {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  if (!studentId) return res.status(403).json({ error: '无权为该学生提交报错' });
  const id = Number(questionId);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: '题目编号无效' });
  try {
    const result = createReport(db, {
      studentId,
      parentId: req.user.id,
      questionId: id,
      reason: req.body?.reason,
      detail: req.body?.detail ?? req.body?.note,
      selectedAnswer: req.body?.selected_answer,
    });
    return res.status(result.duplicate ? 200 : 201).json({ ok: true, ...result });
  } catch (error) {
    return serviceError(res, error, '报错提交失败');
  }
}

router.post('/questions/:id/report', auth, parentOnly, (req, res) => reportQuestion(req, res, req.params.id));

// 兼容前端统一 reports 入口；正式题目级契约仍是 /questions/:id/report。
router.post('/reports', auth, parentOnly, (req, res) => reportQuestion(req, res, req.body?.question_id));

router.get('/leaderboard', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权查看该学生的排行榜' });
  try {
    return res.json(leaderboard(db, {
      studentId,
      period: String(req.query.period || 'week'),
    }));
  } catch (error) {
    return serviceError(res, error, '排行榜加载失败');
  }
});

router.get('/reports', auth, teacherOnly, (req, res) => {
  const rawStatus = String(req.query.status || 'pending');
  const status = rawStatus === 'pending' ? 'open' : (rawStatus === 'all' ? '' : rawStatus);
  return res.json({
    reports: teacherReports(getDB(), {
      teacherId: req.user.id,
      status,
      limit: req.query.limit,
    }),
  });
});

router.put('/reports/:id', auth, teacherOnly, (req, res) => {
  const rawStatus = String(req.body?.status || '');
  const status = rawStatus === 'pending' ? 'open' : rawStatus;
  const report = updateReport(getDB(), {
    teacherId: req.user.id,
    reportId: Number(req.params.id),
    status,
    teacherNote: req.body?.teacher_note ?? req.body?.note,
    stopQuestion: req.body?.stop_question === true,
  });
  if (!report) return res.status(404).json({ error: '报错记录不存在' });
  return res.json({ ok: true, report });
});

router.get('/alerts', auth, teacherOnly, (req, res) => {
  const unreadOnly = !['0', 'false', 'all'].includes(String(req.query.unread ?? req.query.status ?? '1'));
  return res.json({
    alerts: teacherAlerts(getDB(), {
      teacherId: req.user.id,
      unreadOnly,
      limit: req.query.limit,
    }),
  });
});

function updateAlert(req, res) {
  const alert = markAlertRead(getDB(), {
    teacherId: req.user.id,
    alertId: Number(req.params.id),
    isRead: req.body?.is_read !== false,
  });
  if (!alert) return res.status(404).json({ error: '提醒不存在' });
  return res.json({ ok: true, alert });
}

router.put('/alerts/:id', auth, teacherOnly, updateAlert);
router.put('/alerts/:id/read', auth, teacherOnly, updateAlert);

module.exports = router;
