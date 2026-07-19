const express = require('express');
const fs = require('fs');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { decodePrivateImage, storePrivateFile, removePrivateFile } = require('../utils/private-files');
const { resolveExamPath } = require('../utils/exam-files');
const { weekStartKey } = require('../services/learning');

const router = express.Router();
const TYPES = new Set(['fill', 'subjective']);

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '仅家长可操作' });
  next();
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可操作' });
  next();
}

function boundStudent(db, parentId, rawStudentId) {
  const studentId = Number(rawStudentId);
  return Number.isInteger(studentId) && studentId > 0 && parentBoundStudent(db, parentId, studentId) ? studentId : 0;
}

function ownsStudent(db, teacherId, studentId) {
  return Boolean(db.get(`SELECT s.id FROM students s
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=? AND CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?`, [studentId, teacherId]));
}

function fileUrl(token) {
  return token ? `/api/private-files/${token}` : null;
}

function serializeAssignment(db, assignment, role) {
  if (!assignment) return null;
  const submission = db.get('SELECT * FROM weekly_challenge_submissions WHERE assignment_id=?', [assignment.id]);
  const attachments = submission ? db.all(`SELECT a.id,f.token,f.mime_type,f.byte_size
    FROM weekly_challenge_attachments a JOIN private_files f ON f.id=a.file_id
    WHERE a.submission_id=? ORDER BY a.created_at`, [submission.id])
    .map((item) => ({ ...item, url: fileUrl(item.token) })) : [];
  const answerAssetId = role === 'teacher' ? assignment.answer_asset_id : null;
  return {
    id: Number(assignment.id),
    student_id: Number(assignment.student_id),
    student_name: assignment.student_name,
    class_name: assignment.class_name,
    week_start: assignment.week_start,
    question_type: assignment.question_type,
    title: assignment.title,
    source_label: assignment.source_label || '',
    question_url: `/api/weekly-challenge/assets/${assignment.question_asset_id}`,
    answer_url: answerAssetId ? `/api/weekly-challenge/assets/${answerAssetId}` : null,
    answer_text: role === 'teacher' ? assignment.answer_text : undefined,
    submission: submission ? { ...submission, attachments } : null,
  };
}

function assignmentRow(db, assignmentId) {
  return db.get(`SELECT a.*,q.title,q.question_asset_id,q.answer_asset_id,q.answer_text,q.source_label,
    s.name student_name,c.name class_name,CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id
    FROM weekly_challenge_assignments a JOIN weekly_challenge_questions q ON q.id=a.question_id
    JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL WHERE a.id=?`, [assignmentId]);
}

router.get('/current', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权查看该学生的挑战' });
  const weekStart = weekStartKey();
  const row = db.get(`SELECT a.*,q.title,q.question_asset_id,q.answer_asset_id,q.answer_text,q.source_label
    FROM weekly_challenge_assignments a JOIN weekly_challenge_questions q ON q.id=a.question_id
    WHERE a.student_id=? AND a.week_start=?`, [studentId, weekStart]);
  const counts = db.all(`SELECT question_type,COUNT(*) count FROM weekly_challenge_questions
    WHERE is_active=1 AND question_type IN ('fill','subjective') GROUP BY question_type`);
  res.json({ week_start: weekStart, assignment: serializeAssignment(db, row, 'parent'), available: Object.fromEntries(counts.map((item) => [item.question_type, Number(item.count)])) });
});

