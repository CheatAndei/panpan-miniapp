const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { teacherOwnsStudent } = require('../utils/scope');
const {
  BATTLES, createChallenge, completeChallenge, serializeChallenge, leaderboard, isJuniorStudent,
} = require('../services/mental-arena');
const { recordMentalFirst, serializeEvent } = require('../services/promotions');

const router = express.Router();

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '请使用家长身份进入口算王' });
  next();
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '请使用教师身份操作' });
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

router.get('/summary', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  if (!ownedStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生的口算摘要' });
  const student = db.get(`SELECT s.*,c.grade class_grade,c.name class_name
    FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?`, [studentId]);
  const battle = isJuniorStudent(student) ? 'junior' : 'primary';
  const board = leaderboard(db, { studentId, battle, period: 'week' });
  const best = board.my_rank;
  let goal = db.get(`SELECT * FROM mental_rank_goals WHERE student_id=? AND battle=? AND status='active'
    ORDER BY created_at DESC LIMIT 1`, [studentId, battle]);
  if (goal && goal.expires_at && new Date(goal.expires_at).getTime() < Date.now()) {
    db.run(`UPDATE mental_rank_goals SET status='expired' WHERE id=?`, [goal.id]);
    goal = null;
  }
  if (goal && best && Number(best.score) >= Number(goal.target_score)) {
    db.run(`UPDATE mental_rank_goals SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?`, [goal.id]);
    goal = { ...goal, status: 'completed' };
  }
  const next = best && best.rank > 1 ? board.entries.find((item) => item.rank === best.rank - 1) : null;
  res.json({
    battle,
    battle_label: BATTLES[battle].label,
    rank: best?.rank || null,
    score: best?.score || null,
    participant_count: board.entries.length,
    gap_to_next: next ? Math.max(1, Number(next.score) - Number(best.score) + 1) : null,
    goal: goal ? {
      id: goal.id, target_rank: Number(goal.target_rank), target_score: Number(goal.target_score),
      status: goal.status, remaining_score: Math.max(0, Number(goal.target_score) - Number(best?.score || 0)),
    } : null,
    campaign: { reward_text: '周排行前三名领取奶茶红包', period_text: '每周一至周日' },
  });
});

router.get('/goals', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const rows = db.all(`SELECT g.*,s.name student_name,c.name class_name FROM mental_rank_goals g
    JOIN students s ON s.id=g.student_id LEFT JOIN classes c ON c.id=s.class_id
    WHERE g.teacher_id=? ORDER BY CASE g.status WHEN 'active' THEN 0 ELSE 1 END,g.created_at DESC LIMIT 100`, [req.user.id]);
  res.json({ goals: rows });
});

router.post('/goals', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.body?.student_id);
  const battle = String(req.body?.battle || 'junior');
  const targetRank = Number.parseInt(req.body?.target_rank || '0', 10);
  if (!teacherOwnsStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '学生不属于当前教师' });
  if (!BATTLES[battle]) return res.status(400).json({ error: '请选择小学或初中战场' });
  if (!Number.isInteger(targetRank) || targetRank < 1 || targetRank > 100) return res.status(400).json({ error: '目标排名应为 1-100' });
  const board = leaderboard(db, { studentId, battle, period: 'week' });
  const targetEntry = board.entries.find((item) => item.rank === targetRank);
  const currentTop = Number(board.entries[0]?.score || 0);
  const targetScore = Math.min(2099, Math.max(100, targetEntry ? Number(targetEntry.score) + 1 : (targetRank === 1 ? currentTop + 1 : 100)));
  const expires = new Date();
  expires.setUTCDate(expires.getUTCDate() + 8);
  db.transaction(() => {
    db.run(`UPDATE mental_rank_goals SET status='expired' WHERE teacher_id=? AND student_id=? AND battle=? AND status='active'`, [
      req.user.id, studentId, battle,
    ]);
    db.run(`INSERT INTO mental_rank_goals(teacher_id,student_id,battle,target_rank,target_score,expires_at)
      VALUES(?,?,?,?,?,?)`, [req.user.id, studentId, battle, targetRank, targetScore, expires.toISOString()]);
  });
  res.status(201).json({ ok: true, goal: { student_id: studentId, battle, target_rank: targetRank, target_score: targetScore, expires_at: expires.toISOString() } });
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
    const wasActive = challenge.status === 'active';
    const beforeLeaderId = wasActive
      ? Number(leaderboard(db, { studentId:Number(challenge.student_id), battle:challenge.battle, period:'week' }).entries[0]?.student_id || 0)
      : 0;
    const completed = completeChallenge(db, challenge.id, req.body?.answers);
    let promotion = null;
    if (wasActive) {
      const board = leaderboard(db, { studentId:Number(challenge.student_id), battle:challenge.battle, period:'week' });
      const newLeaderId = Number(board.entries[0]?.student_id || 0);
      if (newLeaderId === Number(challenge.student_id) && newLeaderId !== beforeLeaderId) {
        const event = recordMentalFirst(db, {
          studentId:Number(challenge.student_id), challengeId:challenge.id, battle:challenge.battle, periodStart:board.period_start,
        });
        promotion = event ? serializeEvent(event) : null;
      }
    }
    res.json({ ok: true, challenge: completed, promotion });
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
