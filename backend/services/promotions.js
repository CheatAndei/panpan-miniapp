const crypto = require('node:crypto');
const { BATTLES } = require('./mental-arena');
const { publicStudentName } = require('./achievements');

function safeJson(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function studentContext(db, studentId) {
  return db.get(`SELECT s.id,s.name,CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id
    FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=? AND s.deleted_at IS NULL`, [studentId]);
}

function insertEvent(db, { teacherId, studentId, eventKey, eventType, sourceId, payload, createdAt = '' }) {
  const columns = createdAt
    ? '(teacher_id,student_id,event_key,event_type,source_id,payload_json,scene_token,created_at)'
    : '(teacher_id,student_id,event_key,event_type,source_id,payload_json,scene_token)';
  const placeholders = createdAt ? 'VALUES(?,?,?,?,?,?,?,?)' : 'VALUES(?,?,?,?,?,?,?)';
  const params = [
    teacherId, studentId, eventKey, eventType, sourceId, JSON.stringify(payload || {}),
    crypto.randomBytes(12).toString('hex'),
    ...(createdAt ? [createdAt] : []),
  ];
  db.run(`INSERT OR IGNORE INTO teacher_promotion_events ${columns} ${placeholders}`, params);
  return db.get('SELECT * FROM teacher_promotion_events WHERE teacher_id=? AND event_key=?', [teacherId, eventKey]);
}

function recordMentalFirst(db, { studentId, challengeId, battle, periodStart }) {
  const context = studentContext(db, studentId);
  const challenge = context && db.get(`SELECT id,battle,score,correct_count,total_questions,elapsed_seconds,completed_at
    FROM mental_challenges WHERE id=? AND student_id=? AND status='completed'`, [challengeId, studentId]);
  if (!context?.teacher_id || !challenge) return null;
  const total = Number(challenge.total_questions || 20);
  const correct = Number(challenge.correct_count || 0);
  return insertEvent(db, {
    teacherId:context.teacher_id,
    studentId,
    eventKey:`mental:first:${challenge.id}`,
    eventType:'mental_first',
    sourceId:challenge.id,
    payload:{
      title:'本周口算王',
      headline:'新晋本周榜首',
      student_name:publicStudentName(context.name),
      battle:challenge.battle || battle,
      battle_label:BATTLES[challenge.battle || battle]?.label || '口算挑战',
      score:Number(challenge.score || 0),
      correct_count:correct,
      total_questions:total,
      accuracy:total ? Math.round(correct * 100 / total) : 0,
      elapsed_seconds:Number(challenge.elapsed_seconds || 0),
      rank:1,
      period_start:periodStart || '',
      achieved_at:challenge.completed_at,
    },
  });
}

function recordChallengePass(db, { assignmentId }) {
  const row = db.get(`SELECT a.id,a.student_id,a.updated_at,q.title question_title,q.source_label,q.question_type,q.question_asset_id,
      s.name student_name,CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id,
      (SELECT COUNT(*) FROM challenge_assignments_v2 p
        WHERE p.student_id=a.student_id AND p.status='passed') passed_count
    FROM challenge_assignments_v2 a JOIN weekly_challenge_questions q ON q.id=a.question_id
    JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE a.id=? AND a.status='passed' AND s.deleted_at IS NULL`, [assignmentId]);
  if (!row?.teacher_id) return null;
  return insertEvent(db, {
    teacherId:row.teacher_id,
    studentId:row.student_id,
    eventKey:`challenge:pass:${row.id}`,
    eventType:'challenge_pass',
    sourceId:row.id,
    payload:{
      title:'压轴挑战',
      headline:'成功攻下一道压轴题',
      student_name:publicStudentName(row.student_name),
      question_title:row.question_title || '压轴挑战',
      source_label:row.source_label || '潘潘老师精选',
      question_type:row.question_type,
      question_type_label:row.question_type === 'subjective' ? '解答题' : '填空题',
      question_url:row.question_asset_id ? `/api/weekly-challenge/assets/${row.question_asset_id}` : null,
      passed_count:Number(row.passed_count || 1),
      achieved_at:row.updated_at,
    },
  });
}

function recordWeekendMasteryPass(db, { assignmentId }) {
  const row = db.get(`SELECT a.id,a.student_id,a.set_id,a.passed_at,s.name student_name,
      wm.title set_title,wm.cycle_start,wm.cycle_end,
      CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id
    FROM weekend_mastery_assignments a
    JOIN weekend_mastery_sets wm ON wm.id=a.set_id
    JOIN students s ON s.id=a.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE a.id=? AND a.stage=2 AND a.status='passed' AND s.deleted_at IS NULL`, [assignmentId]);
  if (!row?.teacher_id) return null;
  const stages = db.all(`SELECT stage,title,difficulty FROM weekend_mastery_questions
    WHERE set_id=? ORDER BY stage,id`, [row.set_id]).map((item) => ({
    stage:Number(item.stage),
    topic:item.title || (Number(item.stage) === 1 ? '方法熟练训练' : '难度升级训练'),
    difficulty:Number(item.stage) === 1 ? '适中' : '偏难',
  }));
  if (stages.length < 2) return null;
  return insertEvent(db, {
    teacherId:row.teacher_id,
    studentId:row.student_id,
    eventKey:`weekend-mastery:pass:${row.id}`,
    eventType:'weekend_mastery_pass',
    sourceId:row.id,
    createdAt:row.passed_at || '',
    payload:{
      title:'周末攻坚战',
      headline:'双关制霸，拿下本周攻坚战',
      student_name:row.student_name,
      set_title:row.set_title || '周末攻坚战',
      period_start:row.cycle_start,
      period_end:row.cycle_end,
      stages,
      achieved_at:row.passed_at,
    },
  });
}

function backfillWeekendMasteryPromotions(db, teacherId) {
  const rows = db.all(`SELECT a.id FROM weekend_mastery_assignments a
    JOIN students s ON s.id=a.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE a.stage=2 AND a.status='passed' AND s.deleted_at IS NULL
      AND CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?
      AND NOT EXISTS (SELECT 1 FROM teacher_promotion_events e
        WHERE e.teacher_id=? AND e.event_key='weekend-mastery:pass:' || a.id)
    ORDER BY a.passed_at,a.id`, [teacherId, teacherId]);
  rows.forEach((row) => recordWeekendMasteryPass(db, { assignmentId:row.id }));
  return rows.length;
}

function serializeEvent(row, db = null) {
  const payload = safeJson(row.payload_json, {});
  if (db && row.event_type === 'challenge_pass' && !payload.question_url) {
    const source = db.get(`SELECT q.question_asset_id FROM challenge_assignments_v2 a
      JOIN weekly_challenge_questions q ON q.id=a.question_id WHERE a.id=?`, [row.source_id]);
    if (source?.question_asset_id) payload.question_url = `/api/weekly-challenge/assets/${source.question_asset_id}`;
  }
  return {
    id:Number(row.id),
    event_type:row.event_type,
    source_id:Number(row.source_id),
    student_id:Number(row.student_id),
    seen:Boolean(row.seen_at),
    created_at:row.created_at,
    ...payload,
  };
}

function teacherPromotions(db, { teacherId, unseenOnly = false, limit = 30 }) {
  backfillWeekendMasteryPromotions(db, teacherId);
  const rows = db.all(`SELECT * FROM teacher_promotion_events
    WHERE teacher_id=?${unseenOnly ? ' AND seen_at IS NULL' : ''}
    ORDER BY datetime(created_at) DESC,id DESC LIMIT ?`, [teacherId, Math.max(1, Math.min(100, Number(limit) || 30))]);
  const unseen = db.get('SELECT COUNT(*) count FROM teacher_promotion_events WHERE teacher_id=? AND seen_at IS NULL', [teacherId]);
  return { promotions:rows.map((row) => serializeEvent(row, db)), unseen:Number(unseen?.count || 0) };
}

module.exports = {
  backfillWeekendMasteryPromotions,
  recordChallengePass,
  recordMentalFirst,
  recordWeekendMasteryPass,
  serializeEvent,
  teacherPromotions,
};
