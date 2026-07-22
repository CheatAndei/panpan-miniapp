const fs = require('node:fs');
const path = require('node:path');
const { shanghaiWeekStart, maskStudentName } = require('./mental-arena');
const { normalizeGradeCode, normalizeSubjectCode } = require('../utils/content-dimensions');

const OPTION_RE = /^[A-D]$/;
const REPORT_REASONS = new Set(['question_error', 'answer_error', 'unclear', 'other']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);
const CHOICE_KING_RESOURCE_DIR = path.join(__dirname, '..', 'resources', 'choice-king');
const CHOICE_KING_MANIFEST_PATH = process.env.CHOICE_KING_MANIFEST_PATH
  || path.join(CHOICE_KING_RESOURCE_DIR, 'manifest.json');

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function normalizeOption(value) {
  const option = String(value || '').trim().toUpperCase();
  return OPTION_RE.test(option) ? option : null;
}

function normalizedSourcePeriod(value, sourceYear) {
  if (value === true) return 'recent';
  if (value === false) return 'older';
  const text = String(value || '').trim().toLowerCase();
  if (['recent', 'new', '近年'].includes(text)) return 'recent';
  if (['older', 'old', '早年', '很多年前'].includes(text)) return 'older';
  return Number(sourceYear) >= 2024 ? 'recent' : 'older';
}

function normalizedOptions(value) {
  const parsed = typeof value === 'string' ? parseJson(value, null) : value;
  if (Array.isArray(parsed) && parsed.length === 4) return parsed;
  if (parsed && typeof parsed === 'object'
    && ['A', 'B', 'C', 'D'].every((key) => Object.prototype.hasOwnProperty.call(parsed, key))) return parsed;
  return null;
}

function imagePublicUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
  const relative = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!relative || relative.split('/').includes('..')) return null;
  return `/api/choice-king/assets/${relative.split('/').map(encodeURIComponent).join('/')}`;
}

