const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { teacherOwnsClass, teacherOwnsStudent, parentBoundStudent } = require('../utils/scope');
const {
  MODULES, TOPICS, DEFAULT_TOPIC_KEYS, FIXED_GRADE, FIXED_MODULE, FIXED_DIFFICULTY,
  normalizeTopicKeys, questionTypesForTopics,
  practiceDateAt, oldestPendingPracticeCorrection,
  dateRange, generateAssignment, preGenerateDate, resolveStudentPracticePlan,
  evaluateProgression, generatePlanPdf, generateStudentPlanPdf,
  practiceFocusItemIds, practiceVisibleItemIds, serializePracticeSubmission,
} = require('../services/practice');
const {
  decodePrivateImage, storePrivateFile, removePrivateFile,
} = require('../utils/private-files');

const router = express.Router();

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可操作' });
  next();
}

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '仅家长可操作' });
  next();
}

function validDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function practiceItemRender(row) {
  let payload = {};
  try { payload = JSON.parse(row.snapshot_payload || '{}'); } catch {}
  return payload.render ? { render: payload.render } : {};
}

function reviewPracticeItem(row) {
  const { snapshot_payload: _snapshotPayload, ...item } = row;
  let payload = {};
  try { payload = JSON.parse(row.snapshot_payload || '{}'); } catch {}
  return {
    ...item,
    ...(payload.render ? { render: payload.render } : {}),
    ...(payload.answer_render ? { answer_render: payload.answer_render } : {}),
  };
}

function publicPracticeItem(row) {
  return {
    id: row.id,
    position: row.position,
    stem: row.stem,
    module: row.module,
    question_type: row.question_type,
    estimated_seconds: row.estimated_seconds,
    ...practiceItemRender(row),
  };
}

const REVIEW_REVISION_STATUSES = new Set(['reviewed', 'correction_required']);

function reviewRoundNumber(submission) {
  return Math.max(1, Number(submission?.current_round || 1));
}

function currentRoundReviewRows(db, submission) {
  return db.all(`SELECT i.id,i.position,i.snapshot_stem stem,i.snapshot_answer answer,
      i.snapshot_payload,r.is_correct,r.teacher_note review_note,r.reviewed_at
    FROM practice_review_rounds r
    JOIN practice_assignment_items i ON i.id=r.assignment_item_id
    WHERE r.submission_id=? AND r.round_no=?
    ORDER BY i.position`, [submission.id, reviewRoundNumber(submission)])
    .map(reviewPracticeItem);
}

function nextPracticeRoundStarted(db, submission) {
  const roundNo = reviewRoundNumber(submission);
  return Boolean(
    db.get(`SELECT 1 started FROM practice_attachments
      WHERE submission_id=? AND round_no>? LIMIT 1`, [submission.id, roundNo])
    || db.get(`SELECT 1 started FROM practice_submission_rounds
      WHERE submission_id=? AND round_no>? LIMIT 1`, [submission.id, roundNo])
    || db.get(`SELECT 1 started FROM practice_review_rounds
      WHERE submission_id=? AND round_no>? LIMIT 1`, [submission.id, roundNo]),
  );
}

function practiceUploadTargetRound(submission) {
  const currentRound = Math.max(1, Number(submission?.current_round || 1));
  return submission?.status === 'correction_required' ? currentRound + 1 : currentRound;
}

function finishPracticeUploadRound(db, submission, assignmentId, targetRound) {
  db.run(`INSERT INTO practice_submission_rounds(submission_id,round_no,status,submitted_at)
    VALUES(?,?,'submitted',CURRENT_TIMESTAMP)
    ON CONFLICT(submission_id,round_no) DO UPDATE SET
      status='submitted',submitted_at=CURRENT_TIMESTAMP`, [submission.id, targetRound]);
  db.run(`UPDATE practice_submissions SET current_round=?,status='submitted',needs_correction=0,
    teacher_note=NULL,submitted_at=CURRENT_TIMESTAMP,reviewed_by=NULL,reviewed_at=NULL,completed_at=NULL
    WHERE id=?`, [targetRound, submission.id]);
  db.run(`UPDATE practice_assignments SET status='submitted' WHERE id=?`, [assignmentId]);
  return db.get('SELECT * FROM practice_submissions WHERE id=?', [submission.id]);
}

function reviewRevisionLockReason(db, submission, reviewRows = null) {
  if (!REVIEW_REVISION_STATUSES.has(String(submission?.status || ''))) {
    return '当前状态不可修订';
  }
  if (nextPracticeRoundStarted(db, submission)) {
    return '家长已开始上传下一轮订正，不能再修改本轮批改';
  }
  const rows = reviewRows || currentRoundReviewRows(db, submission);
  if (!rows.length) return '当前轮没有可修订的批改结果';
  return '';
}

function reviewSummary(db, submission) {
  const reviewRows = currentRoundReviewRows(db, submission);
  const lockReason = reviewRevisionLockReason(db, submission, reviewRows);
  const wrongPositions = reviewRows
    .filter((item) => Number(item.is_correct) === 0)
    .map((item) => Number(item.position));
  return {
    id: Number(submission.id),
    submission_id: Number(submission.id),
    plan_id: Number(submission.plan_id),
    plan_title: submission.plan_title,
    student_id: Number(submission.student_id),
    student_name: submission.student_name,
    practice_date: submission.practice_date,
    status: submission.status,
    current_round: reviewRoundNumber(submission),
    correction_round: reviewRoundNumber(submission),
    needs_correction: submission.status === 'correction_required'
      || Boolean(Number(submission.needs_correction)),
    reviewed_at: submission.reviewed_at,
    completed_at: submission.completed_at,
    review_revision: Number(submission.review_revision || 0),
    wrong_positions: wrongPositions,
    wrong_count: wrongPositions.length,
    total_count: reviewRows.length,
    can_revise: !lockReason,
    revision_lock_reason: lockReason || null,
  };
}

