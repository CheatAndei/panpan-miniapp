const { normalizeMathDisplay } = require('../utils/math-expression');

const SOURCE_TYPES = new Set(['mental_challenge', 'learning_attempt']);
const REPORT_REASONS = new Set(['sign_bracket', 'unclear', 'answer_error', 'duplicate', 'other']);
const REPORT_STATUSES = new Set(['open', 'resolved', 'dismissed']);

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function studentTeacherId(db, studentId) {
  return Number(db.get(`SELECT COALESCE(c.teacher_id,s.teacher_id) teacher_id
    FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=?`, [studentId])?.teacher_id || 0);
}

function sourceSnapshot(db, { sourceType, sourceId, studentId, sourceQuestionId }) {
  const table = sourceType === 'mental_challenge' ? 'mental_challenges' : 'learning_attempts';
  const source = db.get(`SELECT * FROM ${table} WHERE id=? AND student_id=?`, [sourceId, studentId]);
  if (!source) throw new Error('练习记录不存在');
  const questions = parseJson(source.questions_json, []);
  const index = questions.findIndex((item) => String(item.id) === String(sourceQuestionId));
  if (index < 0) throw new Error('该题不在本次练习中');
  const question = questions[index];
  let bankType = 'mental';
  let bankQuestionId = String(question.id || '');
  if (sourceType === 'learning_attempt') {
    const rawId = String(question.id || '');
    const practice = rawId.match(/^practice:(\d+)$/u);
    const retryMental = rawId.match(/^retry:\d+:(.+)$/u);
    if (practice) {
      bankType = 'practice';
      bankQuestionId = practice[1];
    } else if (rawId.startsWith('mental:')) {
      bankQuestionId = rawId.slice('mental:'.length);
    } else if (retryMental) {
      bankQuestionId = retryMental[1];
    }
  }
  if (!bankQuestionId) throw new Error('题目来源无法识别');
  return {
    question,
    position: index + 1,
    bankType,
    bankQuestionId,
    bankScope: String(source.battle || ''),
    sourceLabel: sourceType === 'mental_challenge'
      ? `口算王 · ${source.battle === 'primary' ? '小学' : '初中'}`
      : `学习计算题 · ${source.task_title || '课堂练习'}`,
  };
}

function questionBankIdentity(sourceType, source, question) {
  if (sourceType === 'mental_challenge') {
    return { bankType: 'mental', bankScope: String(source.battle || ''), bankQuestionId: String(question.id || '') };
  }
  const rawId = String(question.id || '');
  const practice = rawId.match(/^practice:(\d+)$/u);
  const retryMental = rawId.match(/^retry:\d+:(.+)$/u);
  if (practice) return { bankType: 'practice', bankScope: String(source.battle || ''), bankQuestionId: practice[1] };
  if (rawId.startsWith('mental:')) return { bankType: 'mental', bankScope: String(source.battle || ''), bankQuestionId: rawId.slice('mental:'.length) };
  if (retryMental) return { bankType: 'mental', bankScope: String(source.battle || ''), bankQuestionId: retryMental[1] };
  return null;
}