function seedChoiceKingQuestions(db, manifestPath = CHOICE_KING_MANIFEST_PATH) {
  if (!fs.existsSync(manifestPath)) return {
    imported: 0, skipped: 0, deactivated: 0, missing: true,
  };
  const manifest = parseJson(fs.readFileSync(manifestPath, 'utf8'), null);
  const questions = Array.isArray(manifest) ? manifest : manifest?.questions;
  if (!Array.isArray(questions)) throw new Error('选择刷题王 manifest 格式无效');
  if (!questions.length) throw new Error('选择刷题王 manifest 不得为空');
  let imported = 0;
  let skipped = 0;
  let deactivated = 0;
  const generatedKeys = new Set();
  db.transaction(() => {
    questions.forEach((item, index) => {
      const stableCode = String(item?.source_key || item?.stable_code || '').trim().slice(0, 160);
      const correctOption = normalizeOption(item?.correct_option);
      const options = normalizedOptions(item?.options);
      const prefix = stableCode.match(/^(GZ[789])-/)?.[1] || '';
      if (!prefix || !correctOption || !options) { skipped += 1; return; }
      const gradeCode = normalizeGradeCode(item?.grade_code || (prefix === 'GZ8' ? 'g8' : prefix === 'GZ9' ? 'g9' : 'g7'));
      const subjectCode = normalizeSubjectCode(item?.subject_code || 'math');
      generatedKeys.add(stableCode);
      const sourceYear = Number.parseInt(item?.source_year || '', 10) || null;
      db.run(`INSERT INTO choice_king_questions
          (stable_code,stem,options_json,correct_option,explanation,question_image_url,
           source_label,source_year,source_period,original_question_no,grade_code,subject_code,topic_key,difficulty)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(stable_code) DO UPDATE SET
          stem=excluded.stem,options_json=excluded.options_json,correct_option=excluded.correct_option,
          explanation=excluded.explanation,question_image_url=excluded.question_image_url,
          source_label=excluded.source_label,source_year=excluded.source_year,
          source_period=excluded.source_period,original_question_no=excluded.original_question_no,
          grade_code=excluded.grade_code,subject_code=excluded.subject_code,topic_key=excluded.topic_key,difficulty=excluded.difficulty,
          updated_at=CURRENT_TIMESTAMP`, [
        stableCode, String(item?.stem || '').trim().slice(0, 4000), JSON.stringify(options), correctOption,
        String(item?.explanation || '').trim().slice(0, 8000), imagePublicUrl(item?.question_image),
        String(item?.source_label || '').trim().slice(0, 240), sourceYear,
        normalizedSourcePeriod(item?.recent_bucket ?? item?.source_period, sourceYear),
        String(item?.source_question_no || item?.original_question_no || index + 1).trim().slice(0, 40),
        gradeCode, subjectCode, String(item?.topic_key || '').trim().slice(0, 100) || null,
        Math.max(1, Math.min(5, Number(item?.difficulty || 2))),
      ]);
      imported += 1;
    });
    if (!generatedKeys.size) throw new Error('选择刷题王 manifest 缺少有效 GZ7/GZ8/GZ9 generated 题目');
    const retired = db.all(`SELECT id,stable_code FROM choice_king_questions
      WHERE is_active=1 AND substr(stable_code,1,4) IN ('GZ7-','GZ8-','GZ9-')`)
      .filter((item) => !generatedKeys.has(String(item.stable_code || '')));
    for (const item of retired) {
      db.run(`UPDATE choice_king_questions SET is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [item.id]);
      db.run(`UPDATE choice_king_issuances SET closed_at=CURRENT_TIMESTAMP,close_reason='question_stopped'
        WHERE question_id=? AND closed_at IS NULL`, [item.id]);
      deactivated += 1;
    }
  });
  return { imported, skipped, deactivated, missing: false };
}

function addDays(now, days) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function studentTeacherId(db, studentId) {
  return Number(db.get(`SELECT COALESCE(c.teacher_id,s.teacher_id) teacher_id
    FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=? AND s.deleted_at IS NULL`, [studentId])?.teacher_id || 0);
}

function publicQuestion(row, { isReview = false, issuanceId = null, expiresAt = null } = {}) {
  if (!row) return null;
  return {
    id: Number(row.id),
    stable_code: row.stable_code,
    stem: row.stem,
    options: parseJson(row.options_json, {}),
    question_image_url: row.question_image_url || null,
    question_asset_id: row.question_asset_id ? Number(row.question_asset_id) : null,
    source_label: row.source_label || '',
    source_year: row.source_year ? Number(row.source_year) : null,
    original_question_no: row.original_question_no || '',
    grade_code: row.grade_code || 'g7',
    subject_code: row.subject_code || 'math',
    topic_key: row.topic_key || '',
    difficulty: Number(row.difficulty || 2),
    is_review: Boolean(isReview),
    issuance_id: issuanceId ? Number(issuanceId) : null,
    lease_expires_at: expiresAt || null,
  };
}

function answerStats(db, studentId, now = new Date(), gradeCode = 'g7', subjectCode = 'math') {
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  const row = db.get(`SELECT
      COUNT(DISTINCT CASE WHEN a.is_review=0 THEN a.question_id END) attempted_count,
      COUNT(DISTINCT CASE WHEN a.is_correct=1 THEN a.question_id END) correct_count,
      SUM(CASE WHEN a.is_review=1 THEN 1 ELSE 0 END) review_attempts
    FROM choice_king_attempts a JOIN choice_king_questions q ON q.id=a.question_id
    WHERE a.student_id=? AND q.grade_code=? AND q.subject_code=?`, [studentId, grade, subject]) || {};
  const pending = db.get(`SELECT COUNT(*) count FROM choice_king_wrong_progress
    WHERE student_id=? AND status='open' AND question_id IN
      (SELECT id FROM choice_king_questions WHERE grade_code=? AND subject_code=?)`, [studentId, grade, subject]);
  const weekStart = shanghaiWeekStart(now).toISOString();
  const weeklyCorrect = db.get(`SELECT COUNT(*) count FROM (
      SELECT a.question_id,MIN(a.answered_at) first_correct_at FROM choice_king_attempts a
      JOIN choice_king_questions q ON q.id=a.question_id
      WHERE a.student_id=? AND a.is_correct=1 AND q.grade_code=? AND q.subject_code=? GROUP BY a.question_id
    ) WHERE datetime(first_correct_at)>=datetime(?)`, [studentId, grade, subject, weekStart]);
  return {
    attempted_count: Number(row.attempted_count || 0),
    correct_count: Number(row.correct_count || 0),
    review_attempts: Number(row.review_attempts || 0),
    pending_wrong_count: Number(pending?.count || 0),
    weekly_correct_count: Number(weeklyCorrect?.count || 0),
  };
}

function dueWrong(db, studentId, now, grade, subject) {
  return db.get(`SELECT q.*,w.id wrong_progress_id,w.consecutive_correct,w.review_stage,
      w.new_questions_since_review,w.next_due_at
    FROM choice_king_wrong_progress w
    JOIN choice_king_questions q ON q.id=w.question_id
    WHERE w.student_id=? AND w.status='open' AND q.is_active=1 AND q.grade_code=? AND q.subject_code=?
      AND (w.new_questions_since_review>=8 OR datetime(w.next_due_at)<=datetime(?))
    ORDER BY CASE WHEN datetime(w.next_due_at)<=datetime(?) THEN 0 ELSE 1 END,
      datetime(w.next_due_at),w.id LIMIT 1`, [studentId, grade, subject, now.toISOString(), now.toISOString()]);
}

function unseenQuestion(db, studentId, grade, subject) {
  const attempted = Number(db.get(`SELECT COUNT(DISTINCT a.question_id) count FROM choice_king_attempts a
    JOIN choice_king_questions q ON q.id=a.question_id
    WHERE a.student_id=? AND a.is_review=0 AND q.grade_code=? AND q.subject_code=?`, [studentId, grade, subject])?.count || 0);
  const preferredPeriod = attempted % 2 === 0 ? 'recent' : 'older';
  const select = (withPeriod) => db.get(`SELECT q.* FROM choice_king_questions q
    WHERE q.is_active=1 AND q.grade_code=? AND q.subject_code=? ${withPeriod ? 'AND q.source_period=?' : ''}
      AND NOT EXISTS (SELECT 1 FROM choice_king_attempts a
        WHERE a.student_id=? AND a.question_id=q.id AND a.is_review=0)
    ORDER BY q.id LIMIT 1`, withPeriod ? [grade, subject, preferredPeriod, studentId] : [grade, subject, studentId]);
  return select(true) || select(false);
}

function fallbackQuestion(db, studentId, grade, subject) {
  return db.get(`SELECT q.* FROM choice_king_questions q
    WHERE q.is_active=1 AND q.grade_code=? AND q.subject_code=?
      AND NOT EXISTS (SELECT 1 FROM choice_king_wrong_progress w
        WHERE w.student_id=? AND w.question_id=q.id AND w.status='open')
    ORDER BY COALESCE((SELECT MAX(a.answered_at) FROM choice_king_attempts a
      WHERE a.student_id=? AND a.question_id=q.id AND a.is_review=0),'') ASC,q.id ASC LIMIT 1`, [grade, subject, studentId, studentId]);
}

function nextQuestion(db, { studentId, gradeCode = 'g7', subjectCode = 'math', now = new Date() }) {
  const student = db.get('SELECT id FROM students WHERE id=? AND deleted_at IS NULL', [studentId]);
  if (!student) throw new Error('学生不存在');
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  let payload;
  db.transaction(() => {
    db.run(`UPDATE choice_king_issuances SET closed_at=?,close_reason='expired'
      WHERE student_id=? AND closed_at IS NULL AND datetime(expires_at)<=datetime(?)`, [
      now.toISOString(), studentId, now.toISOString(),
    ]);
    db.run(`UPDATE choice_king_issuances SET closed_at=?,close_reason='question_stopped'
      WHERE student_id=? AND closed_at IS NULL AND EXISTS (
        SELECT 1 FROM choice_king_questions q WHERE q.id=choice_king_issuances.question_id AND q.is_active=0
      )`, [now.toISOString(), studentId]);
    db.run(`UPDATE choice_king_issuances SET closed_at=?,close_reason='grade_changed'
      WHERE student_id=? AND closed_at IS NULL AND EXISTS (
        SELECT 1 FROM choice_king_questions q WHERE q.id=choice_king_issuances.question_id
          AND (q.grade_code<>? OR q.subject_code<>?)
      )`, [now.toISOString(), studentId, grade, subject]);
    const active = db.get(`SELECT q.*,i.id issuance_id,i.issue_type,i.expires_at
      FROM choice_king_issuances i JOIN choice_king_questions q ON q.id=i.question_id
      WHERE i.student_id=? AND i.closed_at IS NULL AND q.is_active=1
        AND q.grade_code=? AND q.subject_code=? LIMIT 1`, [studentId, grade, subject]);
    if (active) {
      payload = {
        question: publicQuestion(active, {
          isReview: active.issue_type === 'review', issuanceId: active.issuance_id, expiresAt: active.expires_at,
        }),
        stats: answerStats(db, studentId, now, grade, subject),
      };
      return;
    }
    const wrong = dueWrong(db, studentId, now, grade, subject);
    const row = wrong || unseenQuestion(db, studentId, grade, subject) || fallbackQuestion(db, studentId, grade, subject);
    if (!row) {
      payload = { question: null, stats: answerStats(db, studentId, now, grade, subject) };
      return;
    }
    const expiresAt = addDays(now, 0.25);
    const issued = db.run(`INSERT INTO choice_king_issuances
      (student_id,question_id,issue_type,issued_at,expires_at) VALUES(?,?,?,?,?)`, [
      studentId, row.id, wrong ? 'review' : 'normal', now.toISOString(), expiresAt,
    ]);
    payload = {
      question: publicQuestion(row, {
        isReview: Boolean(wrong), issuanceId: issued.lastInsertRowid, expiresAt,
      }),
      stats: answerStats(db, studentId, now, grade, subject),
    };
  });
  return payload;
}

function replayedAnswer(row) {
  const response = parseJson(row?.response_json, null);
  if (!response) throw new Error('幂等答题记录不完整，请稍后重试');
  return { ...response, idempotent_replay: true };
}

function idempotencyMismatch() {
  const error = new Error('client_request_id 已用于不同的答题请求');
  error.code = 'IDEMPOTENCY_MISMATCH';
  return error;
}

function noActiveIssuance() {
  const error = new Error('题目下发已失效，请重新领取后作答');
  error.code = 'NO_ACTIVE_ISSUANCE';
  return error;
}

function replayForRequest(row, questionId, option) {
  if (Number(row.question_id) !== Number(questionId) || String(row.selected_option) !== String(option)) {
    throw idempotencyMismatch();
  }
  return replayedAnswer(row);
}

function updateReviewProgress(db, progress, isCorrect, now) {
  const streak = isCorrect ? Number(progress.consecutive_correct || 0) + 1 : 0;
  const mastered = streak >= 2;
  const stage = Math.min(2, Number(progress.review_stage || 0) + 1);
  const nextDueAt = mastered ? null : addDays(now, stage === 1 ? 3 : 7);
  db.run(`UPDATE choice_king_wrong_progress SET status=?,consecutive_correct=?,review_stage=?,
    review_attempts=review_attempts+1,new_questions_since_review=0,next_due_at=?,last_review_at=?,
    mastered_at=?,updated_at=? WHERE id=?`, [
    mastered ? 'mastered' : 'open', streak, stage, nextDueAt, now.toISOString(),
    mastered ? now.toISOString() : null, now.toISOString(), progress.id,
  ]);
  return { status: mastered ? 'mastered' : 'open', consecutive_correct: streak, next_due_at: nextDueAt };
}

function updateNormalProgress(db, { studentId, questionId, isCorrect, isFirstNormal, now }) {
  if (isFirstNormal) {
    db.run(`UPDATE choice_king_wrong_progress SET
      new_questions_since_review=new_questions_since_review+1,updated_at=?
      WHERE student_id=? AND status='open' AND question_id!=?`, [now.toISOString(), studentId, questionId]);
  }
  if (isCorrect) return null;
  const firstDueAt = addDays(now, 1);
  db.run(`INSERT INTO choice_king_wrong_progress
      (student_id,question_id,status,consecutive_correct,review_stage,review_attempts,
       new_questions_since_review,next_due_at,last_wrong_at,mastered_at,updated_at)
    VALUES(?,?,'open',0,0,0,0,?,?,NULL,?)
    ON CONFLICT(student_id,question_id) DO UPDATE SET
      status='open',consecutive_correct=0,review_stage=0,review_attempts=0,
      new_questions_since_review=0,next_due_at=excluded.next_due_at,
      last_wrong_at=excluded.last_wrong_at,mastered_at=NULL,updated_at=excluded.updated_at`, [
    studentId, questionId, firstDueAt, now.toISOString(), now.toISOString(),
  ]);
  return { status: 'open', consecutive_correct: 0, next_due_at: firstDueAt };
}

function maybeCreate800Alert(db, studentId) {
  const attemptedCount = Number(db.get(`SELECT COUNT(DISTINCT question_id) count
    FROM choice_king_attempts WHERE student_id=? AND is_review=0`, [studentId])?.count || 0);
  if (attemptedCount < 800) return false;
  const teacherId = studentTeacherId(db, studentId);
  if (!teacherId) return false;
  const student = db.get('SELECT name FROM students WHERE id=?', [studentId]);
  const inserted = db.run(`INSERT OR IGNORE INTO teacher_alerts
      (teacher_id,student_id,alert_type,alert_key,title,message,payload_json)
    VALUES(?,?,? ,?,?,?,?)`, [
    teacherId, studentId, 'choice_king_800', `choice_king_800:${studentId}`,
    '选择刷题王达到 800 题', `${student?.name || '学生'}已完成 800 道不同选择题`,
    JSON.stringify({ attempted_count: attemptedCount, threshold: 800 }),
  ]);
  return inserted.changes > 0;
}

function submitAnswer(db, {
  studentId, parentId, questionId, selectedOption, clientRequestId, now = new Date(),
}) {
  const option = normalizeOption(selectedOption);
  if (!option) throw new Error('请选择 A、B、C 或 D');
  const requestId = String(clientRequestId || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,100}$/.test(requestId)) throw new Error('client_request_id 格式无效');
  const existing = db.get(`SELECT question_id,selected_option,response_json FROM choice_king_attempts
    WHERE student_id=? AND client_request_id=?`, [studentId, requestId]);
  if (existing) return replayForRequest(existing, questionId, option);

  const question = db.get('SELECT * FROM choice_king_questions WHERE id=?', [questionId]);
  if (!question) throw new Error('题目不存在');
  if (!Number(question.is_active)) throw new Error('题目已暂停，请领取下一题');
  const correctOption = normalizeOption(question.correct_option);
  if (!correctOption) throw new Error('题目答案尚未校验');
  const isCorrect = option === correctOption;
  let response;

  db.run(`UPDATE choice_king_issuances SET closed_at=?,close_reason='expired'
    WHERE student_id=? AND closed_at IS NULL AND datetime(expires_at)<=datetime(?)`, [
    now.toISOString(), studentId, now.toISOString(),
  ]);

  db.transaction(() => {
    const concurrent = db.get(`SELECT question_id,selected_option,response_json FROM choice_king_attempts
      WHERE student_id=? AND client_request_id=?`, [studentId, requestId]);
    if (concurrent) { response = replayForRequest(concurrent, questionId, option); return; }
    const issuance = db.get(`SELECT * FROM choice_king_issuances
      WHERE student_id=? AND question_id=? AND closed_at IS NULL
        AND datetime(expires_at)>datetime(?) LIMIT 1`, [studentId, questionId, now.toISOString()]);
    if (!issuance) throw noActiveIssuance();
    const isReview = issuance.issue_type === 'review';
    const progress = isReview ? db.get(`SELECT * FROM choice_king_wrong_progress
      WHERE student_id=? AND question_id=? AND status='open'`, [studentId, questionId]) : null;
    if (isReview && !progress) throw noActiveIssuance();
    const isFirstNormal = !isReview && !db.get(`SELECT 1 FROM choice_king_attempts
      WHERE student_id=? AND question_id=? AND is_review=0 LIMIT 1`, [studentId, questionId]);
    const created = db.run(`INSERT INTO choice_king_attempts
      (student_id,parent_id,question_id,selected_option,is_correct,is_review,client_request_id,answered_at)
      VALUES(?,?,?,?,?,?,?,?)`, [
      studentId, parentId, questionId, option, isCorrect ? 1 : 0, isReview ? 1 : 0,
      requestId, now.toISOString(),
    ]);
    const consumed = db.run(`UPDATE choice_king_issuances
      SET closed_at=?,close_reason='answered',attempt_id=? WHERE id=? AND closed_at IS NULL`, [
      now.toISOString(), created.lastInsertRowid, issuance.id,
    ]);
    if (!consumed.changes) throw noActiveIssuance();
    const wrongProgress = isReview
      ? updateReviewProgress(db, progress, isCorrect, now)
      : updateNormalProgress(db, { studentId, questionId, isCorrect, isFirstNormal, now });
    const alertCreated = !isReview && isFirstNormal ? maybeCreate800Alert(db, studentId) : false;
    response = {
      attempt_id: Number(created.lastInsertRowid),
      question_id: Number(questionId),
      selected_option: option,
      is_correct: isCorrect,
      correct_option: correctOption,
      explanation: question.explanation || '',
      is_review: isReview,
      wrong_progress: wrongProgress,
      teacher_alert_created: alertCreated,
      stats: answerStats(db, studentId, now, question.grade_code, question.subject_code),
      idempotent_replay: false,
    };
    db.run('UPDATE choice_king_attempts SET response_json=? WHERE id=?', [
      JSON.stringify(response), created.lastInsertRowid,
    ]);
  });
  return response;
}

function leaderboard(db, { studentId, period = 'week', gradeCode = 'g7', subjectCode = 'math', now = new Date() }) {
  if (!['week', 'history'].includes(period)) throw new Error('排行榜周期无效');
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  const teacherId = studentTeacherId(db, studentId);
  if (!teacherId) return { period, grade_code:grade, subject_code:subject, period_start: null, entries: [], my_rank: null };
  const periodStart = period === 'week' ? shanghaiWeekStart(now).toISOString() : null;
  const students = db.all(`SELECT s.id,s.name,c.name class_name FROM students s
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE COALESCE(c.teacher_id,s.teacher_id)=?`, [teacherId]);
  const entries = students.map((student) => {
    const firstCorrect = db.all(`SELECT a.question_id,MIN(a.answered_at) first_correct_at
      FROM choice_king_attempts a JOIN choice_king_questions q ON q.id=a.question_id
      WHERE a.student_id=? AND a.is_correct=1 AND q.grade_code=? AND q.subject_code=?
      GROUP BY a.question_id`, [student.id, grade, subject]);
    const score = firstCorrect.filter((item) => !periodStart || new Date(item.first_correct_at) >= new Date(periodStart)).length;
    const attempted = Number(db.get(`SELECT COUNT(DISTINCT a.question_id) count FROM choice_king_attempts a
      JOIN choice_king_questions q ON q.id=a.question_id
      WHERE a.student_id=? AND a.is_review=0 AND q.grade_code=? AND q.subject_code=?`, [student.id, grade, subject])?.count || 0);
    return {
      student_id: Number(student.id),
      student_name: Number(student.id) === Number(studentId) ? student.name : maskStudentName(student.name),
      is_self: Number(student.id) === Number(studentId),
      score,
      correct_count: score,
      attempted_count: attempted,
      class_name: student.class_name || '',
    };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score
    || right.attempted_count - left.attempted_count || left.student_id - right.student_id)
    .slice(0, 100).map((item, index) => ({ ...item, rank: index + 1 }));
  return {
    period,
    grade_code:grade,
    subject_code:subject,
    period_start: periodStart,
    entries,
    my_rank: entries.find((item) => item.is_self) || null,
  };
}

function createReport(db, {
  studentId, parentId, questionId, reason, detail, selectedAnswer, now = new Date(),
}) {
  const question = db.get('SELECT id FROM choice_king_questions WHERE id=?', [questionId]);
  if (!question) throw new Error('题目不存在');
  const duplicate = db.get(`SELECT * FROM choice_king_reports
    WHERE student_id=? AND question_id=? AND status='open' ORDER BY id DESC LIMIT 1`, [studentId, questionId]);
  if (duplicate) return { report: duplicate, duplicate: true };
  const since = addDays(now, -1 / 24);
  const choiceRecentCount = Number(db.get(`SELECT COUNT(*) count FROM choice_king_reports
    WHERE parent_id=? AND datetime(created_at)>=datetime(?)`, [parentId, since])?.count || 0);
  const calculationRecentCount = Number(db.get(`SELECT COUNT(*) count FROM calculation_question_reports
    WHERE parent_id=? AND datetime(created_at)>=datetime(?)`, [parentId, since])?.count || 0);
  const recentCount = choiceRecentCount + calculationRecentCount;
  if (recentCount >= 5) {
    const error = new Error('报错提交过于频繁，请稍后再试');
    error.code = 'RATE_LIMITED';
    throw error;
  }
  const normalizedReason = REPORT_REASONS.has(String(reason || '')) ? String(reason) : 'other';
  const created = db.run(`INSERT INTO choice_king_reports
    (question_id,student_id,parent_id,reason,detail,selected_answer,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)`, [
    questionId, studentId, parentId, normalizedReason,
    String(detail || '').trim().slice(0, 500), normalizeOption(selectedAnswer),
    now.toISOString(), now.toISOString(),
  ]);
  return { report: db.get('SELECT * FROM choice_king_reports WHERE id=?', [created.lastInsertRowid]), duplicate: false };
}

function teacherReports(db, { teacherId, status = 'open', limit = 100 }) {
  const clauses = ['COALESCE(c.teacher_id,s.teacher_id)=?', 's.deleted_at IS NULL'];
  const params = [teacherId];
  if (REPORT_STATUSES.has(status)) { clauses.push('r.status=?'); params.push(status); }
  return db.all(`SELECT r.*,r.detail note,s.name student_name,c.name class_name,q.stable_code,
      q.stem question_stem,q.question_image_url,q.correct_option correct_answer,
      q.source_label,q.is_active question_is_active
    FROM choice_king_reports r JOIN students s ON s.id=r.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    JOIN choice_king_questions q ON q.id=r.question_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT ?`, [
    ...params, Math.max(1, Math.min(200, Number(limit) || 100)),
  ]);
}

function updateReport(db, { teacherId, reportId, status, teacherNote, stopQuestion, now = new Date() }) {
  const report = db.get(`SELECT r.* FROM choice_king_reports r JOIN students s ON s.id=r.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE r.id=? AND s.deleted_at IS NULL AND COALESCE(c.teacher_id,s.teacher_id)=?`, [reportId, teacherId]);
  if (!report) return null;
  const nextStatus = REPORT_STATUSES.has(String(status || '')) ? String(status) : report.status;
  db.transaction(() => {
    db.run(`UPDATE choice_king_reports SET status=?,teacher_note=?,handled_by=?,handled_at=?,updated_at=?
      WHERE id=?`, [
      nextStatus, String(teacherNote || '').trim().slice(0, 500), teacherId,
      nextStatus === 'open' ? null : now.toISOString(), now.toISOString(), reportId,
    ]);
    if (stopQuestion === true) {
      db.run(`UPDATE choice_king_questions SET is_active=0,stopped_by=?,stopped_at=?,updated_at=? WHERE id=?`, [
        teacherId, now.toISOString(), now.toISOString(), report.question_id,
      ]);
      db.run(`UPDATE choice_king_issuances SET closed_at=?,close_reason='question_stopped'
        WHERE question_id=? AND closed_at IS NULL`, [now.toISOString(), report.question_id]);
    }
  });
  return db.get(`SELECT r.*,q.is_active question_is_active FROM choice_king_reports r
    JOIN choice_king_questions q ON q.id=r.question_id WHERE r.id=?`, [reportId]);
}

function teacherAlerts(db, { teacherId, unreadOnly = true, limit = 100 }) {
  const unreadSql = unreadOnly ? ' AND a.read_at IS NULL' : '';
  return db.all(`SELECT a.*,s.name student_name,c.name class_name FROM teacher_alerts a
    JOIN students s ON s.id=a.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.deleted_at IS NULL AND COALESCE(c.teacher_id,s.teacher_id)=?${unreadSql} ORDER BY a.created_at DESC LIMIT ?`, [
    teacherId, Math.max(1, Math.min(200, Number(limit) || 100)),
  ]).map((item) => ({ ...item, payload: parseJson(item.payload_json, {}) }));
}

function markAlertRead(db, { teacherId, alertId, isRead = true, now = new Date() }) {
  const result = db.run(`UPDATE teacher_alerts SET read_at=? WHERE id=? AND EXISTS (
      SELECT 1 FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
      WHERE s.id=teacher_alerts.student_id AND s.deleted_at IS NULL AND COALESCE(c.teacher_id,s.teacher_id)=?
    )`, [isRead ? now.toISOString() : null, alertId, teacherId]);
  if (!result.changes) return null;
  return db.get('SELECT * FROM teacher_alerts WHERE id=?', [alertId]);
}

module.exports = {
  CHOICE_KING_RESOURCE_DIR,
  CHOICE_KING_MANIFEST_PATH,
  seedChoiceKingQuestions,
  studentTeacherId,
  normalizeOption,
  publicQuestion,
  answerStats,
  nextQuestion,
  submitAnswer,
  leaderboard,
  createReport,
  teacherReports,
  updateReport,
  teacherAlerts,
  markAlertRead,
  maybeCreate800Alert,
};
