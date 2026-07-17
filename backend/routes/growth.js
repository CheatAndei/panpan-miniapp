const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth, requireRole } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { growthSummary } = require('../services/learning');

const router = express.Router();
const parentOnly = requireRole('parent');

router.get('/summary', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  if (!Number.isInteger(studentId) || !parentBoundStudent(db, req.user.id, studentId)) {
    return res.status(403).json({ error: '无权查看该学生的成长记录' });
  }
  try { return res.json(growthSummary(db, { studentId })); }
  catch (error) { return res.status(400).json({ error: error.message || '成长记录加载失败' }); }
});

module.exports = router;
