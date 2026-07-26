const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { teacherOwnsClass, parentBoundStudent } = require('../utils/scope');
const {
  MODULES, TOPICS, DEFAULT_TOPIC_KEYS, FIXED_GRADE, FIXED_MODULE, FIXED_DIFFICULTY,
  normalizeTopicKeys, questionTypesForTopics,
  practiceDateAt, dateRange, generateAssignment, preGenerateDate, evaluateProgression, generatePlanPdf, generateStudentPlanPdf,
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
    clauses.push("p.status='published' AND p.start_date<=? AND p.end_date>=?");
    params.push(today, today);
  } else if (status === 'upcoming') {
    clauses.push("p.status='published' AND p.start_date>?");
    params.push(today);
  } else if (status === 'ended') {
    clauses.push("(p.status!='published' OR p.end_date<?)");
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
    (SELECT COUNT(*) FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id WHERE a.plan_id=p.id AND ps.status='submitted') pending_submission_count
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
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit || '20', 10) || 20));
  const db = getDB();
  const total = Number(db.get(`SELECT COUNT(*) count FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students st ON st.id=a.student_id
    WHERE p.teacher_id=? AND ps.status='submitted' AND st.deleted_at IS NULL`, [req.user.id])?.count || 0);
  const todos = db.all(`SELECT ps.*,ps.id submission_id,a.id assignment_id,a.plan_id,a.practice_date,a.student_id,
    st.name student_name,p.title plan_title,c.name class_name
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id
    JOIN students st ON st.id=a.student_id
    JOIN classes c ON c.id=p.class_id
    WHERE p.teacher_id=? AND ps.status='submitted' AND st.deleted_at IS NULL
    ORDER BY ps.submitted_at ASC,ps.id ASC LIMIT ?`, [req.user.id, limit]);
  for (const todo of todos) {
    const state = serializePracticeSubmission(db, todo, { includeRounds: false });
    todo.correction_round = state.correction_round;
    todo.is_correction = state.is_correction;
    todo.needs_correction = state.needs_correction;
    todo.focus_item_ids = state.focus_item_ids;
    todo.attachment_count = state.attachment_count;
  }
  res.json({ count: total, todos });
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
  const practiceDate = practiceDateAt();
  const plan = db.get(`SELECT p.* FROM practice_plans p JOIN students s ON s.class_id=p.class_id
    WHERE s.id=? AND s.deleted_at IS NULL AND p.status='published' AND p.start_date<=? AND p.end_date>=?
    ORDER BY p.created_at DESC LIMIT 1`, [studentId, practiceDate, practiceDate]);
  if (!plan) return res.json({ practice_date: practiceDate, assignment: null });
  const assignment = generateAssignment(db, plan, studentId, practiceDate);
  if (!assignment.claimed_at) db.run('UPDATE practice_assignments SET claimed_at=CURRENT_TIMESTAMP WHERE id=?', [assignment.id]);
  const items = db.all(`SELECT id,position,snapshot_stem stem,snapshot_module module,snapshot_type question_type,
    estimated_seconds FROM practice_assignment_items WHERE assignment_id=? ORDER BY position`, [assignment.id]);
  const submission = db.get('SELECT * FROM practice_submissions WHERE assignment_id=?', [assignment.id]);
  res.json({
    practice_date: practiceDate,
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
      const currentRound = Math.max(1, Number(submission.current_round || 1));
      const targetRound = submission.status === 'correction_required' ? currentRound + 1 : currentRound;
      const finishRoundUpload = () => {
        db.run(`INSERT INTO practice_submission_rounds(submission_id,round_no,status,submitted_at)
          VALUES(?,?,'submitted',CURRENT_TIMESTAMP)
          ON CONFLICT(submission_id,round_no) DO UPDATE SET
            status='submitted',submitted_at=CURRENT_TIMESTAMP`, [submission.id, targetRound]);
        db.run(`UPDATE practice_submissions SET current_round=?,status='submitted',needs_correction=0,
          teacher_note=NULL,submitted_at=CURRENT_TIMESTAMP,reviewed_by=NULL,reviewed_at=NULL,completed_at=NULL
          WHERE id=?`, [targetRound, submission.id]);
        db.run(`UPDATE practice_assignments SET status='submitted' WHERE id=?`, [assignment.id]);
        return db.get('SELECT * FROM practice_submissions WHERE id=?', [submission.id]);
      };
      const duplicate = db.get(`SELECT pa.id,pa.round_no,pa.created_at,
          pf.token,pf.mime_type,pf.byte_size
        FROM practice_attachments pa JOIN private_files pf ON pf.id=pa.file_id
        WHERE pa.submission_id=? AND pa.sha256=?`, [submission.id, decoded.sha256]);
      if (duplicate) {
        if (Number(duplicate.round_no || 1) === targetRound) {
          if (uploadComplete) submission = finishRoundUpload();
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
      if (uploadComplete) submission = finishRoundUpload();
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
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [planId, req.user.id]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const statusSql = status === 'all' ? '' : ' AND ps.status=?';
  const params = status === 'all' ? [plan.id] : [plan.id, status];
  const total = Number(db.get(`SELECT COUNT(*) count FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id
    WHERE a.plan_id=? AND st.deleted_at IS NULL${statusSql}`, params)?.count || 0);
  const submissions = db.all(`SELECT ps.*,a.student_id,a.practice_date,a.plan_id,st.name student_name
    FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id WHERE a.plan_id=? AND st.deleted_at IS NULL${statusSql}
    ORDER BY CASE WHEN ps.id=? THEN 0 ELSE 1 END,a.practice_date DESC,st.name LIMIT ? OFFSET ?`, [...params, preferredId, limit, offset]);
  for (let index = 0; index < submissions.length; index++) {
    const submission = serializePracticeSubmission(db, submissions[index]);
    const visibleIds = new Set(practiceVisibleItemIds(db, submission));
    submission.items = db.all(`SELECT i.id,i.position,i.snapshot_stem stem,i.snapshot_answer answer,
        r.is_correct,r.teacher_note review_note
      FROM practice_assignment_items i
      LEFT JOIN practice_review_rounds r ON r.assignment_item_id=i.id
        AND r.submission_id=? AND r.round_no=?
      WHERE i.assignment_id=? ORDER BY i.position`, [
      submission.id, submission.correction_round, submission.assignment_id,
    ]).filter((item) => visibleIds.has(Number(item.id)));
    submissions[index] = submission;
  }
  res.json({ submissions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.put('/submissions/:id/review', auth, teacherOnly, (req, res, next) => {
  const db = getDB();
  const submission = db.get(`SELECT ps.*,a.student_id,a.plan_id,a.id assignment_id,p.teacher_id plan_teacher_id
    FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id JOIN students st ON st.id=a.student_id
    WHERE ps.id=? AND st.deleted_at IS NULL`, [req.params.id]);
  if (!submission || Number(submission.plan_teacher_id) !== Number(req.user.id)) return res.status(404).json({ error: '提交不存在' });
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
          VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)`, [
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
        completed_at=${needsCorrection ? 'NULL' : 'CURRENT_TIMESTAMP'} WHERE id=?`, [
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
    progression,
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
