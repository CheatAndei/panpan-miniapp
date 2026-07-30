const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth, requireRole } = require('../middleware/auth');
const {
  classContentState,
  practiceCatalogForClass,
  saveClassScope,
} = require('../services/content-progress');

const router = express.Router();
const teacherOnly = requireRole('teacher');

router.get('/practice-catalog', auth, teacherOnly, (req, res) => {
  try {
    return res.json(practiceCatalogForClass(getDB(), {
      classId: Number(req.query.class_id),
      teacherId: req.user.id,
    }));
  } catch (error) {
    return res.status(Number(error.statusCode) || 400).json({ error: error.message || '打卡题库加载失败' });
  }
});

router.get('/classes/:classId', auth, teacherOnly, (req, res) => {
  try {
    return res.json(classContentState(getDB(), {
      classId: Number(req.params.classId),
      teacherId: req.user.id,
    }));
  } catch (error) {
    return res.status(Number(error.statusCode) || 400).json({ error: error.message || '进度配置加载失败' });
  }
});

router.put('/classes/:classId', auth, teacherOnly, (req, res) => {
  try {
    const scope = saveClassScope(getDB(), {
      classId: Number(req.params.classId),
      teacherId: req.user.id,
      topicKeys: req.body?.topic_keys,
      gradeCode: 'g8',
      subjectCode: 'math',
    });
    return res.json({
      ok: true,
      scope,
      state: classContentState(getDB(), {
        classId: Number(req.params.classId),
        teacherId: req.user.id,
      }),
    });
  } catch (error) {
    return res.status(Number(error.statusCode) || 400).json({ error: error.message || '进度配置保存失败' });
  }
});

module.exports = router;
