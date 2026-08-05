const crypto = require('node:crypto');

const DEFAULT_MANIFEST = require('../resources/weekend-mastery/g7-two-weeks-v1');
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const GATE_WEEKDAYS = new Set([5, 6, 0]);
const RENDER_SECTION_TYPES = new Set(['paragraph', 'formula', 'list', 'table', 'number_line', 'note']);

let nowProvider = () => new Date();

class WeekendMasteryError extends Error {
  constructor(message, code = 'WEEKEND_MASTERY_INVALID', statusCode = 400) {
    super(message);
    this.name = 'WeekendMasteryError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function currentTime() {
  const value = new Date(nowProvider());
  return Number.isNaN(value.getTime()) ? new Date() : value;
}

function setNowProviderForTests(provider) {
  if (process.env.NODE_ENV !== 'test') throw new Error('仅测试环境可替换周末攻坚战时钟');
  nowProvider = typeof provider === 'function' ? provider : (() => new Date(provider));
}

function resetNowProviderForTests() {
  nowProvider = () => new Date();
}

function parseJson(value, fallback = null) {
  try { return JSON.parse(value); } catch { return fallback; }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(stableValue(value)))
    .digest('hex');
}

function validDateKey(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function dateOffset(dateKey, days) {
  const value = new Date(`${dateKey}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + Number(days || 0));
  return value.toISOString().slice(0, 10);
}

function shanghaiLogicalDate(now = currentTime()) {
  const local = new Date(new Date(now).getTime() + SHANGHAI_OFFSET_MS);
  if (local.getUTCHours() < 1) local.setUTCDate(local.getUTCDate() - 1);
  return local.toISOString().slice(0, 10);
}

function shanghaiInstant(dateKey, hour = 1) {
  return new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00+08:00`).toISOString();
}

function weekendCycleAt(now = currentTime()) {
  const logicalDate = shanghaiLogicalDate(now);
  const logical = new Date(`${logicalDate}T00:00:00Z`);
  const weekday = logical.getUTCDay();
  const daysSinceFriday = (weekday + 2) % 7;
  const cycleStart = dateOffset(logicalDate, -daysSinceFriday);
  const cycleEnd = dateOffset(cycleStart, 7);
  const gateEndDate = dateOffset(cycleStart, 3);
  return {
    logical_date: logicalDate,
    logical_weekday: weekday,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    starts_at: shanghaiInstant(cycleStart),
    ends_at: shanghaiInstant(cycleEnd),
    gate_starts_at: shanghaiInstant(cycleStart),
    gate_ends_at: shanghaiInstant(gateEndDate),
    gate_active: GATE_WEEKDAYS.has(weekday),
  };
}

function cleanText(value, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

function validStructuredDocument(value) {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.sections)
    && value.sections.length > 0
    && value.sections.every((section) => section && RENDER_SECTION_TYPES.has(String(section.type || ''))));
}

function validTeacherDocument(value) {
  return Boolean(value && typeof value === 'object'
    && (cleanText(value.text, 20000) || validStructuredDocument(value)));
}

