const crypto = require('node:crypto');
const { BATTLES, QUESTION_BANK } = require('../resources/mental-arena/questions');

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function hashSort(items, seed) {
  return [...items].sort((a, b) => {
    const left = crypto.createHash('sha256').update(`${seed}|${a.id}`).digest('hex');
    const right = crypto.createHash('sha256').update(`${seed}|${b.id}`).digest('hex');
    return left.localeCompare(right);
  });
}

function selectQuestions(battle, seed, excludedIds = new Set()) {
  const config = BATTLES[battle];
  if (!config) throw new Error('战场无效');
  const available = QUESTION_BANK[battle].filter((item) => !excludedIds.has(item.id));
  const byType = new Map();
  for (const item of available) {
    if (!byType.has(item.type)) byType.set(item.type, []);
    byType.get(item.type).push(item);
  }
  const types = hashSort([...byType.keys()].map((id) => ({ id })), `${seed}|types`).map((item) => item.id);
  const selected = [];
  let round = 0;
  while (selected.length < config.question_count && round < 10) {
    for (const type of types) {
      const candidates = hashSort(byType.get(type) || [], `${seed}|${type}`);
      if (candidates[round]) selected.push(candidates[round]);
      if (selected.length === config.question_count) break;
    }
    round += 1;
  }
  if (selected.length !== config.question_count) throw new Error('可用题目不足');
  return selected;
}

function recentQuestionIds(db, studentId, battle) {
  const rows = db.all(`SELECT questions_json FROM mental_challenges
    WHERE student_id=? AND battle=? ORDER BY id DESC LIMIT 5`, [studentId, battle]);
  const ids = new Set();
  for (const row of rows) {
    for (const item of parseJson(row.questions_json, [])) ids.add(item.id);
  }
  return ids;
}

function publicQuestions(questions) {
  return questions.map(({ id, type, stem }, index) => ({ id, position: index + 1, type, stem }));
}

function serializeChallenge(challenge) {
  if (!challenge) return null;
  const questions = parseJson(challenge.questions_json, []);
  return {
    id: challenge.id,
    student_id: challenge.student_id,
    battle: challenge.battle,
    battle_label: BATTLES[challenge.battle]?.label || '',
    status: challenge.status,
    started_at: challenge.started_at,
    completed_at: challenge.completed_at,
    elapsed_seconds: challenge.elapsed_seconds,
    correct_count: challenge.correct_count,
    total_questions: challenge.total_questions,
    speed_bonus: challenge.speed_bonus,
    score: challenge.score,
    is_fishing: !!challenge.is_fishing,
    questions: publicQuestions(questions),
    answers: challenge.status === 'completed' ? parseJson(challenge.answer_detail, []) : undefined,
  };
}

function isJuniorStudent(student) {
  const text = [student?.grade, student?.class_grade, student?.class_name].filter(Boolean).join(' ');
  return /初中|初[一二三123]|七年|八年|九年|中学|\b[789]\s*年级/i.test(text);
}

function createChallenge(db, { studentId, parentId, battle, now = new Date() }) {
  if (!BATTLES[battle]) throw new Error('请选择小学或初中战场');
  const student = db.get(`SELECT s.*,c.name class_name,c.grade class_grade
    FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?`, [studentId]);
  if (!student) throw new Error('学生不存在');
  const excluded = recentQuestionIds(db, studentId, battle);
  const seed = `${studentId}|${battle}|${now.toISOString()}|${crypto.randomBytes(8).toString('hex')}`;
  const questions = selectQuestions(battle, seed, excluded);
  const created = db.run(`INSERT INTO mental_challenges
    (student_id,parent_id,battle,status,questions_json,started_at,total_questions,is_fishing)
    VALUES(?,?,?,?,?,?,?,?)`, [
    studentId, parentId, battle, 'active', JSON.stringify(questions), now.toISOString(),
    BATTLES[battle].question_count, battle === 'primary' && isJuniorStudent(student) ? 1 : 0,
  ]);
  return serializeChallenge(db.get('SELECT * FROM mental_challenges WHERE id=?', [created.lastInsertRowid]));
}

function numericValue(raw) {
  let text = String(raw ?? '').trim().replace(/[−—]/g, '-').replace(/，/g, '.').replace(/\s+/g, '');
  text = text.replace(/^[xX]=/, '');
  if (!text) return null;
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
  const match = text.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (!match || Number(match[2]) === 0) return null;
  return Number(match[1]) / Number(match[2]);
}

function answersEqual(expected, actual) {
  const left = numericValue(expected);
  const right = numericValue(actual);
  return left !== null && right !== null && Math.abs(left - right) < 1e-9;
}