function revisionResults(body, reviewRows) {
  const results = Array.isArray(body?.results) ? body.results : [];
  const allowedIds = new Set(reviewRows.map((item) => Number(item.id)));
  const byId = new Map();
  for (const result of results) {
    const itemId = Number(result?.item_id);
    if (!Number.isInteger(itemId) || !allowedIds.has(itemId) || byId.has(itemId)) {
      return { error: '修订结果包含重复或不属于当前轮的题目' };
    }
    if (![true, false, 0, 1].includes(result.is_correct)) {
      return { error: '修订结果无效' };
    }
    const previous = reviewRows.find((item) => Number(item.id) === itemId);
    byId.set(itemId, {
      item_id: itemId,
      position: Number(previous.position),
      is_correct: Boolean(Number(result.is_correct)),
      note: Object.prototype.hasOwnProperty.call(result, 'note')
        ? String(result.note || '').slice(0, 240)
        : String(previous.review_note || '').slice(0, 240),
    });
  }
  if (byId.size !== reviewRows.length) {
    return {
      error: '请提交当前轮全部题目的修订结果',
      item_ids: reviewRows.map((item) => Number(item.id)),
    };
  }
  return { results: reviewRows.map((item) => byId.get(Number(item.id))) };
}

function validatePlan(db, teacherId, body) {
  const errors = [];
  const classId = Number(body.class_id);
  if (!teacherOwnsClass(db, teacherId, classId)) errors.push('无权操作该学习小组');
  if (!validDate(body.start_date) || !validDate(body.end_date)) errors.push('日期格式应为 YYYY-MM-DD');
  const dates = dateRange(body.start_date, body.end_date, 32);
  if (!dates.length || dates.length > 31) errors.push('连续打卡应为 1-31 天');
  const grade = FIXED_GRADE;
  const module = FIXED_MODULE;
  const difficulty = FIXED_DIFFICULTY;
  const targetMinutes = Number(body.target_minutes || 20);
  if (!Number.isFinite(targetMinutes) || targetMinutes < 18 || targetMinutes > 22) errors.push('目标时长应为 18-22 分钟');
  const hasTopicSelection = Object.prototype.hasOwnProperty.call(body, 'topic_keys');
  const requestedTopics = hasTopicSelection
    ? (Array.isArray(body.topic_keys) ? body.topic_keys.map(String) : [])
    : [...DEFAULT_TOPIC_KEYS];
  const invalidTopics = requestedTopics.filter((key) => !TOPICS[key]);
  if (hasTopicSelection && !requestedTopics.length) errors.push('请至少选择一个计算模块');
  if (invalidTopics.length) errors.push('包含无效的计算模块');
  const topicKeys = requestedTopics.length && !invalidTopics.length
    ? [...new Set(requestedTopics)] : [...DEFAULT_TOPIC_KEYS];
  const types = questionTypesForTopics(topicKeys);
  let count = 0;
  let guangzhouCount = 0;
  if (MODULES[grade]?.includes(module)) {
    const placeholders = types.map(() => '?').join(',');
    let sql = `SELECT template_key,estimated_seconds,source_region,question_type FROM practice_questions
      WHERE grade_band=? AND subject='数学' AND module=? AND is_active=1
      AND question_type IN (${placeholders})`;
    const params = [grade, module, ...types];
    const candidates = db.all(sql, params);
    count = candidates.length;
    guangzhouCount = candidates.filter((item) => item.source_region === '广州').length;
    if (count < 8) errors.push('当前题库范围不足 8 题');
    const templateUse = new Map();
    let availableSeconds = 0;
    for (const item of candidates.sort((a, b) => Number(b.estimated_seconds) - Number(a.estimated_seconds))) {
      const used = templateUse.get(item.template_key) || 0;
      if (used >= 2) continue;
      templateUse.set(item.template_key, used + 1);
      availableSeconds += Number(item.estimated_seconds || 90);
    }
    if (availableSeconds < targetMinutes * 60 * 0.9) errors.push('初中计算题库不足 18 分钟，请联系管理员补充题库');
  }
  return { errors, dates, classId, grade, module, difficulty, targetMinutes, types, topicKeys, questionCount: count, guangzhouQuestionCount: guangzhouCount };
}

router.get('/catalog', auth, teacherOnly, (req, res) => {
  const rows = getDB().all(`SELECT grade_band,module,question_type,COUNT(*) question_count,
    SUM(CASE WHEN source_region='广州' THEN 1 ELSE 0 END) guangzhou_question_count FROM practice_questions
    WHERE is_active=1 AND grade_band=? AND module=?
    GROUP BY grade_band,module,question_type ORDER BY grade_band,module,question_type`, [FIXED_GRADE, FIXED_MODULE]);
  const topics = Object.entries(TOPICS).map(([key, config]) => ({
    key,
    label: config.label,
    question_types: config.questionTypes,
    question_count: rows.filter((row) => config.questionTypes.includes(row.question_type))
      .reduce((sum, row) => sum + Number(row.question_count || 0), 0),
  }));
  res.json({ modules: MODULES, topics, scopes: rows });
});

router.post('/plans/preview', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const validated = validatePlan(db, req.user.id, req.body || {});
  const students = validated.classId
    ? Number(db.get('SELECT COUNT(*) count FROM students WHERE class_id=? AND deleted_at IS NULL', [validated.classId])?.count || 0) : 0;
  res.status(validated.errors.length ? 400 : 200).json({
    ok: !validated.errors.length,
    errors: validated.errors,
    days: validated.dates.length,
    students,
    topic_keys: validated.topicKeys,
    topic_labels: validated.topicKeys.map((key) => TOPICS[key].label),
    available_questions: validated.questionCount,
    guangzhou_questions: validated.guangzhouQuestionCount,
    estimated_assignments: validated.dates.length * students,
  });
});