function normalizeManifest(manifest) {
  if (Number(manifest?.schema_version) !== 1 || !Array.isArray(manifest?.sets)) {
    throw new WeekendMasteryError('周末攻坚战内容清单格式无效', 'WEEKEND_MASTERY_MANIFEST_INVALID');
  }
  const seenSets = new Set();
  const seenQuestions = new Set();
  return manifest.sets.map((rawSet) => {
    const stableCode = cleanText(rawSet?.stable_code, 120);
    const cycleStart = cleanText(rawSet?.cycle_start, 10);
    const cycleEnd = cleanText(rawSet?.cycle_end, 10);
    const questions = Array.isArray(rawSet?.questions) ? rawSet.questions : [];
    if (!stableCode || seenSets.has(stableCode)) throw new WeekendMasteryError('题组 stable_code 缺失或重复');
    if (!validDateKey(cycleStart) || cycleEnd !== dateOffset(cycleStart, 7)) {
      throw new WeekendMasteryError(`${stableCode} 必须是连续七天的题组`);
    }
    if (new Date(`${cycleStart}T00:00:00Z`).getUTCDay() !== 5) {
      throw new WeekendMasteryError(`${stableCode} 必须从周五开始`);
    }
    if (questions.length !== 2 || new Set(questions.map((item) => Number(item?.stage))).size !== 2
      || !questions.some((item) => Number(item?.stage) === 1)
      || !questions.some((item) => Number(item?.stage) === 2)) {
      throw new WeekendMasteryError(`${stableCode} 必须且只能包含第 1、2 关`);
    }
    seenSets.add(stableCode);
    const normalizedQuestions = questions.map((rawQuestion) => {
      const questionCode = cleanText(rawQuestion?.stable_code, 140);
      const stage = Number(rawQuestion?.stage);
      const difficulty = Number(rawQuestion?.difficulty);
      if (!questionCode || seenQuestions.has(questionCode)) throw new WeekendMasteryError('题目 stable_code 缺失或重复');
      if (![1, 2].includes(stage) || !Number.isInteger(difficulty) || difficulty < 3 || difficulty > 5) {
        throw new WeekendMasteryError(`${questionCode} 的关卡或难度无效`);
      }
      if (!validStructuredDocument(rawQuestion?.render)) {
        throw new WeekendMasteryError(`${questionCode} 的题干结构无效`, 'WEEKEND_MASTERY_MANIFEST_INVALID');
      }
      if (!validTeacherDocument(rawQuestion?.answer) || !validTeacherDocument(rawQuestion?.solution)) {
        throw new WeekendMasteryError(`${questionCode} 缺少可显示的答案或解法`, 'WEEKEND_MASTERY_MANIFEST_INVALID');
      }
      seenQuestions.add(questionCode);
      const normalized = {
        stable_code: questionCode,
        stage,
        difficulty,
        title: cleanText(rawQuestion?.title, 160),
        render: rawQuestion.render,
        diagram: rawQuestion.diagram ?? null,
        answer: rawQuestion.answer,
        solution: rawQuestion.solution,
        source_label: cleanText(rawQuestion?.source_label, 240),
        source_url: cleanText(rawQuestion?.source_url, 1000),
        provenance_note: cleanText(rawQuestion?.provenance_note, 1000),
      };
      if (!normalized.title) throw new WeekendMasteryError(`${questionCode} 缺少标题`);
      return { ...normalized, content_sha256: sha256(normalized) };
    }).sort((a, b) => a.stage - b.stage);
    const normalizedSet = {
      stable_code: stableCode,
      cycle_start: cycleStart,
      cycle_end: cycleEnd,
      grade_code: cleanText(rawSet?.grade_code || 'g7', 16),
      subject_code: cleanText(rawSet?.subject_code || 'math', 24),
      topic_key: cleanText(rawSet?.topic_key, 120),
      title: cleanText(rawSet?.title, 160),
      status: ['draft', 'published', 'archived'].includes(rawSet?.status) ? rawSet.status : 'draft',
      questions: normalizedQuestions,
    };
    if (!normalizedSet.topic_key || !normalizedSet.title) throw new WeekendMasteryError(`${stableCode} 缺少主题或标题`);
    return { ...normalizedSet, content_sha256: sha256(normalizedSet) };
  });
}

