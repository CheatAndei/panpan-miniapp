const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const {
  BATTLES, createChallenge, completeChallenge, serializeChallenge, leaderboard,
} = require('../services/mental-arena');

const router = express.Router();

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '请使用家长身份进入口算王' });
  next();
}

function ownedStudent(db, parentId, studentId) {
  return Number.isInteger(studentId) && studentId > 0 && parentBoundStudent(db, parentId, studentId);
}

router.get('/catalog', auth, parentOnly, (req, res) => {
  res.json({
    battles: Object.entries(BATTLES).map(([key, value]) => ({ key, ...value })),
    scoring: {
      correct_points: 100,
      maximum_speed_bonus: 99,
      maximum_score: 2099,
      rule: '每答对一题得100分；速度奖最高99分，正确率优先。',
    },
  });
});

router.post('/challenges', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.body?.student_id);
  const battle = String(req.body?.battle || '');
  if (!ownedStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权为该学生开始挑战' });
  if (!BATTLES[battle]) return res.status(400).json({ error: '请选择小学或初中战场' });
  try {
    const challenge = createChallenge(db, { studentId, parentId: req.user.id, battle });
    res.status(201).json({ ok: true, challenge });
  } catch (error) {
    res.status(400).json({ error: error.message || '挑战创建失败' });
  }
});

router.get('/challenges/:id', auth, parentOnly, (req, res) => {
  const db = getDB();
  const challenge = db.get('SELECT * FROM mental_challenges WHERE id=?', [Number(req.params.id)]);
  if (!challenge || !ownedStudent(db, req.user.id, Number(challenge.student_id))) {
    return res.status(404).json({ error: '挑战不存在' });
  }
  res.json({ challenge: serializeChallenge(challenge) });
});

router.post('/challenges/:id/submit', auth, parentOnly, (req, res) => {
  const db = getDB();
  const challenge = db.get('SELECT * FROM mental_challenges WHERE id=?', [Number(req.params.id)]);
  if (!challenge || !ownedStudent(db, req.user.id, Number(challenge.student_id))) {
    return res.status(404).json({ error: '挑战不存在' });
  }
  try {
    const completed = completeChallenge(db, challenge.id, req.body?.answers);
    res.json({ ok: true, challenge: completed });
  } catch (error) {
    res.status(400).json({ error: error.message || '提交失败' });
  }
});

router.get('/leaderboard', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  const battle = String(req.query.battle || 'primary');
  const period = String(req.query.period || 'week');
  if (!ownedStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生的排行榜' });
  try { res.json(leaderboard(db, { studentId, battle, period })); }
  catch (error) { res.status(400).json({ error: error.message || '排行榜加载失败' }); }
});

module.exports = router;