function speedBonus(battle, elapsedSeconds) {
  const config = BATTLES[battle];
  if (elapsedSeconds <= config.target_seconds) return 99;
  if (elapsedSeconds >= config.bonus_end_seconds) return 0;
  const ratio = (config.bonus_end_seconds - elapsedSeconds)
    / (config.bonus_end_seconds - config.target_seconds);
  return Math.max(0, Math.min(99, Math.round(99 * ratio)));
}

function completeChallenge(db, challengeId, submittedAnswers, now = new Date()) {
  const challenge = db.get('SELECT * FROM mental_challenges WHERE id=?', [challengeId]);
  if (!challenge) throw new Error('挑战不存在');
  if (challenge.status === 'completed') return serializeChallenge(challenge);
  if (challenge.status !== 'active') throw new Error('挑战状态无效');
  const questions = parseJson(challenge.questions_json, []);
  const answerMap = new Map((Array.isArray(submittedAnswers) ? submittedAnswers : [])
    .map((item) => [String(item?.question_id || ''), String(item?.answer ?? '').slice(0, 32)]));
  const details = questions.map((question, index) => {
    const answer = answerMap.get(String(question.id)) || '';
    return {
      question_id: question.id,
      position: index + 1,
      stem: question.stem,
      answer,
      correct_answer: question.answer,
      is_correct: answersEqual(question.answer, answer),
    };
  });
  const correctCount = details.filter((item) => item.is_correct).length;
  const startMs = new Date(challenge.started_at).getTime();
  const elapsed = Math.max(1, Math.min(3600, Math.ceil((now.getTime() - startMs) / 1000)));
  const bonus = speedBonus(challenge.battle, elapsed);
  const score = correctCount * 100 + bonus;
  db.run(`UPDATE mental_challenges SET status='completed',completed_at=?,elapsed_seconds=?,
    correct_count=?,speed_bonus=?,score=?,answer_detail=? WHERE id=? AND status='active'`, [
    now.toISOString(), elapsed, correctCount, bonus, score, JSON.stringify(details), challenge.id,
  ]);
  return serializeChallenge(db.get('SELECT * FROM mental_challenges WHERE id=?', [challenge.id]));
}

function shanghaiWeekStart(now = new Date()) {
  const offset = 8 * 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - sinceMonday);
  return new Date(local.getTime() - offset);
}

function compareAttempts(a, b) {
  return Number(b.score) - Number(a.score)
    || Number(b.correct_count) - Number(a.correct_count)
    || Number(a.elapsed_seconds) - Number(b.elapsed_seconds)
    || String(a.completed_at).localeCompare(String(b.completed_at));
}

function leaderboard(db, { studentId, battle, period = 'week', now = new Date() }) {
  if (!BATTLES[battle]) throw new Error('战场无效');
  if (!['week', 'history'].includes(period)) throw new Error('排行榜周期无效');
  const scope = db.get(`SELECT COALESCE(s.teacher_id,c.teacher_id) teacher_id
    FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?`, [studentId]);
  if (!scope?.teacher_id) return { period, battle, entries: [], my_rank: null };
  const params = [scope.teacher_id, battle];
  let timeSql = '';
  let periodStart = null;
  if (period === 'week') {
    periodStart = shanghaiWeekStart(now).toISOString();
    timeSql = ' AND mc.completed_at>=?';
    params.push(periodStart);
  }
  const rows = db.all(`SELECT mc.*,s.name student_name,s.external_id
    FROM mental_challenges mc JOIN students s ON s.id=mc.student_id
    LEFT JOIN classes c ON c.id=s.class_id
    WHERE COALESCE(s.teacher_id,c.teacher_id)=? AND mc.battle=? AND mc.status='completed'${timeSql}`, params);
  const best = new Map();
  for (const row of rows) {
    const current = best.get(Number(row.student_id));
    if (!current || compareAttempts(row, current) < 0) best.set(Number(row.student_id), row);
  }
  const ranked = [...best.values()].sort(compareAttempts).slice(0, 100).map((row, index) => ({
    rank: index + 1,
    student_id: row.student_id,
    student_name: row.student_name,
    score: Number(row.score),
    correct_count: Number(row.correct_count),
    total_questions: Number(row.total_questions),
    elapsed_seconds: Number(row.elapsed_seconds),
    is_fishing: !!row.is_fishing,
    completed_at: row.completed_at,
  }));
  return {
    period,
    period_start: periodStart,
    battle,
    battle_label: BATTLES[battle].label,
    entries: ranked,
    my_rank: ranked.find((item) => Number(item.student_id) === Number(studentId)) || null,
  };
}

module.exports = {
  BATTLES,
  QUESTION_BANK,
  selectQuestions,
  createChallenge,
  completeChallenge,
  serializeChallenge,
  numericValue,
  answersEqual,
  speedBonus,
  shanghaiWeekStart,
  leaderboard,
  isJuniorStudent,
};