router.post('/plans', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const body = req.body || {};
  const value = validatePlan(db, req.user.id, body);
  if (value.errors.length) return res.status(400).json({ error: '计划校验失败', errors: value.errors });
  const overlap = db.get(`SELECT id FROM practice_plans WHERE class_id=? AND status='published'
    AND start_date<=? AND end_date>=? LIMIT 1`, [value.classId, body.end_date, body.start_date]);
  if (overlap) return res.status(409).json({ error: '该学习小组在所选日期已有打卡计划' });
  const students = db.all('SELECT id FROM students WHERE class_id=? AND deleted_at IS NULL', [value.classId]);
  if (!students.length) return res.status(400).json({ error: '学习小组暂无学生' });

  const plan = db.transaction(() => {
    const created = db.run(`INSERT INTO practice_plans
      (teacher_id,class_id,title,start_date,end_date,grade_band,subject,module,question_types,topic_keys,difficulty,target_seconds,auto_advance,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      req.user.id, value.classId, String(body.title || '初中计算每日打卡').trim().slice(0, 60), body.start_date,
      body.end_date, value.grade, '数学', value.module, JSON.stringify(value.types), JSON.stringify(value.topicKeys), value.difficulty,
      Math.round(value.targetMinutes * 60), 0, 'published',
    ]);
    for (const student of students) {
      db.run(`INSERT INTO practice_student_settings
        (plan_id,student_id,current_module,difficulty,auto_advance,is_locked) VALUES(?,?,?,?,?,0)`, [
        created.lastInsertRowid, student.id, value.module, value.difficulty, 0,
      ]);
    }
    db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
      VALUES(?,?,?,?,?)`, [req.user.id, 'practice_plan_created', 'practice_plan', created.lastInsertRowid,
      JSON.stringify({ students: students.length, days: value.dates.length })]);
    return db.get('SELECT * FROM practice_plans WHERE id=?', [created.lastInsertRowid]);
  });
  const today = practiceDateAt();
  let warning = '';
  if (today >= plan.start_date && today <= plan.end_date) {
    try { preGenerateDate(db, today); }
    catch (error) { warning = '计划已发布；今日题目将在家长首次打开时生成'; }
  }
  res.status(201).json({ ok: true, plan, students: students.length, days: value.dates.length, warning });
});

