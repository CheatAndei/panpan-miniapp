const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { teacherOwnsClass, parentBoundStudent } = require('../utils/scope');
const {
  MODULES, practiceDateAt, dateRange, generateAssignment, preGenerateDate,
  evaluateProgression, generatePlanPdf,
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
  const grade = String(body.grade_band || '');
  const module = String(body.module || '');
  if (!MODULES[grade]?.includes(module)) errors.push('年级或模块无效');
  const difficulty = Number(body.difficulty || 1);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) errors.push('难度应为 1-5');
  const targetMinutes = Number(body.target_minutes || 20);
  if (!Number.isFinite(targetMinutes) || targetMinutes < 18 || targetMinutes > 22) errors.push('目标时长应为 18-22 分钟');
  const types = Array.isArray(body.question_types) ? [...new Set(body.question_types.map(String).filter(Boolean))] : [];
  let count = 0;
  let guangzhouCount = 0;
  if (MODULES[grade]?.includes(module)) {
    let sql = `SELECT template_key,estimated_seconds,source_region FROM practice_questions
      WHERE grade_band=? AND subject='数学' AND module=? AND difficulty<=? AND is_active=1`;
    const params = [grade, module, difficulty];
    if (types.length) {
      sql += ` AND question_type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }
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
    if (availableSeconds < targetMinutes * 60 * 0.9) errors.push('当前题库范围不足 18 分钟，请扩大题型或难度');
  }
  return { errors, dates, classId, grade, module, difficulty, targetMinutes, types, questionCount: count, guangzhouQuestionCount: guangzhouCount };
}

router.get('/catalog', auth, teacherOnly, (req, res) => {
  const rows = getDB().all(`SELECT grade_band,module,question_type,MIN(difficulty) min_difficulty,
    MAX(difficulty) max_difficulty,COUNT(*) question_count,
    SUM(CASE WHEN source_region='广州' THEN 1 ELSE 0 END) guangzhou_question_count FROM practice_questions
    WHERE is_active=1 GROUP BY grade_band,module,question_type ORDER BY grade_band,module,question_type`);
  res.json({ modules: MODULES, scopes: rows });
});

router.post('/plans/preview', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const validated = validatePlan(db, req.user.id, req.body || {});
  const students = validated.classId
    ? Number(db.get('SELECT COUNT(*) count FROM students WHERE class_id=?', [validated.classId])?.count || 0) : 0;
  res.status(validated.errors.length ? 400 : 200).json({
    ok: !validated.errors.length,
    errors: validated.errors,
    days: validated.dates.length,
    students,
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
  const students = db.all('SELECT id FROM students WHERE class_id=?', [value.classId]);
  if (!students.length) return res.status(400).json({ error: '学习小组暂无学生' });

  const plan = db.transaction(() => {
    const created = db.run(`INSERT INTO practice_plans
      (teacher_id,class_id,title,start_date,end_date,grade_band,subject,module,question_types,difficulty,target_seconds,auto_advance,status)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      req.user.id, value.classId, String(body.title || '假期每日打卡').trim().slice(0, 60), body.start_date,
      body.end_date, value.grade, '数学', value.module, JSON.stringify(value.types), value.difficulty,
      Math.round(value.targetMinutes * 60), body.auto_advance === false ? 0 : 1, 'published',
    ]);
    for (const student of students) {
      db.run(`INSERT INTO practice_student_settings
        (plan_id,student_id,current_module,difficulty,auto_advance,is_locked) VALUES(?,?,?,?,?,0)`, [
        created.lastInsertRowid, student.id, value.module, value.difficulty, body.auto_advance === false ? 0 : 1,
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
  const plans = getDB().all(`SELECT p.*,c.name class_name,
    (SELECT COUNT(*) FROM practice_student_settings s WHERE s.plan_id=p.id) student_count,
    (SELECT COUNT(*) FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id WHERE a.plan_id=p.id) submission_count
    FROM practice_plans p JOIN classes c ON c.id=p.class_id
    WHERE p.teacher_id=? ORDER BY p.created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ plans: plans.map((plan) => ({ ...plan, question_types: JSON.parse(plan.question_types || '[]') })) });
});

router.get('/plans/:id/settings', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const settings = db.all(`SELECT ps.*,s.name student_name FROM practice_student_settings ps
    JOIN students s ON s.id=ps.student_id WHERE ps.plan_id=? ORDER BY s.name`, [plan.id]);
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
  const module = req.body.module === undefined ? existing.current_module : String(req.body.module);
  if (!MODULES[plan.grade_band]?.includes(module)) return res.status(400).json({ error: '模块无效' });
  const difficulty = req.body.difficulty === undefined ? existing.difficulty : Number(req.body.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) return res.status(400).json({ error: '难度应为 1-5' });
  db.run(`UPDATE practice_student_settings SET current_module=?,difficulty=?,auto_advance=?,is_locked=?,updated_at=CURRENT_TIMESTAMP
    WHERE plan_id=? AND student_id=?`, [module, difficulty,
    req.body.auto_advance === undefined ? existing.auto_advance : req.body.auto_advance ? 1 : 0,
    req.body.is_locked === undefined ? existing.is_locked : req.body.is_locked ? 1 : 0, plan.id, studentId]);
  res.json({ ok: true, setting: db.get('SELECT * FROM practice_student_settings WHERE plan_id=? AND student_id=?', [plan.id, studentId]) });
});

router.get('/today', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  if (!parentBoundStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生' });
  const practiceDate = practiceDateAt();
  const plan = db.get(`SELECT p.* FROM practice_plans p JOIN students s ON s.class_id=p.class_id
    WHERE s.id=? AND p.status='published' AND p.start_date<=? AND p.end_date>=?
    ORDER BY p.created_at DESC LIMIT 1`, [studentId, practiceDate, practiceDate]);
  if (!plan) return res.json({ practice_date: practiceDate, assignment: null });
  const assignment = generateAssignment(db, plan, studentId, practiceDate);
  if (!assignment.claimed_at) db.run('UPDATE practice_assignments SET claimed_at=CURRENT_TIMESTAMP WHERE id=?', [assignment.id]);
  const items = db.all(`SELECT id,position,snapshot_stem stem,snapshot_module module,snapshot_type question_type,
    snapshot_difficulty difficulty,estimated_seconds FROM practice_assignment_items WHERE assignment_id=? ORDER BY position`, [assignment.id]);
  const submission = db.get('SELECT id,status,teacher_note,submitted_at,reviewed_at FROM practice_submissions WHERE assignment_id=?', [assignment.id]);
  let attachments = [];
  if (submission) attachments = db.all(`SELECT pa.id,pf.token,pf.mime_type,pf.byte_size FROM practice_attachments pa
    JOIN private_files pf ON pf.id=pa.file_id WHERE pa.submission_id=? ORDER BY pa.created_at`, [submission.id])
    .map((file) => ({ ...file, url: `/api/private-files/${file.token}` }));
  res.json({
    practice_date: practiceDate,
    plan: { id: plan.id, title: plan.title, module: plan.module },
    assignment: { ...assignment, items, submission: submission ? { ...submission, attachments } : null },
  });
});

router.get('/history', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = Number(req.query.student_id);
  if (!parentBoundStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生' });
  const assignments = db.all(`SELECT a.id,a.practice_date,a.estimated_seconds,a.status,p.title,p.module,
    s.id submission_id,s.status submission_status,s.teacher_note,s.submitted_at,s.reviewed_at
    FROM practice_assignments a JOIN practice_plans p ON p.id=a.plan_id
    LEFT JOIN practice_submissions s ON s.assignment_id=a.id
    WHERE a.student_id=? ORDER BY a.practice_date DESC LIMIT 31`, [studentId]);
  res.json({ assignments });
});

router.post('/assignments/:id/upload', auth, parentOnly, async (req, res) => {
  const db = getDB();
  const assignment = db.get('SELECT * FROM practice_assignments WHERE id=?', [req.params.id]);
  if (!assignment || !parentBoundStudent(db, req.user.id, assignment.student_id)) return res.status(404).json({ error: '打卡任务不存在' });
  let decoded;
  try { decoded = await decodePrivateImage(req.body?.base64); }
  catch (error) { return res.status(400).json({ error: error.message }); }

  let stored;
  let result;
  try {
    result = db.transaction(() => {
      let submission = db.get('SELECT * FROM practice_submissions WHERE assignment_id=?', [assignment.id]);
      if (!submission) {
        const created = db.run('INSERT INTO practice_submissions(assignment_id,parent_id,status) VALUES(?,?,?)', [assignment.id, req.user.id, 'submitted']);
        submission = db.get('SELECT * FROM practice_submissions WHERE id=?', [created.lastInsertRowid]);
      }
      if (Number(submission.parent_id) !== Number(req.user.id)) return { wrongParent: true };
      const duplicate = db.get(`SELECT pa.id,pf.token FROM practice_attachments pa JOIN private_files pf ON pf.id=pa.file_id
        WHERE pa.submission_id=? AND pa.sha256=?`, [submission.id, decoded.sha256]);
      if (duplicate) return { duplicate };
      const files = db.get('SELECT COUNT(*) count FROM practice_attachments WHERE submission_id=?', [submission.id]);
      if (Number(files?.count || 0) >= 6) return { tooMany: true };
      stored = storePrivateFile(db, {
        ...decoded, studentId: assignment.student_id, purpose: 'practice_photo',
        ownerType: 'practice_submission', ownerId: submission.id, createdBy: req.user.id,
        originalName: req.body?.fileName || 'practice-photo',
      });
      const attachment = db.run(`INSERT INTO practice_attachments(submission_id,owner_parent_id,file_id,sha256)
        VALUES(?,?,?,?)`, [submission.id, req.user.id, stored.id, decoded.sha256]);
      db.run(`UPDATE practice_submissions SET status='submitted',submitted_at=CURRENT_TIMESTAMP WHERE id=?`, [submission.id]);
      db.run(`UPDATE practice_assignments SET status='submitted' WHERE id=?`, [assignment.id]);
      return { attachmentId: attachment.lastInsertRowid };
    });
  } catch (error) {
    if (stored) removePrivateFile(db, { id: stored.id, storage_key: stored.storageKey });
    return res.status(500).json({ error: '图片保存失败' });
  }
  if (result.duplicate) return res.json({ ok: true, attachment: { ...result.duplicate, url: `/api/private-files/${result.duplicate.token}` }, idempotent: true });
  if (result.wrongParent) return res.status(403).json({ error: '该打卡已由另一位绑定家长提交' });
  if (result.tooMany) return res.status(400).json({ error: '每次打卡最多上传 6 张图片' });
  res.status(201).json({ ok: true, attachment: { id: result.attachmentId, token: stored.token, url: `/api/private-files/${stored.token}` } });
});

router.get('/submissions', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const planId = Number(req.query.plan_id);
  const status = String(req.query.status || 'submitted');
  if (!['submitted', 'reviewed', 'all'].includes(status)) return res.status(400).json({ error: '提交状态无效' });
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [planId, req.user.id]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const statusSql = status === 'all' ? '' : ' AND ps.status=?';
  const params = status === 'all' ? [plan.id] : [plan.id, status];
  const total = Number(db.get(`SELECT COUNT(*) count FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id WHERE a.plan_id=?${statusSql}`, params)?.count || 0);
  const submissions = db.all(`SELECT ps.*,a.student_id,a.practice_date,a.plan_id,st.name student_name
    FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN students st ON st.id=a.student_id WHERE a.plan_id=?${statusSql}
    ORDER BY a.practice_date DESC,st.name LIMIT ? OFFSET ?`, [...params, limit, offset]);
  for (const submission of submissions) {
    submission.items = db.all(`SELECT i.id,i.position,i.snapshot_stem stem,i.snapshot_answer answer,
      r.is_correct,r.teacher_note review_note FROM practice_assignment_items i
      LEFT JOIN practice_reviews r ON r.assignment_item_id=i.id AND r.submission_id=?
      WHERE i.assignment_id=? ORDER BY i.position`, [submission.id, submission.assignment_id]);
    submission.attachments = db.all(`SELECT pa.id,pf.token,pf.mime_type,pf.byte_size FROM practice_attachments pa
      JOIN private_files pf ON pf.id=pa.file_id WHERE pa.submission_id=? ORDER BY pa.created_at`, [submission.id])
      .map((file) => ({ ...file, url: `/api/private-files/${file.token}` }));
  }
  res.json({ submissions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.put('/submissions/:id/review', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const submission = db.get(`SELECT ps.*,a.student_id,a.plan_id,a.id assignment_id,p.teacher_id plan_teacher_id
    FROM practice_submissions ps JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_plans p ON p.id=a.plan_id WHERE ps.id=?`, [req.params.id]);
  if (!submission || Number(submission.plan_teacher_id) !== Number(req.user.id)) return res.status(404).json({ error: '提交不存在' });
  const items = db.all('SELECT id FROM practice_assignment_items WHERE assignment_id=? ORDER BY position', [submission.assignment_id]);
  const results = Array.isArray(req.body.results) ? req.body.results : [];
  const byId = new Map(results.map((item) => [Number(item.item_id), item]));
  if (!items.length || items.some((item) => !byId.has(Number(item.id)))) return res.status(400).json({ error: '请复核全部题目' });
  db.transaction(() => {
    for (const item of items) {
      const result = byId.get(Number(item.id));
      if (![true, false, 0, 1].includes(result.is_correct)) throw new Error('复核结果无效');
      db.run(`INSERT OR REPLACE INTO practice_reviews
        (submission_id,assignment_item_id,is_correct,teacher_note,reviewed_at)
        VALUES(?,?,?,?,CURRENT_TIMESTAMP)`, [submission.id, item.id, result.is_correct ? 1 : 0, String(result.note || '').slice(0, 240)]);
    }
    db.run(`UPDATE practice_submissions SET status='reviewed',teacher_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`, [
      String(req.body.teacher_note || '').slice(0, 500), req.user.id, submission.id,
    ]);
    db.run(`UPDATE practice_assignments SET status='reviewed' WHERE id=?`, [submission.assignment_id]);
  });
  const progression = evaluateProgression(db, submission.plan_id, submission.student_id);
  res.json({ ok: true, status: 'reviewed', progression });
});

router.get('/plans/:id/pdf', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const plan = db.get('SELECT * FROM practice_plans WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  if (!plan) return res.status(404).json({ error: '计划不存在' });
  const start = String(req.query.start_date || plan.start_date);
  if (!validDate(start) || start < plan.start_date || start > plan.end_date) return res.status(400).json({ error: 'PDF 起始日期不在计划范围内' });
  try { generatePlanPdf(db, plan, res, start); }
  catch (error) {
    if (!res.headersSent) res.status(500).json({ error: 'PDF 生成失败' });
    else res.destroy(error);
  }
});

module.exports = router;
