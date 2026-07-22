const crypto = require('node:crypto');
const { leaderboard: mentalLeaderboard, BATTLES } = require('./mental-arena');

const DEFAULT_CORRECT_MILESTONES = [30,100,300,500,800,1000,1200,1500,2000,3000,5000];
const DEFAULT_COMPLETE_MILESTONES = [50,100,200,300,500,800,1000,1200,1500,2000,3000,5000];

function parseMilestones(name, fallback) {
  const values = String(process.env[name] || '').split(',')
    .map((item) => Number.parseInt(item.trim(), 10))
    .filter((item) => Number.isInteger(item) && item > 0);
  return [...new Set(values.length ? values : fallback)].sort((a, b) => a - b);
}

function safeJson(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

const COMPOUND_SURNAMES = ['欧阳','司马','上官','诸葛','东方','皇甫','尉迟','公孙','慕容','司徒'];
function publicStudentName(name) {
  const text = String(name || '').trim();
  if (!text) return '同学';
  const compound = COMPOUND_SURNAMES.find((item) => text.startsWith(item));
  return `${compound || Array.from(text)[0]}同学`;
}

function insertRecord(db, { studentId, key, category, metricKey, metricValue, payload, achievedAt }) {
  db.run(`INSERT OR IGNORE INTO achievement_records
    (student_id,achievement_key,category,metric_key,metric_value,payload_json,scene_token,achieved_at)
    VALUES(?,?,?,?,?,?,?,?)`, [
    studentId, key, category, metricKey, Number(metricValue || 0), JSON.stringify(payload || {}),
    crypto.randomBytes(12).toString('hex'), achievedAt || new Date().toISOString(),
  ]);
}

function syncChoice(db, studentId) {
  const stats = db.get(`SELECT
      COUNT(DISTINCT CASE WHEN a.is_review=0 THEN a.question_id END) completed_count,
      COUNT(DISTINCT CASE WHEN a.is_correct=1 THEN a.question_id END) correct_count,
      COUNT(DISTINCT CASE WHEN a.is_correct=1 THEN NULLIF(q.source_label,'') END) source_count,
      MAX(a.answered_at) achieved_at
    FROM choice_king_attempts a JOIN choice_king_questions q ON q.id=a.question_id
    WHERE a.student_id=?`, [studentId]) || {};
  const completed = Number(stats.completed_count || 0);
  const correct = Number(stats.correct_count || 0);
  const sourceCount = Number(stats.source_count || 0);
  for (const milestone of parseMilestones('CHOICE_CORRECT_MILESTONES', DEFAULT_CORRECT_MILESTONES)) {
    if (correct < milestone) break;
    insertRecord(db, {
      studentId, key:`choice:correct:${milestone}`, category:'choice', metricKey:'correct', metricValue:milestone,
      achievedAt:stats.achieved_at, payload:{ title:'选择刷题王', headline:`正确突破 ${milestone} 题`, correct_count:correct, completed_count:completed, source_count:sourceCount },
    });
  }
  for (const milestone of parseMilestones('CHOICE_COMPLETE_MILESTONES', DEFAULT_COMPLETE_MILESTONES)) {
    if (completed < milestone) break;
    insertRecord(db, {
      studentId, key:`choice:complete:${milestone}`, category:'choice', metricKey:'complete', metricValue:milestone,
      achievedAt:stats.achieved_at, payload:{ title:'选择刷题王', headline:`完成突破 ${milestone} 题`, correct_count:correct, completed_count:completed, source_count:sourceCount },
    });
  }
}

function syncMental(db, studentId) {
  const rows = db.all(`SELECT * FROM mental_challenges WHERE student_id=? AND status='completed'
    ORDER BY completed_at DESC,id DESC LIMIT 30`, [studentId]);
  for (const row of rows) {
    const total = Number(row.total_questions || 0);
    const correct = Number(row.correct_count || 0);
    const accuracy = total ? Math.round(correct * 100 / total) : 0;
    let rank = null;
    let participantCount = 0;
    try {
      const board = mentalLeaderboard(db, { studentId, battle:row.battle, period:'history' });
      participantCount = board.entries.length;
      if (Number(board.my_rank?.score) === Number(row.score)) rank = Number(board.my_rank.rank);
    } catch {}
    const percentile = rank && participantCount >= 5
      ? Math.max(0, Math.round((participantCount - rank) * 100 / participantCount)) : null;
    insertRecord(db, {
      studentId, key:`mental:challenge:${row.id}`, category:'mental', metricKey:'score', metricValue:row.score,
      achievedAt:row.completed_at, payload:{
        title:'口算王', headline:`本局得分 ${row.score}`, battle_label:BATTLES[row.battle]?.label || '口算挑战',
        score:Number(row.score || 0), correct_count:correct, total_questions:total, accuracy,
        elapsed_seconds:Number(row.elapsed_seconds || 0), rank, participant_count:participantCount, percentile,
      },
    });
  }
}

function syncChallenge(db, studentId) {
  const rows = db.all(`SELECT a.id,a.updated_at achieved_at,q.title,q.source_label,q.question_type,
      (SELECT COUNT(*) FROM challenge_assignments_v2 p WHERE p.student_id=a.student_id AND p.status='passed'
        AND datetime(p.updated_at)<=datetime(a.updated_at)) passed_count
    FROM challenge_assignments_v2 a JOIN weekly_challenge_questions q ON q.id=a.question_id
    WHERE a.student_id=? AND a.status='passed' ORDER BY a.updated_at DESC,a.id DESC LIMIT 30`, [studentId]);
  for (const row of rows) {
    insertRecord(db, {
      studentId, key:`challenge:pass:${row.id}`, category:'challenge', metricKey:'passed', metricValue:row.passed_count,
      achievedAt:row.achieved_at || new Date().toISOString(), payload:{
        title:'压轴挑战', headline:'成功拿下一道压轴题', question_title:row.title || '压轴挑战',
        source_label:row.source_label || '潘潘老师精选', question_type:row.question_type, passed_count:Number(row.passed_count || 1),
      },
    });
  }
}

function serialize(row, studentName) {
  return {
    id:Number(row.id), category:row.category, metric_key:row.metric_key, metric_value:Number(row.metric_value || 0),
    achieved_at:row.achieved_at, seen:Boolean(row.seen_at), display_name:publicStudentName(studentName),
    ...safeJson(row.payload_json, {}),
  };
}

function achievements(db, studentId) {
  const student = db.get('SELECT id,name FROM students WHERE id=?', [studentId]);
  if (!student) throw new Error('学生不存在');
  db.transaction(() => { syncChoice(db, studentId); syncMental(db, studentId); syncChallenge(db, studentId); });
  const rows = db.all(`SELECT * FROM achievement_records WHERE student_id=?
    ORDER BY datetime(achieved_at) DESC,id DESC LIMIT 100`, [studentId]);
  return {
    student_name:publicStudentName(student.name),
    achievements:rows.map((row) => serialize(row, student.name)),
    unseen:rows.filter((row) => !row.seen_at).map((row) => serialize(row, student.name)),
    config:{
      choice_correct:parseMilestones('CHOICE_CORRECT_MILESTONES', DEFAULT_CORRECT_MILESTONES),
      choice_complete:parseMilestones('CHOICE_COMPLETE_MILESTONES', DEFAULT_COMPLETE_MILESTONES),
    },
  };
}

module.exports = {
  DEFAULT_CORRECT_MILESTONES, DEFAULT_COMPLETE_MILESTONES, parseMilestones, publicStudentName,
  achievements,
};