router.get('/plans', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const clauses = ['p.teacher_id=?'];
  const params = [req.user.id];
  const keyword = String(req.query.keyword || '').trim().slice(0, 40);
  if (keyword) {
    clauses.push(`(p.title LIKE ? OR c.name LIKE ? OR EXISTS (
      SELECT 1 FROM practice_student_settings pss JOIN students st ON st.id=pss.student_id
      WHERE pss.plan_id=p.id AND st.deleted_at IS NULL AND st.name LIKE ?
    ))`);
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  const classId = Number(req.query.class_id);
  if (Number.isInteger(classId) && classId > 0) {
    clauses.push('p.class_id=?');
    params.push(classId);
  }
  const status = String(req.query.status || 'all');
  const today = practiceDateAt();
  if (status === 'current') {
    clauses.push("p.status IN ('published','student_curriculum') AND p.start_date<=? AND p.end_date>=?");
    params.push(today, today);
  } else if (status === 'upcoming') {
    clauses.push("p.status IN ('published','student_curriculum') AND p.start_date>?");
    params.push(today);
  } else if (status === 'ended') {
    clauses.push("(p.status NOT IN ('published','student_curriculum') OR p.end_date<?)");
    params.push(today);
  } else if (status !== 'all') {
    return res.status(400).json({ error: '计划状态无效' });
  }
  const month = String(req.query.month || '');
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: '月份格式无效' });
    const [year, monthNumber] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
    clauses.push('p.start_date<? AND p.end_date>=?');
    params.push(`${next}-01`, `${month}-01`);
  }
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(5, Math.min(100, Number.parseInt(req.query.limit || '50', 10) || 50));
  const where = clauses.join(' AND ');
  const total = Number(db.get(`SELECT COUNT(*) count FROM practice_plans p
    JOIN classes c ON c.id=p.class_id WHERE ${where}`, params)?.count || 0);
  const plans = db.all(`SELECT p.*,c.name class_name,
    (SELECT COUNT(*) FROM practice_student_settings s WHERE s.plan_id=p.id) student_count,
    (SELECT COUNT(*) FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id WHERE a.plan_id=p.id) submission_count,
    (SELECT COUNT(*) FROM practice_submissions ps
      JOIN practice_assignments a ON a.id=ps.assignment_id
      JOIN students st ON st.id=a.student_id
      LEFT JOIN classes current_class ON current_class.id=st.class_id
      WHERE a.plan_id=p.id AND ps.status='submitted'
        AND COALESCE(st.teacher_id,current_class.teacher_id)=p.teacher_id
        AND st.deleted_at IS NULL AND current_class.deleted_at IS NULL) pending_submission_count
    FROM practice_plans p JOIN classes c ON c.id=p.class_id
    WHERE ${where} ORDER BY p.created_at DESC,p.id DESC LIMIT ? OFFSET ?`,
  [...params, limit, (page - 1) * limit]);
  const classes = db.all(`SELECT DISTINCT c.id,c.name FROM practice_plans p
    JOIN classes c ON c.id=p.class_id WHERE p.teacher_id=? ORDER BY c.name`, [req.user.id]);
  const months = db.all(`SELECT DISTINCT substr(start_date,1,7) value FROM practice_plans
    WHERE teacher_id=? ORDER BY value DESC`, [req.user.id]).map((item) => item.value);
  res.json({
    plans: plans.map((plan) => ({
      ...plan,
      question_types: JSON.parse(plan.question_types || '[]'),
      topic_keys: normalizeTopicKeys(plan.topic_keys),
    })),
    filters: { classes, months, statuses: ['current', 'upcoming', 'ended'] },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/todos', auth, teacherOnly, (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const includeReview = ['1', 'true'].includes(String(req.query.include_review || '').toLowerCase());
  const db = getDB();
  const total = Number(db.get(`SELECT COUNT(*) count FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE COALESCE(st.teacher_id,c.teacher_id)=? AND ps.status='submitted'
      AND st.deleted_at IS NULL AND c.deleted_at IS NULL`, [req.user.id])?.count || 0);
  const todos = db.all(`SELECT ps.*,ps.id submission_id,a.id assignment_id,a.plan_id,a.practice_date,a.student_id,
    st.name student_name,p.title plan_title,c.name class_name
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE COALESCE(st.teacher_id,c.teacher_id)=? AND ps.status='submitted'
      AND st.deleted_at IS NULL AND c.deleted_at IS NULL
    ORDER BY ps.submitted_at ASC,ps.id ASC LIMIT ? OFFSET ?`, [req.user.id, limit, offset]);
  for (const todo of todos) {
    const state = serializePracticeSubmission(db, todo, { includeRounds: false });
    todo.correction_round = state.correction_round;
    todo.is_correction = state.is_correction;
    todo.needs_correction = state.needs_correction;
    todo.focus_item_ids = state.focus_item_ids;
    todo.attachment_count = state.attachment_count;
    todo.total_attachment_count = state.total_attachment_count;
    if (includeReview) {
      const visibleIds = new Set(practiceVisibleItemIds(db, state));
      todo.attachments = state.attachments;
      todo.items = db.all(`SELECT i.id,i.position,i.snapshot_stem stem,i.snapshot_answer answer,
          i.snapshot_payload,r.is_correct,r.teacher_note review_note
        FROM practice_assignment_items i
        LEFT JOIN practice_review_rounds r ON r.assignment_item_id=i.id
          AND r.submission_id=? AND r.round_no=?
        WHERE i.assignment_id=? ORDER BY i.position`, [
        state.id, state.correction_round, state.assignment_id,
      ])
        .filter((item) => visibleIds.has(Number(item.id)))
        .map(reviewPracticeItem);
    }
  }
  res.json({
    count: total,
    todos,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/plans/:id/settings', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const settings = db.all(`SELECT ps.*,s.name student_name FROM practice_student_settings ps
    JOIN students s ON s.id=ps.student_id
    WHERE ps.plan_id=? AND s.deleted_at IS NULL ORDER BY s.name`, [plan.id]);
  res.json({
    plan: { id: plan.id, grade_band: plan.grade_band, module: plan.module },
    modules: MODULES[plan.grade_band] || [],
    settings,
  });
});

router.put('/plans/:planId/students/:studentId', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [req.params.planId, req.user.id]);
  const studentId = Number(req.params.studentId);
  if (!plan) return res.status(404).json({ error: '计划或学生不存在' });
  const existing = db.get('SELECT * FROM practice_student_settings WHERE plan_id=? AND student_id=?', [plan.id, studentId]);
  if (!existing) return res.status(404).json({ error: '学生不在该计划中' });
  return res.status(409).json({ error: '初中计算题已统一，不支持单独调整模块或难度' });
});

router.get('/today', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  if (!parentBoundStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生' });
  const todayPracticeDate = practiceDateAt();
  const pendingCorrection = oldestPendingPracticeCorrection(db, studentId, todayPracticeDate);
  const plan = pendingCorrection
    ? db.get('SELECT * FROM practice_plans WHERE id=?', [pendingCorrection.plan_id])
    : resolveStudentPracticePlan(db, studentId, todayPracticeDate)
      || db.get(`SELECT p.* FROM practice_plans p JOIN students s ON s.class_id=p.class_id
        WHERE s.id=? AND s.deleted_at IS NULL AND p.status='published' AND p.start_date<=? AND p.end_date>=?
        ORDER BY p.created_at DESC LIMIT 1`, [studentId, todayPracticeDate, todayPracticeDate]);
  if (!plan) return res.json({
    practice_date: todayPracticeDate,
    today_practice_date: todayPracticeDate,
    blocked_by_correction: false,
    assignment: null,
  });
  const assignment = pendingCorrection
    ? db.get('SELECT * FROM practice_assignments WHERE id=?', [pendingCorrection.assignment_id])
    : generateAssignment(db, plan, studentId, todayPracticeDate);
  if (!assignment.claimed_at) db.run('UPDATE practice_assignments SET claimed_at=CURRENT_TIMESTAMP WHERE id=?', [assignment.id]);
  const items = db.all(`SELECT id,position,snapshot_stem stem,snapshot_module module,snapshot_type question_type,
    estimated_seconds,snapshot_payload FROM practice_assignment_items
    WHERE assignment_id=? ORDER BY position`, [assignment.id]).map(publicPracticeItem);
  const submission = db.get('SELECT * FROM practice_submissions WHERE assignment_id=?', [assignment.id]);
  res.json({
    practice_date: assignment.practice_date,
    today_practice_date: todayPracticeDate,
    blocked_by_correction: Boolean(pendingCorrection),
    is_overdue_correction: Boolean(pendingCorrection && assignment.practice_date < todayPracticeDate),
    plan: { id: plan.id, title: plan.title, module: plan.module },
    assignment: {
      ...assignment,
      items,
      submission: submission
        ? serializePracticeSubmission(db, { ...submission, assignment_id: assignment.id })
        : null,
    },
  });
});

router.get('/history', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  if (!parentBoundStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生' });
  const assignments = db.all(`SELECT a.id,a.practice_date,a.estimated_seconds,a.status,p.title,p.module,
    s.id submission_id,s.status submission_status,s.current_round,s.needs_correction,
    s.teacher_note,s.submitted_at,s.reviewed_at,s.completed_at
    FROM practice_assignments a JOIN practice_plans p ON p.id=a.plan_id
    LEFT JOIN practice_submissions s ON s.assignment_id=a.id
    WHERE a.student_id=? ORDER BY a.practice_date DESC LIMIT 31`, [studentId]);
  for (const assignment of assignments) {
    if (!assignment.submission_id) continue;
    const state = serializePracticeSubmission(db, {
      id: assignment.submission_id,
      assignment_id: assignment.id,
      status: assignment.submission_status,
      current_round: assignment.current_round,
      needs_correction: assignment.needs_correction,
      teacher_note: assignment.teacher_note,
      submitted_at: assignment.submitted_at,
      reviewed_at: assignment.reviewed_at,
      completed_at: assignment.completed_at,
    }, { includeRounds: false });
    assignment.correction_round = state.correction_round;
    assignment.is_correction = state.is_correction;
    assignment.needs_correction = state.needs_correction;
    assignment.focus_item_ids = state.focus_item_ids;
    assignment.attachment_count = state.attachment_count;
    assignment.total_attachment_count = state.total_attachment_count;
  }
  res.json({ assignments });
});

router.post('/assignments/:id/upload', auth, parentOnly, async (req, res) => {
  const db = getDB();
  const assignment = db.get('SELECT * FROM practice_assignments WHERE id=?', [req.params.id]);
  if (!assignment || !parentBoundStudent(db, req.user.id, assignment.student_id)) return res.status(404).json({ error: '打卡任务不存在' });
  // 新版家长端逐张上传多图，只有最后一张才进入教师待批队列。
  // 未传此参数的旧客户端仍按单张完整提交处理。
  const uploadCompleteValue = req.query?.upload_complete ?? req.body?.upload_complete;
  const uploadComplete = uploadCompleteValue === undefined
    || !['0', 'false'].includes(String(uploadCompleteValue).toLowerCase());
  let decoded;
  try { decoded = await decodePrivateImage(req.body?.base64); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  let stored;
  let result;
  try {
    result = db.transaction(() => {
      let submission = db.get('SELECT * FROM practice_submissions WHERE assignment_id=?', [assignment.id]);
      if (!submission) {
        const created = db.run(`INSERT INTO practice_submissions
          (assignment_id,parent_id,status,current_round,needs_correction)
          VALUES(?,?,?,1,0)`, [assignment.id, req.user.id, uploadComplete ? 'submitted' : 'uploading']);
        submission = db.get('SELECT * FROM practice_submissions WHERE id=?', [created.lastInsertRowid]);
      }
      if (Number(submission.parent_id) !== Number(req.user.id)) return { wrongParent: true };
      if (submission.status === 'reviewed') return { completed: true };
      if (!['uploading', 'submitted', 'correction_required'].includes(submission.status)) return { invalidStatus: true };
      const targetRound = practiceUploadTargetRound(submission);
      const duplicate = db.get(`SELECT pa.id,pa.round_no,pa.created_at,
          pf.token,pf.mime_type,pf.byte_size
        FROM practice_attachments pa JOIN private_files pf ON pf.id=pa.file_id
        WHERE pa.submission_id=? AND pa.sha256=?`, [submission.id, decoded.sha256]);
      if (duplicate) {
        if (Number(duplicate.round_no || 1) === targetRound) {
          if (uploadComplete) {
            submission = finishPracticeUploadRound(db, submission, assignment.id, targetRound);
          }
          return { duplicate, submission };
        }
        return { duplicatePreviousRound: true };
      }
      const files = db.get(`SELECT COUNT(*) count FROM practice_attachments
        WHERE submission_id=? AND round_no=?`, [submission.id, targetRound]);
      if (Number(files?.count || 0) >= 6) return { tooMany: true };
      stored = storePrivateFile(db, {
        ...decoded, studentId: assignment.student_id, purpose: 'practice_photo',
        ownerType: 'practice_submission', ownerId: submission.id, createdBy: req.user.id,
        originalName: req.body?.fileName || 'practice-photo',
      });
      const attachment = db.run(`INSERT INTO practice_attachments
        (submission_id,round_no,owner_parent_id,file_id,sha256)
        VALUES(?,?,?,?,?)`, [submission.id, targetRound, req.user.id, stored.id, decoded.sha256]);
      if (uploadComplete) {
        submission = finishPracticeUploadRound(db, submission, assignment.id, targetRound);
      }
      return {
        attachmentId: attachment.lastInsertRowid,
        submission,
      };
    });
  } catch (error) {
    if (stored) removePrivateFile(db, { id: stored.id, storage_key: stored.storageKey });
    return res.status(500).json({ error: '图片保存失败' });
  }
  if (result.duplicate) {
    const state = serializePracticeSubmission(db, { ...result.submission, assignment_id: assignment.id });
    const attachment = state.attachments.find((file) => Number(file.id) === Number(result.duplicate.id))
      || state.rounds?.flatMap((round) => round.attachments || [])
        .find((file) => Number(file.id) === Number(result.duplicate.id));
    return res.json({ ok: true, attachment, submission: state, idempotent: true });
  }
  if (result.wrongParent) return res.status(403).json({ error: '该打卡已由另一位绑定家长提交' });
  if (result.completed) return res.status(409).json({ error: '该打卡已完成，无需再次上传' });
  if (result.invalidStatus) return res.status(409).json({ error: '当前状态暂不可上传' });
  if (result.duplicatePreviousRound) return res.status(409).json({ error: '订正照片不能与上一轮相同，请上传本轮订正照片' });
  if (result.tooMany) return res.status(400).json({ error: '每轮打卡最多上传 6 张图片' });
  const state = serializePracticeSubmission(db, { ...result.submission, assignment_id: assignment.id });
  const attachment = state.attachments.find((file) => Number(file.id) === Number(result.attachmentId))
    || state.rounds?.flatMap((round) => round.attachments || [])
      .find((file) => Number(file.id) === Number(result.attachmentId));
  res.status(201).json({ ok: true, attachment, submission: state });
});

router.post('/assignments/:id/upload/complete', auth, parentOnly, (req, res) => {
  const db = getDB();
  const assignment = db.get('SELECT * FROM practice_assignments WHERE id=?', [req.params.id]);
  if (!assignment || !parentBoundStudent(db, req.user.id, assignment.student_id)) {
    return res.status(404).json({ error: '打卡任务不存在' });
  }

  let result;
  try {
    result = db.transaction(() => {
      let submission = db.get('SELECT * FROM practice_submissions WHERE assignment_id=?', [assignment.id]);
      if (!submission) return { noSubmission: true };
      if (Number(submission.parent_id) !== Number(req.user.id)) return { wrongParent: true };
      if (submission.status === 'reviewed') return { completed: true };
      if (submission.status === 'submitted') return { submission, idempotent: true };
      if (!['uploading', 'correction_required'].includes(submission.status)) return { invalidStatus: true };

      const targetRound = practiceUploadTargetRound(submission);
      const files = db.get(`SELECT COUNT(*) count FROM practice_attachments
        WHERE submission_id=? AND round_no=?`, [submission.id, targetRound]);
      if (Number(files?.count || 0) < 1) return { noAttachment: true };

      submission = finishPracticeUploadRound(db, submission, assignment.id, targetRound);
      return { submission, idempotent: false };
    });
  } catch {
    return res.status(500).json({ error: '提交确认失败，请稍后重试' });
  }

  if (result.noSubmission || result.noAttachment) {
    return res.status(409).json({ error: '请先上传至少一张本轮作业照片' });
  }
  if (result.wrongParent) return res.status(403).json({ error: '该打卡已由另一位绑定家长提交' });
  if (result.completed) return res.status(409).json({ error: '该打卡已完成，无需再次提交' });
  if (result.invalidStatus) return res.status(409).json({ error: '当前状态暂不可提交' });

  const state = serializePracticeSubmission(db, {
    ...result.submission,
    assignment_id: assignment.id,
  });
  const teacherQueueReceipt = db.get(`SELECT ps.id
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE ps.id=? AND ps.status='submitted'
      AND COALESCE(st.teacher_id,c.teacher_id) IS NOT NULL
      AND st.deleted_at IS NULL AND c.deleted_at IS NULL`, [state.id]);
  return res.json({
    ok: true,
    submission: state,
    idempotent: result.idempotent,
    teacher_queue_received: Boolean(teacherQueueReceipt),
  });
});

router.get('/reviews/recent', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const requestedLimit = Number.parseInt(req.query.limit || '4', 10);
  const limit = Math.max(1, Math.min(20, Number.isFinite(requestedLimit) ? requestedLimit : 4));
  const rows = db.all(`SELECT ps.*,a.student_id,a.practice_date,a.plan_id,
      st.name student_name,p.title plan_title
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE COALESCE(st.teacher_id,c.teacher_id)=?
      AND st.deleted_at IS NULL AND c.deleted_at IS NULL
      AND ps.status IN ('reviewed','correction_required')
      AND ps.reviewed_at IS NOT NULL
    ORDER BY ps.reviewed_at DESC,ps.id DESC
    LIMIT ?`, [req.user.id, limit]);
  res.json({
    reviews: rows.map((submission) => reviewSummary(db, submission)),
    limit,
  });
});

router.get('/submissions', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const planId = Number(req.query.plan_id);
  const status = String(req.query.status || 'submitted');
  if (!['submitted', 'correction_required', 'reviewed', 'all'].includes(status)) {
    return res.status(400).json({ error: '提交状态无效' });
  }
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit || '20', 10) || 20));
  const preferredId = Math.max(0, Number.parseInt(req.query.submission_id || '0', 10) || 0);
  const offset = (page - 1) * limit;
  const plan = db.get('SELECT * FROM practice_plans WHERE id=?', [planId]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const ownedSubmission = db.get(`SELECT ps.id
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE a.plan_id=? AND COALESCE(st.teacher_id,c.teacher_id)=?
      AND st.deleted_at IS NULL AND c.deleted_at IS NULL
      ${preferredId ? 'AND ps.id=?' : ''}
    LIMIT 1`, preferredId ? [plan.id, req.user.id, preferredId] : [plan.id, req.user.id]);
  if (preferredId && !ownedSubmission) return res.status(404).json({ error: '提交不存在' });
  if (!preferredId && Number(plan.teacher_id) !== Number(req.user.id) && !ownedSubmission) {
    return res.status(404).json({ error: '计划不存在' });
  }
  const clauses = [
    'a.plan_id=?',
    'COALESCE(st.teacher_id,c.teacher_id)=?',
    'st.deleted_at IS NULL',
    'c.deleted_at IS NULL',
  ];
  const params = [plan.id, req.user.id];
  if (status !== 'all') {
    clauses.push('ps.status=?');
    params.push(status);
  }
  if (preferredId) {
    clauses.push('ps.id=?');
    params.push(preferredId);
  }
  const where = clauses.join(' AND ');
  const total = Number(db.get(`SELECT COUNT(*) count FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE ${where}`, params)?.count || 0);
  const submissions = db.all(`SELECT ps.*,a.student_id,a.practice_date,a.plan_id,st.name student_name
    FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE ${where}
    ORDER BY CASE WHEN ps.id=? THEN 0 ELSE 1 END,a.practice_date DESC,st.name LIMIT ? OFFSET ?`, [...params, preferredId, limit, offset]);
  for (let index = 0; index < submissions.length; index++) {
    const submission = serializePracticeSubmission(db, submissions[index]);
    const isHistorical = REVIEW_REVISION_STATUSES.has(String(submission.status || ''));
    if (isHistorical) {
      submission.items = currentRoundReviewRows(db, submission);
      const lockReason = reviewRevisionLockReason(db, submission, submission.items);
      submission.can_revise = !lockReason;
      submission.revision_lock_reason = lockReason || null;
    } else {
      const visibleIds = new Set(practiceVisibleItemIds(db, submission));
      submission.items = db.all(`SELECT i.id,i.position,i.snapshot_stem stem,i.snapshot_answer answer,
          i.snapshot_payload,r.is_correct,r.teacher_note review_note
        FROM practice_assignment_items i
        LEFT JOIN practice_review_rounds r ON r.assignment_item_id=i.id
          AND r.submission_id=? AND r.round_no=?
        WHERE i.assignment_id=? ORDER BY i.position`, [
        submission.id, submission.correction_round, submission.assignment_id,
      ])
        .filter((item) => visibleIds.has(Number(item.id)))
        .map(reviewPracticeItem);
      submission.can_revise = false;
      submission.revision_lock_reason = '当前状态不可修订';
    }
    submissions[index] = submission;
  }
  res.json({ submissions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.put('/submissions/:id/review', auth, teacherOnly, (req, res, next) => {
  const db = getDB();
  const submission = db.get(`SELECT ps.*,a.student_id,a.plan_id,a.id assignment_id
    FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    WHERE ps.id=? AND st.deleted_at IS NULL`, [req.params.id]);
  if (!submission || !teacherOwnsStudent(db, req.user.id, submission.student_id)) {
    return res.status(404).json({ error: '提交不存在' });
  }
  if (submission.status !== 'submitted') {
    const message = submission.status === 'correction_required'
      ? '请等待家长上传订正照片'
      : submission.status === 'uploading'
        ? '照片仍在上传，请稍后刷新'
        : '该打卡已完成批改';
    return res.status(409).json({ error: message });
  }
  const roundNo = Math.max(1, Number(submission.current_round || 1));
  const requestedRound = req.body?.round_no ?? req.body?.correction_round;
  if (requestedRound !== undefined && Number(requestedRound) !== roundNo) {
    return res.status(409).json({ error: '批改轮次已更新，请刷新后重试' });
  }
  const attachmentCount = Number(db.get(`SELECT COUNT(*) count FROM practice_attachments
    WHERE submission_id=? AND round_no=?`, [submission.id, roundNo])?.count || 0);
  if (attachmentCount < 1) {
    return res.status(409).json({ error: '本轮尚未上传照片，暂不可批改' });
  }
  const focusItemIds = practiceFocusItemIds(db, submission);
  const focusSet = new Set(focusItemIds);
  const items = db.all(`SELECT id FROM practice_assignment_items
    WHERE assignment_id=? ORDER BY position`, [submission.assignment_id])
    .filter((item) => focusSet.has(Number(item.id)));
  const results = Array.isArray(req.body.results) ? req.body.results : [];
  const byId = new Map(results.map((item) => [Number(item.item_id), item]));
  if (!items.length || items.some((item) => !byId.has(Number(item.id)))) {
    return res.status(400).json({ error: '请复核本轮全部题目', focus_item_ids: focusItemIds });
  }
  for (const item of items) {
    const result = byId.get(Number(item.id));
    if (![true, false, 0, 1].includes(result.is_correct)) {
      return res.status(400).json({ error: '复核结果无效' });
    }
  }
  const wrongItemIds = items
    .filter((item) => !Number(byId.get(Number(item.id)).is_correct))
    .map((item) => Number(item.id));
  const needsCorrection = wrongItemIds.length > 0;
  const teacherNote = String(req.body.teacher_note || '').slice(0, 500);
  let claimed;
  try {
    claimed = db.transaction(() => {
      // CAS prevents two stale teacher pages from grading the same round twice.
      // "reviewing" is transaction-local and is always replaced or rolled back.
      const lock = db.run(`UPDATE practice_submissions SET status='reviewing'
        WHERE id=? AND status='submitted' AND current_round=?`, [submission.id, roundNo]);
      if (Number(lock.changes) !== 1) return false;
      for (const item of items) {
        const result = byId.get(Number(item.id));
        const note = String(result.note || '').slice(0, 240);
        db.run(`INSERT INTO practice_review_rounds
          (submission_id,round_no,assignment_item_id,is_correct,teacher_note,reviewed_at)
          VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(submission_id,round_no,assignment_item_id) DO UPDATE SET
            is_correct=excluded.is_correct,
            teacher_note=excluded.teacher_note,
            reviewed_at=CURRENT_TIMESTAMP`, [
          submission.id, roundNo, item.id, result.is_correct ? 1 : 0, note,
        ]);
        db.run(`INSERT INTO practice_reviews
          (submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at)
          VALUES(?,?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(submission_id,assignment_item_id) DO UPDATE SET
            is_correct=excluded.is_correct,teacher_note=excluded.teacher_note,
            reviewed_at=CURRENT_TIMESTAMP`, [submission.id, item.id, result.is_correct ? 1 : 0, note]);
      }
      const nextStatus = needsCorrection ? 'correction_required' : 'reviewed';
      db.run(`UPDATE practice_submission_rounds SET status=?,teacher_note=?,reviewed_by=?,
        reviewed_at=CURRENT_TIMESTAMP WHERE submission_id=? AND round_no=?`, [
        nextStatus, teacherNote, req.user.id, submission.id, roundNo,
      ]);
      db.run(`UPDATE practice_submissions SET status=?,needs_correction=?,teacher_note=?,
        reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,
        completed_at=${needsCorrection ? 'NULL' : 'CURRENT_TIMESTAMP'},
        review_revision=review_revision+1 WHERE id=?`, [
        nextStatus, needsCorrection ? 1 : 0, teacherNote, req.user.id, submission.id,
      ]);
      db.run(`UPDATE practice_assignments SET status=? WHERE id=?`, [
        needsCorrection ? 'correction_required' : 'reviewed', submission.assignment_id,
      ]);
      return true;
    });
  } catch (error) {
    if (/UNIQUE constraint failed: practice_review_rounds/i.test(String(error?.message || error))) {
      return res.status(409).json({ error: '本轮已完成批改，请刷新后查看' });
    }
    return next(error);
  }
  if (!claimed) return res.status(409).json({ error: '批改轮次已更新，请刷新后重试' });
  const progression = evaluateProgression(db, submission.plan_id, submission.student_id);
  const state = serializePracticeSubmission(db, {
    ...submission,
    ...db.get('SELECT * FROM practice_submissions WHERE id=?', [submission.id]),
  });
  res.json({
    ok: true,
    status: state.status,
    correction_round: state.correction_round,
    is_correction: state.is_correction,
    needs_correction: state.needs_correction,
    focus_item_ids: state.focus_item_ids,
    wrong_item_ids: wrongItemIds,
    completed_at: state.completed_at,
    review_revision: Number(state.review_revision || 0),
    progression,
  });
});

router.put('/submissions/:id/review/revision', auth, teacherOnly, (req, res, next) => {
  const db = getDB();
  const submission = db.get(`SELECT ps.*,a.student_id,a.plan_id,a.id assignment_id
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    WHERE ps.id=? AND st.deleted_at IS NULL`, [req.params.id]);
  if (!submission || !teacherOwnsStudent(db, req.user.id, submission.student_id)) {
    return res.status(404).json({ error: '提交不存在' });
  }

  const expectedRound = Number(req.body?.expected_round);
  const expectedRevision = Number(req.body?.expected_revision);
  if (!Number.isInteger(expectedRound) || expectedRound < 1
      || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return res.status(400).json({ error: '请提供有效的 expected_round 和 expected_revision' });
  }
  if (expectedRound !== reviewRoundNumber(submission)
      || expectedRevision !== Number(submission.review_revision || 0)) {
    return res.status(409).json({
      error: '批改记录已更新，请刷新后重试',
      current_round: reviewRoundNumber(submission),
      review_revision: Number(submission.review_revision || 0),
    });
  }

  const reviewRows = currentRoundReviewRows(db, submission);
  const lockReason = reviewRevisionLockReason(db, submission, reviewRows);
  if (lockReason) return res.status(409).json({ error: lockReason });
  const parsed = revisionResults(req.body, reviewRows);
  if (parsed.error) {
    return res.status(400).json({
      error: parsed.error,
      ...(parsed.item_ids ? { item_ids: parsed.item_ids } : {}),
    });
  }

  const teacherNote = Object.prototype.hasOwnProperty.call(req.body || {}, 'teacher_note')
    ? String(req.body.teacher_note || '').slice(0, 500)
    : String(submission.teacher_note || '').slice(0, 500);
  const wrongResults = parsed.results.filter((item) => !item.is_correct);
  const nextStatus = wrongResults.length ? 'correction_required' : 'reviewed';
  let outcome;
  try {
    outcome = db.transaction(() => {
      const current = db.get(`SELECT ps.*,a.student_id,a.plan_id,a.id assignment_id
        FROM practice_submissions ps
        JOIN practice_assignments a ON a.id=ps.assignment_id
        JOIN students st ON st.id=a.student_id
        WHERE ps.id=? AND st.deleted_at IS NULL`, [submission.id]);
      if (!current || !teacherOwnsStudent(db, req.user.id, current.student_id)
          || reviewRoundNumber(current) !== expectedRound
          || Number(current.review_revision || 0) !== expectedRevision
          || String(current.status) !== String(submission.status)) {
        return { stale: true };
      }
      const currentRows = currentRoundReviewRows(db, current);
      const currentLockReason = reviewRevisionLockReason(db, current, currentRows);
      if (currentLockReason) return { locked: true, error: currentLockReason };
      const currentIds = currentRows.map((item) => Number(item.id));
      const requestedIds = parsed.results.map((item) => Number(item.item_id));
      if (currentIds.length !== requestedIds.length
          || currentIds.some((itemId, index) => itemId !== requestedIds[index])) {
        return { stale: true };
      }

      const nextRevision = expectedRevision + 1;
      const before = {
        status: current.status,
        needs_correction: Boolean(Number(current.needs_correction)),
        teacher_note: current.teacher_note || '',
        current_round: expectedRound,
        review_revision: expectedRevision,
        reviewed_at: current.reviewed_at,
        completed_at: current.completed_at,
        results: currentRows.map((item) => ({
          item_id: Number(item.id),
          position: Number(item.position),
          is_correct: Boolean(Number(item.is_correct)),
          note: item.review_note || '',
        })),
      };
      const claimed = db.run(`UPDATE practice_submissions SET
          status=?,needs_correction=?,teacher_note=?,reviewed_by=?,
          reviewed_at=CURRENT_TIMESTAMP,
          completed_at=${wrongResults.length ? 'NULL' : 'CURRENT_TIMESTAMP'},
          review_revision=review_revision+1
        WHERE id=? AND current_round=? AND review_revision=? AND status=?`, [
        nextStatus, wrongResults.length ? 1 : 0, teacherNote, req.user.id,
        current.id, expectedRound, expectedRevision, current.status,
      ]);
      if (Number(claimed.changes) !== 1) return { stale: true };

      for (const result of parsed.results) {
        const updated = db.run(`UPDATE practice_review_rounds SET
            is_correct=?,teacher_note=?,reviewed_at=CURRENT_TIMESTAMP
          WHERE submission_id=? AND round_no=? AND assignment_item_id=?`, [
          result.is_correct ? 1 : 0, result.note,
          current.id, expectedRound, result.item_id,
        ]);
        if (Number(updated.changes) !== 1) throw new Error('批改修订写入失败');
        db.run(`INSERT INTO practice_reviews
          (submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at)
          VALUES(?,?,?,?,CURRENT_TIMESTAMP)
          ON CONFLICT(submission_id,assignment_item_id) DO UPDATE SET
            is_correct=excluded.is_correct,teacher_note=excluded.teacher_note,
            reviewed_at=CURRENT_TIMESTAMP`, [
          current.id, result.item_id, result.is_correct ? 1 : 0, result.note,
        ]);
      }
      const roundUpdated = db.run(`UPDATE practice_submission_rounds SET
          status=?,teacher_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP
        WHERE submission_id=? AND round_no=?`, [
        nextStatus, teacherNote, req.user.id, current.id, expectedRound,
      ]);
      if (Number(roundUpdated.changes) !== 1) throw new Error('批改轮次状态写入失败');
      db.run('UPDATE practice_assignments SET status=? WHERE id=?', [
        nextStatus, current.assignment_id,
      ]);

      const updatedSubmission = db.get(`SELECT reviewed_at,completed_at
        FROM practice_submissions WHERE id=?`, [current.id]);
      const after = {
        status: nextStatus,
        needs_correction: wrongResults.length > 0,
        teacher_note: teacherNote,
        current_round: expectedRound,
        review_revision: nextRevision,
        reviewed_at: updatedSubmission?.reviewed_at || null,
        completed_at: updatedSubmission?.completed_at || null,
        results: parsed.results.map((item) => ({
          item_id: item.item_id,
          position: item.position,
          is_correct: item.is_correct,
          note: item.note,
        })),
      };
      db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
        VALUES(?,?,?,?,?)`, [
        req.user.id,
        'practice_review_revised',
        'practice_submission',
        current.id,
        JSON.stringify({ before, after }),
      ]);
      return { ok: true, nextRevision };
    });
  } catch (error) {
    return next(error);
  }
  if (outcome?.stale) {
    const latest = db.get('SELECT current_round,review_revision FROM practice_submissions WHERE id=?', [submission.id]);
    return res.status(409).json({
      error: '批改记录已更新，请刷新后重试',
      current_round: reviewRoundNumber(latest),
      review_revision: Number(latest?.review_revision || 0),
    });
  }
  if (outcome?.locked) return res.status(409).json({ error: outcome.error });

  const state = serializePracticeSubmission(db, {
    ...submission,
    ...db.get('SELECT * FROM practice_submissions WHERE id=?', [submission.id]),
  });
  const updatedRows = currentRoundReviewRows(db, state);
  const updatedLockReason = reviewRevisionLockReason(db, state, updatedRows);
  res.json({
    ok: true,
    status: state.status,
    current_round: state.current_round,
    correction_round: state.correction_round,
    is_correction: state.is_correction,
    needs_correction: state.needs_correction,
    focus_item_ids: state.focus_item_ids,
    wrong_item_ids: updatedRows
      .filter((item) => Number(item.is_correct) === 0)
      .map((item) => Number(item.id)),
    wrong_positions: updatedRows
      .filter((item) => Number(item.is_correct) === 0)
      .map((item) => Number(item.position)),
    completed_at: state.completed_at,
    review_revision: Number(state.review_revision || outcome.nextRevision || 0),
    can_revise: !updatedLockReason,
    revision_lock_reason: updatedLockReason || null,
  });
});

router.get('/plans/:id/pdf', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const studentId = Number(req.query.student_id);
  if (Number.isInteger(studentId) && studentId > 0) {
    const student = db.get(`SELECT s.id,s.name FROM students s
      JOIN practice_student_settings pss ON pss.student_id=s.id AND pss.plan_id=?
      WHERE s.id=? AND s.deleted_at IS NULL`, [plan.id, studentId]);
    if (!student) return res.status(404).json({ error: '学生不在该计划中' });
    try { generateStudentPlanPdf(db, plan, student, res); }
    catch (error) {
      if (!res.headersSent) res.status(500).json({ error: 'PDF 生成失败' });
      else res.destroy(error);
    }
    return;
  }
  // 兼容旧正式版：未传 student_id 时继续生成原五日整班 PDF。
  const start = String(req.query.start_date || plan.start_date);
  if (!validDate(start) || start < plan.start_date || start > plan.end_date) return res.status(400).json({ error: 'PDF 起始日期不在计划范围内' });
  try { generatePlanPdf(db, plan, res, start); }
  catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'PDF 生成失败' });
    else res.destroy(error);
  }
});

module.exports = router;