function createScoreReviewQueue(db, report) {
  const candidates = [
    ...db.all(`SELECT id,student_id,battle,questions_json,answer_detail,score,correct_count
      FROM mental_challenges WHERE status='completed' AND battle=?`, [report.bank_scope])
      .map((row) => ({ ...row, source_type: 'mental_challenge' })),
    ...db.all(`SELECT id,student_id,battle,questions_json,answer_detail,score,correct_count
      FROM learning_attempts WHERE status='completed' AND battle=?`, [report.bank_scope])
      .map((row) => ({ ...row, source_type: 'learning_attempt' })),
  ];
  let created = 0;
  for (const source of candidates) {
    const questions = parseJson(source.questions_json, []);
    const details = new Map(parseJson(source.answer_detail, []).map((item) => [String(item.question_id), item]));
    for (const question of questions) {
      const identity = questionBankIdentity(source.source_type, source, question);
      if (!identity || identity.bankType !== report.bank_type
        || identity.bankScope !== String(report.bank_scope || '')
        || identity.bankQuestionId !== String(report.bank_question_id)) continue;
      const answer = details.get(String(question.id));
      const inserted = db.run(`INSERT OR IGNORE INTO calculation_score_reviews
        (trigger_report_id,bank_type,bank_scope,bank_question_id,source_type,source_id,source_question_id,
         student_id,score_before,correct_count_before,answer_was_correct)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [
        report.id, report.bank_type, report.bank_scope, report.bank_question_id, source.source_type,
        source.id, String(question.id), source.student_id, source.score, source.correct_count,
        answer ? (answer.is_correct ? 1 : 0) : null,
      ]);
      created += inserted.changes;
    }
  }
  return created;
}

function recentReportCount(db, parentId, since) {
  const choice = Number(db.get(`SELECT COUNT(*) count FROM choice_king_reports
    WHERE parent_id=? AND datetime(created_at)>=datetime(?)`, [parentId, since])?.count || 0);
  const calculation = Number(db.get(`SELECT COUNT(*) count FROM calculation_question_reports
    WHERE parent_id=? AND datetime(created_at)>=datetime(?)`, [parentId, since])?.count || 0);
  return choice + calculation;
}

function maybeCreatePriorityAlert(db, report) {
  const teacherId = studentTeacherId(db, report.student_id);
  if (!teacherId) return false;
  const count = Number(db.get(`SELECT COUNT(DISTINCT r.student_id) count
    FROM calculation_question_reports r JOIN students s ON s.id=r.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE COALESCE(c.teacher_id,s.teacher_id)=? AND r.bank_type=?
      AND COALESCE(r.bank_scope,'')=COALESCE(?, '') AND r.bank_question_id=?`, [
    teacherId, report.bank_type, report.bank_scope, report.bank_question_id,
  ])?.count || 0);
  if (count < 3) return false;
  const student = db.get('SELECT name FROM students WHERE id=?', [report.student_id]);
  const alertKey = `calculation_report_3:${teacherId}:${report.bank_type}:${report.bank_scope || ''}:${report.bank_question_id}`;
  const created = db.run(`INSERT OR IGNORE INTO teacher_alerts
      (teacher_id,student_id,alert_type,alert_key,title,message,payload_json)
    VALUES(?,?,?,?,?,?,?)`, [
    teacherId, report.student_id, 'calculation_report_3', alertKey,
    '同一道计算题收到 3 人报错', `${student?.name || '学生'}等 ${count} 人反馈同一道题，请优先核对`,
    JSON.stringify({ report_count: count, bank_type: report.bank_type, bank_scope: report.bank_scope, bank_question_id: report.bank_question_id }),
  ]);
  return created.changes > 0;
}

function createCalculationReport(db, {
  sourceType, sourceId, sourceQuestionId, studentId, parentId, reason, detail, now = new Date(),
}) {
  if (!SOURCE_TYPES.has(sourceType)) throw new Error('报错来源无效');
  const numericSourceId = Number(sourceId);
  if (!Number.isInteger(numericSourceId) || numericSourceId < 1) throw new Error('练习编号无效');
  const snapshot = sourceSnapshot(db, {
    sourceType, sourceId: numericSourceId, studentId, sourceQuestionId,
  });
  const duplicate = db.get(`SELECT id,status,created_at FROM calculation_question_reports
    WHERE student_id=? AND source_type=? AND source_id=? AND source_question_id=? AND status='open'
    ORDER BY id DESC LIMIT 1`, [studentId, sourceType, numericSourceId, String(sourceQuestionId)]);
  if (duplicate) return { report: duplicate, duplicate: true, priority_alert_created: false };
  const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  if (recentReportCount(db, parentId, since) >= 5) {
    const error = new Error('报错提交过于频繁，请一小时后再试');
    error.code = 'RATE_LIMITED';
    throw error;
  }
  const normalizedReason = REPORT_REASONS.has(String(reason || '')) ? String(reason) : 'other';
  let createdId = 0;
  let priorityAlertCreated = false;
  db.transaction(() => {
    const created = db.run(`INSERT INTO calculation_question_reports
      (source_type,source_id,source_label,source_question_id,bank_type,bank_scope,bank_question_id,
       student_id,parent_id,question_position,question_type,snapshot_stem,snapshot_answer,reason,detail,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      sourceType, numericSourceId, snapshot.sourceLabel, String(sourceQuestionId), snapshot.bankType,
      snapshot.bankScope, snapshot.bankQuestionId, studentId, parentId, snapshot.position,
      String(snapshot.question.type || '').slice(0, 100), String(snapshot.question.stem || '').slice(0, 4000),
      String(snapshot.question.answer ?? '').slice(0, 500), normalizedReason,
      String(detail || '').trim().slice(0, 200), now.toISOString(), now.toISOString(),
    ]);
    createdId = created.lastInsertRowid;
    priorityAlertCreated = maybeCreatePriorityAlert(db, db.get('SELECT * FROM calculation_question_reports WHERE id=?', [createdId]));
  });
  const row = db.get('SELECT id,status,created_at FROM calculation_question_reports WHERE id=?', [createdId]);
  return { report: row, duplicate: false, priority_alert_created: priorityAlertCreated };
}