function seedWeekendMastery(db, manifest = DEFAULT_MANIFEST) {
  const sets = normalizeManifest(manifest);
  return db.transaction(() => {
    let inserted = 0;
    let updated = 0;
    let protectedCount = 0;
    for (const set of sets) {
      let storedSet = db.get(`SELECT * FROM weekend_mastery_sets
        WHERE stable_code=? OR (cycle_start=? AND grade_code=? AND subject_code=?)
        ORDER BY CASE WHEN stable_code=? THEN 0 ELSE 1 END LIMIT 1`, [
        set.stable_code, set.cycle_start, set.grade_code, set.subject_code, set.stable_code,
      ]);
      const hasAssignments = storedSet && db.get('SELECT 1 ok FROM weekend_mastery_assignments WHERE set_id=? LIMIT 1', [storedSet.id]);
      if (storedSet && hasAssignments && storedSet.content_sha256 !== set.content_sha256) {
        protectedCount += 1;
        continue;
      }
      if (!storedSet) {
        const created = db.run(`INSERT INTO weekend_mastery_sets
          (stable_code,cycle_start,cycle_end,grade_code,subject_code,topic_key,title,status,content_sha256)
          VALUES(?,?,?,?,?,?,?,?,?)`, [
          set.stable_code, set.cycle_start, set.cycle_end, set.grade_code, set.subject_code,
          set.topic_key, set.title, set.status, set.content_sha256,
        ]);
        storedSet = db.get('SELECT * FROM weekend_mastery_sets WHERE id=?', [created.lastInsertRowid]);
        inserted += 1;
      } else {
        db.run(`UPDATE weekend_mastery_sets SET stable_code=?,cycle_start=?,cycle_end=?,grade_code=?,
          subject_code=?,topic_key=?,title=?,status=?,content_sha256=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
          set.stable_code, set.cycle_start, set.cycle_end, set.grade_code, set.subject_code,
          set.topic_key, set.title, set.status, set.content_sha256, storedSet.id,
        ]);
        updated += 1;
      }
      for (const question of set.questions) {
        const existing = db.get(`SELECT * FROM weekend_mastery_questions
          WHERE stable_code=? OR (set_id=? AND stage=?)
          ORDER BY CASE WHEN stable_code=? THEN 0 ELSE 1 END LIMIT 1`, [
          question.stable_code, storedSet.id, question.stage, question.stable_code,
        ]);
        const values = [
          storedSet.id, question.stable_code, question.stage, question.difficulty, question.title,
          JSON.stringify(question.render), question.diagram === null ? null : JSON.stringify(question.diagram),
          JSON.stringify(question.answer), JSON.stringify(question.solution), question.source_label,
          question.source_url, question.provenance_note, question.content_sha256,
        ];
        if (!existing) {
          db.run(`INSERT INTO weekend_mastery_questions
            (set_id,stable_code,stage,difficulty,title,render_json,diagram_json,answer_json,solution_json,
             source_label,source_url,provenance_note,content_sha256)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, values);
        } else {
          db.run(`UPDATE weekend_mastery_questions SET set_id=?,stable_code=?,stage=?,difficulty=?,title=?,
            render_json=?,diagram_json=?,answer_json=?,solution_json=?,source_label=?,source_url=?,
            provenance_note=?,content_sha256=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...values, existing.id]);
        }
      }
    }
    return { sets: sets.length, inserted, updated, protected: protectedCount };
  });
}

function studentRow(db, studentId) {
  return db.get(`SELECT s.*,c.grade class_grade,c.name class_name,
    CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id
    FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=? AND s.deleted_at IS NULL`, [Number(studentId)]);
}

function isGradeSeven(student) {
  const grade = String(student?.grade || student?.class_grade || '').toLowerCase();
  if (/g8|g9|八|九|初二|初三/.test(grade)) return false;
  return /g7|七|初一/.test(grade) || !grade;
}

function publishedSet(db, cycleStart) {
  return db.get(`SELECT * FROM weekend_mastery_sets
    WHERE cycle_start=? AND grade_code='g7' AND subject_code='math' AND status='published' LIMIT 1`, [cycleStart]);
}

function nextPublishedCycle(db, afterDate) {
  return db.get(`SELECT cycle_start FROM weekend_mastery_sets
    WHERE cycle_start>? AND grade_code='g7' AND subject_code='math' AND status='published'
    ORDER BY cycle_start LIMIT 1`, [afterDate])?.cycle_start || null;
}

function questionsForSet(db, setId) {
  return db.all('SELECT * FROM weekend_mastery_questions WHERE set_id=? ORDER BY stage', [setId]);
}

function assignmentRow(db, assignmentId) {
  return db.get(`SELECT a.*,q.title,q.difficulty,q.render_json,q.diagram_json,q.answer_json,q.solution_json,
    q.source_label,q.source_url,q.provenance_note,s.name student_name,c.name class_name,
    CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id,
    wm.cycle_start,wm.cycle_end,wm.title set_title,wm.stable_code set_stable_code
    FROM weekend_mastery_assignments a
    JOIN weekend_mastery_questions q ON q.id=a.question_id
    JOIN weekend_mastery_sets wm ON wm.id=a.set_id
    JOIN students s ON s.id=a.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE a.id=? AND s.deleted_at IS NULL`, [Number(assignmentId)]);
}

function assignmentsForSet(db, studentId, setId) {
  return db.all(`SELECT id FROM weekend_mastery_assignments
    WHERE student_id=? AND set_id=? ORDER BY stage`, [studentId, setId])
    .map((row) => assignmentRow(db, row.id));
}

function latestSubmission(db, assignmentId) {
  return db.get(`SELECT * FROM weekend_mastery_submissions
    WHERE assignment_id=? ORDER BY attempt_no DESC,id DESC LIMIT 1`, [assignmentId]);
}

function latestCorrectionNote(db, assignmentId) {
  return db.get(`SELECT teacher_note FROM weekend_mastery_submissions
    WHERE assignment_id=? AND status='reviewed' AND is_correct=0
    ORDER BY COALESCE(reviewed_at,updated_at) DESC,attempt_no DESC,id DESC LIMIT 1`, [assignmentId])?.teacher_note || '';
}

function serializeSubmission(db, submission, role = 'parent') {
  if (!submission) return null;
  const attachments = db.all(`SELECT a.id,f.token,f.mime_type,f.byte_size
    FROM weekend_mastery_attachments a JOIN private_files f ON f.id=a.file_id
    WHERE a.submission_id=? ORDER BY a.created_at,a.id`, [submission.id])
    .map((item) => ({ ...item, url: `/api/private-files/${item.token}` }));
  return {
    id: Number(submission.id),
    attempt_no: Number(submission.attempt_no),
    status: submission.status,
    student_note: submission.student_note || '',
    teacher_note: submission.teacher_note || '',
    is_correct: submission.is_correct === null || submission.is_correct === undefined
      ? null : Boolean(submission.is_correct),
    submitted_at: submission.submitted_at || null,
    reviewed_at: submission.reviewed_at || null,
    attachments,
    ...(role === 'teacher' ? { parent_id: Number(submission.parent_id) } : {}),
  };
}

function serializeQuestion(row, role = 'parent') {
  const question = {
    render: parseJson(row.render_json, { version: 1, sections: [] }),
    diagram: parseJson(row.diagram_json, null),
  };
  if (role === 'teacher') {
    const answer = parseJson(row.answer_json, null);
    const solution = parseJson(row.solution_json, null);
    question.answer = answer;
    question.solution = solution;
    question.answer_text = answer?.text || '';
    question.answer_render = answer?.sections || answer?.blocks ? answer : null;
    question.solution_text = solution?.text || '';
    question.solution_render = solution?.sections || solution?.blocks ? solution : null;
    question.verification_note = solution?.verification_note || '';
    question.source_label = row.source_label || '';
    question.source = {
      label: row.source_label || '',
      url: row.source_url || '',
      note: row.provenance_note || '',
    };
  }
  return question;
}

function serializeAssignment(db, assignment, role = 'parent', forcedSubmission = null) {
  if (!assignment) return null;
  const submission = forcedSubmission || latestSubmission(db, assignment.id);
  return {
    id: Number(assignment.id),
    set_id: Number(assignment.set_id),
    student_id: Number(assignment.student_id),
    stage: Number(assignment.stage),
    status: assignment.status,
    title: assignment.title,
    difficulty: Number(assignment.difficulty),
    question: serializeQuestion(assignment, role),
    submission: serializeSubmission(db, submission, role),
    correction_note: assignment.status === 'reviewed_wrong'
      ? latestCorrectionNote(db, assignment.id)
      : '',
    ...(role === 'teacher' ? {
      student_name: assignment.student_name,
      class_name: assignment.class_name || '',
      cycle_start: assignment.cycle_start,
      cycle_end: assignment.cycle_end,
      set_title: assignment.set_title,
    } : {}),
  };
}

function posterReady(db, studentId, setId) {
  return Number(db.get(`SELECT COUNT(*) count FROM weekend_mastery_assignments
    WHERE student_id=? AND set_id=? AND status='passed'`, [studentId, setId])?.count || 0) === 2;
}

function gateForState({ available, eligible, cycle, stageOne, stageTwo, studentId }) {
  const base = {
    available: Boolean(available),
    active: Boolean(cycle.gate_active),
    allowed: true,
    required: false,
    reason: available ? 'outside_window' : (eligible ? 'content_unavailable' : 'grade_not_eligible'),
    target: `/pages/weekend-mastery/index?student_id=${Number(studentId)}`,
    starts_at: cycle.gate_starts_at,
    ends_at: cycle.gate_ends_at,
  };
  if (!available || !eligible || !cycle.gate_active) return base;
  if (stageOne?.status !== 'passed') {
    return { ...base, allowed: false, required: true, reason: 'stage1_not_passed' };
  }
  if (!stageTwo || !['submitted', 'passed'].includes(stageTwo.status)) {
    return {
      ...base,
      allowed: false,
      required: true,
      reason: stageTwo?.status === 'reviewed_wrong' ? 'stage2_correction_required' : 'stage2_not_submitted',
    };
  }
  return { ...base, reason: stageTwo.status === 'passed' ? 'completed' : 'stage2_pending_review' };
}

function currentState(db, { studentId, now = currentTime() }) {
  const cycle = weekendCycleAt(now);
  const student = studentRow(db, studentId);
  if (!student) throw new WeekendMasteryError('学生不存在', 'WEEKEND_MASTERY_STUDENT_NOT_FOUND', 404);
  const eligible = isGradeSeven(student);
  const set = eligible ? publishedSet(db, cycle.cycle_start) : null;
  const available = Boolean(set);
  const assignments = set ? assignmentsForSet(db, student.id, set.id) : [];
  const byStage = new Map(assignments.map((item) => [Number(item.stage), item]));
  const stageOne = byStage.get(1) || null;
  const stageTwo = byStage.get(2) || null;
  // stages 只包含已经领取的关卡，并直接使用 assignment 形状。
  // 前端据此区分“尚未开始”“第一关通过、等待点击难度升级”和“第二关进行中”。
  const stages = assignments.map((assignment) => serializeAssignment(db, assignment, 'parent'));
  const currentAssignment = stageOne && stageOne.status !== 'passed'
    ? stageOne
    : stageTwo && stageTwo.status !== 'passed' ? stageTwo : null;
  const gate = gateForState({ available, eligible, cycle, stageOne, stageTwo, studentId: student.id });
  return {
    available,
    eligible,
    cycle_start: cycle.cycle_start,
    cycle_end: cycle.cycle_end,
    set: set ? {
      id: Number(set.id),
      stable_code: set.stable_code,
      title: set.title,
      topic_key: set.topic_key,
    } : null,
    student_name: student.name,
    stages,
    current_assignment: serializeAssignment(db, currentAssignment, 'parent'),
    poster_ready: Boolean(set && posterReady(db, student.id, set.id)),
    next_cycle_start: nextPublishedCycle(db, cycle.cycle_start),
    gate,
  };
}

function terminalGateState(db, { studentId, now = currentTime() }) {
  return currentState(db, { studentId, now }).gate;
}

function requireCurrentSet(db, studentId, now = currentTime()) {
  const state = currentState(db, { studentId, now });
  if (!state.eligible) throw new WeekendMasteryError('周末攻坚战当前只开放七年级', 'WEEKEND_MASTERY_GRADE_UNAVAILABLE', 409);
  if (!state.available) throw new WeekendMasteryError('本周期攻坚题暂未发布', 'WEEKEND_MASTERY_CONTENT_UNAVAILABLE', 404);
  return state;
}

function createFirstAssignment(db, { studentId, now = currentTime() }) {
  const state = requireCurrentSet(db, studentId, now);
  const question = db.get('SELECT * FROM weekend_mastery_questions WHERE set_id=? AND stage=1', [state.set.id]);
  if (!question) throw new WeekendMasteryError('第一关题目缺失', 'WEEKEND_MASTERY_CONTENT_INVALID', 503);
  return db.transaction(() => {
    db.run(`INSERT OR IGNORE INTO weekend_mastery_assignments(set_id,question_id,student_id,stage,status)
      VALUES(?,?,?,1,'active')`, [state.set.id, question.id, studentId]);
    const row = db.get(`SELECT id FROM weekend_mastery_assignments
      WHERE student_id=? AND set_id=? AND stage=1`, [studentId, state.set.id]);
    return serializeAssignment(db, assignmentRow(db, row.id), 'parent');
  });
}

function ensureCurrentAssignment(db, assignment, studentId, now = currentTime()) {
  if (!assignment || Number(assignment.student_id) !== Number(studentId)) {
    throw new WeekendMasteryError('攻坚任务不存在', 'WEEKEND_MASTERY_ASSIGNMENT_NOT_FOUND', 404);
  }
  const state = requireCurrentSet(db, studentId, now);
  if (Number(assignment.set_id) !== Number(state.set.id)) {
    throw new WeekendMasteryError('本周题组已更新，请返回刷新', 'WEEKEND_MASTERY_CYCLE_CHANGED', 409);
  }
  return state;
}

function advanceAssignment(db, { assignmentId, studentId, now = currentTime() }) {
  const first = assignmentRow(db, assignmentId);
  const state = ensureCurrentAssignment(db, first, studentId, now);
  if (Number(first.stage) !== 1 || first.status !== 'passed') {
    throw new WeekendMasteryError('第一关批改正确后才能难度升级', 'WEEKEND_MASTERY_STAGE_ONE_REQUIRED', 409);
  }
  const question = db.get('SELECT * FROM weekend_mastery_questions WHERE set_id=? AND stage=2', [state.set.id]);
  if (!question) throw new WeekendMasteryError('第二关题目缺失', 'WEEKEND_MASTERY_CONTENT_INVALID', 503);
  return db.transaction(() => {
    db.run(`INSERT OR IGNORE INTO weekend_mastery_assignments(set_id,question_id,student_id,stage,status)
      VALUES(?,?,?,2,'active')`, [state.set.id, question.id, studentId]);
    const row = db.get(`SELECT id FROM weekend_mastery_assignments
      WHERE student_id=? AND set_id=? AND stage=2`, [studentId, state.set.id]);
    return serializeAssignment(db, assignmentRow(db, row.id), 'parent');
  });
}

function draftSubmission(db, { assignmentId, studentId, parentId, now = currentTime() }) {
  const assignment = assignmentRow(db, assignmentId);
  ensureCurrentAssignment(db, assignment, studentId, now);
  if (!['active', 'reviewed_wrong'].includes(assignment.status)) {
    throw new WeekendMasteryError('当前关卡不能继续上传', 'WEEKEND_MASTERY_UPLOAD_CLOSED', 409);
  }
  let submission = latestSubmission(db, assignment.id);
  if (submission?.status === 'draft') {
    if (Number(submission.parent_id) !== Number(parentId)) {
      throw new WeekendMasteryError('本次作答已由另一位绑定家长开始', 'WEEKEND_MASTERY_PARENT_CONFLICT', 403);
    }
    return { assignment, submission };
  }
  if (submission?.status === 'submitted') {
    throw new WeekendMasteryError('作答已提交，请等待老师批改', 'WEEKEND_MASTERY_ALREADY_SUBMITTED', 409);
  }
  const attemptNo = Number(submission?.attempt_no || 0) + 1;
  const created = db.run(`INSERT INTO weekend_mastery_submissions
    (assignment_id,parent_id,attempt_no,status,submitted_at) VALUES(?,?,?,'draft',NULL)`, [
    assignment.id, parentId, attemptNo,
  ]);
  submission = db.get('SELECT * FROM weekend_mastery_submissions WHERE id=?', [created.lastInsertRowid]);
  return { assignment, submission };
}

function submitAssignment(db, { assignmentId, studentId, parentId, studentNote, now = currentTime() }) {
  return db.transaction(() => {
    const assignment = assignmentRow(db, assignmentId);
    ensureCurrentAssignment(db, assignment, studentId, now);
    const submission = latestSubmission(db, assignment.id);
    if (assignment.status === 'submitted' && submission?.status === 'submitted') {
      if (Number(submission.parent_id) !== Number(parentId)) {
        throw new WeekendMasteryError('本次作答已由另一位绑定家长提交', 'WEEKEND_MASTERY_PARENT_CONFLICT', 403);
      }
      return { idempotent: true, assignment: serializeAssignment(db, assignment, 'parent') };
    }
    if (!['active', 'reviewed_wrong'].includes(assignment.status) || !submission || submission.status !== 'draft') {
      throw new WeekendMasteryError('请先上传本次解题照片', 'WEEKEND_MASTERY_PHOTO_REQUIRED', 400);
    }
    if (Number(submission.parent_id) !== Number(parentId)) {
      throw new WeekendMasteryError('本次作答已由另一位绑定家长开始', 'WEEKEND_MASTERY_PARENT_CONFLICT', 403);
    }
    const photoCount = Number(db.get(`SELECT COUNT(*) count FROM weekend_mastery_attachments
      WHERE submission_id=?`, [submission.id])?.count || 0);
    if (photoCount < 1) throw new WeekendMasteryError('请至少上传 1 张解题照片', 'WEEKEND_MASTERY_PHOTO_REQUIRED', 400);
    db.run(`UPDATE weekend_mastery_submissions SET status='submitted',student_note=?,submitted_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`, [cleanText(studentNote, 500), submission.id]);
    db.run(`UPDATE weekend_mastery_assignments SET status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [assignment.id]);
    return { idempotent: false, assignment: serializeAssignment(db, assignmentRow(db, assignment.id), 'parent') };
  });
}

function teacherQueue(db, { teacherId, status = 'submitted', limit = 100 }) {
  const normalizedStatus = ['submitted', 'reviewed', 'all'].includes(status) ? status : 'submitted';
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 100));
  const clause = normalizedStatus === 'all'
    ? " AND sub.status IN ('submitted','reviewed')"
    : ' AND sub.status=?';
  const params = normalizedStatus === 'all' ? [teacherId] : [teacherId, normalizedStatus];
  const where = `s.deleted_at IS NULL AND CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?${clause}`;
  const count = Number(db.get(`SELECT COUNT(*) count FROM weekend_mastery_submissions sub
    JOIN weekend_mastery_assignments a ON a.id=sub.assignment_id
    JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE ${where}`, params)?.count || 0);
  const rows = db.all(`SELECT sub.id FROM weekend_mastery_submissions sub
    JOIN weekend_mastery_assignments a ON a.id=sub.assignment_id
    JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE ${where}
    ORDER BY CASE sub.status WHEN 'submitted' THEN 0 ELSE 1 END,COALESCE(sub.submitted_at,sub.created_at),sub.id LIMIT ?`, [
    ...params, safeLimit,
  ]);
  const submissions = rows.map(({ id }) => {
    const submission = db.get('SELECT * FROM weekend_mastery_submissions WHERE id=?', [id]);
    const assignment = assignmentRow(db, submission.assignment_id);
    return serializeAssignment(db, assignment, 'teacher', submission);
  });
  return { count, todos: submissions, submissions };
}