router.post('/assignments', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  const questionType = String(req.body?.question_type || '');
  if (!studentId) return res.status(403).json({ error: '无权为该学生领取挑战' });
  if (!TYPES.has(questionType)) return res.status(400).json({ error: '压轴挑战只可选择填空题或解答题' });
  const weekStart = weekStartKey();
  let existing = db.get('SELECT id FROM weekly_challenge_assignments WHERE student_id=? AND week_start=?', [studentId, weekStart]);
  if (!existing) {
    const questions = db.all(`SELECT id FROM weekly_challenge_questions WHERE question_type=? AND is_active=1 ORDER BY id`, [questionType]);
    if (!questions.length) return res.status(503).json({ error: '该题型本周题目正在整理，请稍后再试' });
    const seed = [...`${studentId}-${weekStart}-${questionType}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
    const question = questions[seed % questions.length];
    const created = db.run(`INSERT INTO weekly_challenge_assignments(student_id,question_id,week_start,question_type)
      VALUES(?,?,?,?)`, [studentId, question.id, weekStart, questionType]);
    existing = { id: created.lastInsertRowid };
  }
  res.status(201).json({ assignment: serializeAssignment(db, assignmentRow(db, existing.id), 'parent') });
});

router.post('/assignments/:id/upload', auth, parentOnly, async (req, res) => {
  const db = getDB();
  const assignment = assignmentRow(db, Number(req.params.id));
  if (!assignment || !boundStudent(db, req.user.id, assignment.student_id)) return res.status(404).json({ error: '挑战不存在' });
  let decoded;
  try { decoded = await decodePrivateImage(req.body?.base64); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  let stored;
  let result;
  try {
    result = db.transaction(() => {
      let submission = db.get('SELECT * FROM weekly_challenge_submissions WHERE assignment_id=?', [assignment.id]);
      if (!submission) {
        const created = db.run('INSERT INTO weekly_challenge_submissions(assignment_id,parent_id) VALUES(?,?)', [assignment.id, req.user.id]);
        submission = db.get('SELECT * FROM weekly_challenge_submissions WHERE id=?', [created.lastInsertRowid]);
      }
      if (Number(submission.parent_id) !== Number(req.user.id)) return { wrongParent: true };
      const duplicate = db.get(`SELECT a.id,f.token FROM weekly_challenge_attachments a JOIN private_files f ON f.id=a.file_id
        WHERE a.submission_id=? AND a.sha256=?`, [submission.id, decoded.sha256]);
      if (duplicate) return { duplicate };
      const count = Number(db.get('SELECT COUNT(*) count FROM weekly_challenge_attachments WHERE submission_id=?', [submission.id])?.count || 0);
      if (count >= 4) return { tooMany: true };
      stored = storePrivateFile(db, {
        ...decoded, studentId: assignment.student_id, purpose: 'weekly_challenge_photo',
        ownerType: 'weekly_challenge_submission', ownerId: submission.id, createdBy: req.user.id,
        originalName: req.body?.fileName || 'weekly-challenge-photo',
      });
      const attachment = db.run(`INSERT INTO weekly_challenge_attachments(submission_id,file_id,sha256) VALUES(?,?,?)`, [submission.id, stored.id, decoded.sha256]);
      db.run(`UPDATE weekly_challenge_submissions SET status='submitted',submitted_at=CURRENT_TIMESTAMP,
        reviewed_by=NULL,reviewed_at=NULL,is_correct=NULL WHERE id=?`, [submission.id]);
      return { attachmentId: attachment.lastInsertRowid };
    });
  } catch {
    if (stored) removePrivateFile(db, { id: stored.id, storage_key: stored.storageKey });
    return res.status(500).json({ error: '图片保存失败' });
  }
  if (result.wrongParent) return res.status(403).json({ error: '该挑战已由另一位绑定家长提交' });
  if (result.tooMany) return res.status(400).json({ error: '每次挑战最多上传 4 张图片' });
  if (result.duplicate) return res.json({ ok: true, idempotent: true, attachment: { ...result.duplicate, url: fileUrl(result.duplicate.token) } });
  res.status(201).json({ ok: true, attachment: { id: result.attachmentId, token: stored.token, url: fileUrl(stored.token) } });
});

router.get('/teacher/submissions', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const status = String(req.query.status || 'submitted');
  if (!['submitted', 'reviewed', 'all'].includes(status)) return res.status(400).json({ error: '提交状态无效' });
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit || '100', 10) || 100));
  const clause = status === 'all' ? '' : ' AND sub.status=?';
  const params = status === 'all' ? [req.user.id] : [req.user.id, status];
  const total = Number(db.get(`SELECT COUNT(*) count FROM weekly_challenge_submissions sub
    JOIN weekly_challenge_assignments a ON a.id=sub.assignment_id
    JOIN students s ON s.id=a.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?${clause}`, params)?.count || 0);
  const rows = db.all(`SELECT a.id FROM weekly_challenge_submissions sub
    JOIN weekly_challenge_assignments a ON a.id=sub.assignment_id
    JOIN students s ON s.id=a.student_id
    LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?${clause}
    ORDER BY CASE sub.status WHEN 'submitted' THEN 0 ELSE 1 END,sub.submitted_at ASC,sub.id ASC LIMIT ?`, [...params, limit]);
  const submissions = rows.map((item) => serializeAssignment(db, assignmentRow(db, item.id), 'teacher'));
  res.json({ count: total, todos: submissions, submissions });
});

router.put('/teacher/submissions/:id/review', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const submission = db.get(`SELECT sub.*,a.student_id FROM weekly_challenge_submissions sub
    JOIN weekly_challenge_assignments a ON a.id=sub.assignment_id WHERE sub.id=?`, [Number(req.params.id)]);
  if (!submission || !ownsStudent(db, req.user.id, submission.student_id)) return res.status(404).json({ error: '提交不存在' });
  if (![true, false, 0, 1].includes(req.body?.is_correct)) return res.status(400).json({ error: '请选择批改结果' });
  db.run(`UPDATE weekly_challenge_submissions SET status='reviewed',is_correct=?,teacher_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP
    WHERE id=?`, [req.body.is_correct ? 1 : 0, String(req.body?.teacher_note || '').trim().slice(0, 500), req.user.id, submission.id]);
  res.json({ ok: true });
});

router.get('/assets/:assetId', auth, (req, res) => {
  const db = getDB();
  const asset = db.get('SELECT * FROM exam_assets WHERE id=?', [Number(req.params.assetId)]);
  if (!asset) return res.status(404).json({ error: '图片不存在' });
  if (req.user.role === 'parent') {
    const allowed = db.get(`SELECT a.id FROM weekly_challenge_assignments a JOIN weekly_challenge_questions q ON q.id=a.question_id
      JOIN bindings b ON b.student_id=a.student_id WHERE b.parent_id=? AND a.week_start=? AND q.question_asset_id=?`, [req.user.id, weekStartKey(), asset.id]);
    if (!allowed) return res.status(404).json({ error: '图片不存在' });
  } else if (req.user.role === 'teacher') {
    const allowed = db.get(`SELECT a.id FROM weekly_challenge_assignments a
      JOIN weekly_challenge_questions q ON q.id=a.question_id
      JOIN students s ON s.id=a.student_id
      LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
      WHERE (q.question_asset_id=? OR q.answer_asset_id=?)
        AND CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?
      LIMIT 1`, [asset.id, asset.id, req.user.id]);
    if (!allowed) return res.status(404).json({ error: '图片不存在' });
  } else return res.status(403).json({ error: '无权查看图片' });
  const fullPath = resolveExamPath(asset.storage_key);
  if (!fullPath || !fs.existsSync(fullPath)) return res.status(404).json({ error: '图片暂未同步到服务器' });
  res.set({ 'Content-Type': asset.mime_type, 'Content-Length': String(asset.byte_size), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(fullPath).pipe(res);
});

module.exports = router;