function teacherCalculationReports(db, { teacherId, sourceType = '', status = 'open', limit = 100 }) {
  const clauses = ['COALESCE(c.teacher_id,s.teacher_id)=?'];
  const params = [teacherId];
  if (SOURCE_TYPES.has(sourceType)) { clauses.push('r.source_type=?'); params.push(sourceType); }
  if (REPORT_STATUSES.has(status)) { clauses.push('r.status=?'); params.push(status); }
  const rows = db.all(`SELECT r.*,r.detail note,s.name student_name,c.name class_name,
      CASE WHEN r.bank_type='practice' THEN COALESCE(p.is_active,0)
        ELSE CASE WHEN mc.question_id IS NULL OR mc.is_active=1 THEN 1 ELSE 0 END END question_is_active
    FROM calculation_question_reports r JOIN students s ON s.id=r.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    LEFT JOIN practice_questions p ON r.bank_type='practice' AND p.id=CAST(r.bank_question_id AS INTEGER)
    LEFT JOIN mental_question_controls mc ON r.bank_type='mental' AND mc.battle=r.bank_scope AND mc.question_id=r.bank_question_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT ?`, [
    ...params, Math.max(1, Math.min(200, Number(limit) || 100)),
  ]);
  return rows.map((row) => ({
    ...row,
    report_kind: 'calculation',
    question_stem: normalizeMathDisplay(row.snapshot_stem),
    correct_answer: row.snapshot_answer,
    stable_code: `${row.source_type}:${row.source_id}:${row.source_question_id}`,
    high_priority: Number(db.get(`SELECT COUNT(DISTINCT rr.student_id) count
      FROM calculation_question_reports rr JOIN students ss ON ss.id=rr.student_id
      LEFT JOIN classes cc ON cc.id=ss.class_id AND cc.deleted_at IS NULL
      WHERE COALESCE(cc.teacher_id,ss.teacher_id)=? AND rr.bank_type=?
        AND COALESCE(rr.bank_scope,'')=COALESCE(?, '') AND rr.bank_question_id=?`, [
      teacherId, row.bank_type, row.bank_scope, row.bank_question_id,
    ])?.count || 0) >= 3,
    affected_review_count: Number(db.get(`SELECT COUNT(*) count FROM calculation_score_reviews sr
      JOIN students ss ON ss.id=sr.student_id
      LEFT JOIN classes cc ON cc.id=ss.class_id AND cc.deleted_at IS NULL
      WHERE COALESCE(cc.teacher_id,ss.teacher_id)=? AND sr.bank_type=?
        AND COALESCE(sr.bank_scope,'')=COALESCE(?, '') AND sr.bank_question_id=?`, [
      teacherId, row.bank_type, row.bank_scope, row.bank_question_id,
    ])?.count || 0),
  }));
}

function updateCalculationReport(db, {
  teacherId, reportId, status, teacherNote, stopQuestion, now = new Date(),
}) {
  const report = db.get(`SELECT r.* FROM calculation_question_reports r JOIN students s ON s.id=r.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE r.id=? AND COALESCE(c.teacher_id,s.teacher_id)=?`, [reportId, teacherId]);
  if (!report) return null;
  const nextStatus = REPORT_STATUSES.has(String(status || '')) ? String(status) : report.status;
  db.transaction(() => {
    db.run(`UPDATE calculation_question_reports SET status=?,teacher_note=?,handled_by=?,handled_at=?,updated_at=?
      WHERE id=?`, [
      nextStatus, String(teacherNote || '').trim().slice(0, 500), teacherId,
      nextStatus === 'open' ? null : now.toISOString(), now.toISOString(), report.id,
    ]);
    if (stopQuestion === true && report.bank_type === 'practice') {
      db.run('UPDATE practice_questions SET is_active=0 WHERE id=?', [Number(report.bank_question_id)]);
    }
    if (stopQuestion === true && report.bank_type === 'mental') {
      db.run(`INSERT INTO mental_question_controls(battle,question_id,is_active,reason,stopped_by,stopped_at,updated_at)
        VALUES(?,?,0,?,?,?,?)
        ON CONFLICT(battle,question_id) DO UPDATE SET is_active=0,reason=excluded.reason,
          stopped_by=excluded.stopped_by,stopped_at=excluded.stopped_at,updated_at=excluded.updated_at`, [
        report.bank_scope, report.bank_question_id, String(teacherNote || '教师确认题目有误').trim().slice(0, 500),
        teacherId, now.toISOString(), now.toISOString(),
      ]);
    }
    if (stopQuestion === true) createScoreReviewQueue(db, report);
  });
  return teacherCalculationReports(db, { teacherId, sourceType: report.source_type, status: '', limit: 200 })
    .find((item) => Number(item.id) === Number(report.id)) || null;
}

module.exports = {
  SOURCE_TYPES,
  REPORT_REASONS,
  REPORT_STATUSES,
  createCalculationReport,
  teacherCalculationReports,
  updateCalculationReport,
  sourceSnapshot,
  questionBankIdentity,
  createScoreReviewQueue,
};