function reviewSubmission(db, { teacherId, submissionId, isCorrect, teacherNote }) {
  return db.transaction(() => {
    const submission = db.get('SELECT * FROM weekend_mastery_submissions WHERE id=?', [submissionId]);
    const assignment = submission ? assignmentRow(db, submission.assignment_id) : null;
    if (!submission || !assignment || Number(assignment.teacher_id) !== Number(teacherId)) {
      throw new WeekendMasteryError('提交不存在', 'WEEKEND_MASTERY_SUBMISSION_NOT_FOUND', 404);
    }
    const latest = latestSubmission(db, assignment.id);
    if (Number(latest?.id) !== Number(submission.id)) {
      throw new WeekendMasteryError('只能批改学生最新一次提交', 'WEEKEND_MASTERY_STALE_SUBMISSION', 409);
    }
    const correct = Boolean(isCorrect);
    if (submission.status === 'reviewed') {
      if (Boolean(submission.is_correct) !== correct) {
        throw new WeekendMasteryError('已批改结果不可反向覆盖', 'WEEKEND_MASTERY_REVIEW_FINAL', 409);
      }
      return {
        idempotent: true,
        assignment_id: Number(assignment.id),
        is_correct: correct,
        poster_ready: posterReady(db, assignment.student_id, assignment.set_id),
      };
    }
    if (submission.status !== 'submitted' || assignment.status !== 'submitted') {
      throw new WeekendMasteryError('该作答尚未正式提交', 'WEEKEND_MASTERY_NOT_SUBMITTED', 409);
    }
    db.run(`UPDATE weekend_mastery_submissions SET status='reviewed',is_correct=?,teacher_note=?,reviewed_by=?,
      reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
      correct ? 1 : 0, cleanText(teacherNote, 500), teacherId, submission.id,
    ]);
    db.run(`UPDATE weekend_mastery_assignments SET status=?,passed_at=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,
      updated_at=CURRENT_TIMESTAMP WHERE id=?`, [correct ? 'passed' : 'reviewed_wrong', correct ? 1 : 0, assignment.id]);
    return {
      idempotent: false,
      assignment_id: Number(assignment.id),
      stage: Number(assignment.stage),
      is_correct: correct,
      poster_ready: posterReady(db, assignment.student_id, assignment.set_id),
    };
  });
}

module.exports = {
  WeekendMasteryError,
  advanceAssignment,
  assignmentRow,
  createFirstAssignment,
  currentState,
  currentTime,
  dateOffset,
  draftSubmission,
  latestSubmission,
  normalizeManifest,
  posterReady,
  resetNowProviderForTests,
  reviewSubmission,
  seedWeekendMastery,
  serializeAssignment,
  setNowProviderForTests,
  shanghaiLogicalDate,
  submitAssignment,
  teacherQueue,
  terminalGateState,
  weekendCycleAt,
};
