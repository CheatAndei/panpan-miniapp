const express = require('express');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { decodePrivateImage, storePrivateFile, removePrivateFile } = require('../utils/private-files');
const {
  WeekendMasteryError,
  advanceAssignment,
  assignmentRow,
  createFirstAssignment,
  currentState,
  draftSubmission,
  markMasteryBroadcastRead,
  masteryBroadcasts,
  reviewSubmission,
  serializeAssignment,
  submitAssignment,
  teacherQueue,
  terminalGateState,
} = require('../services/weekend-mastery');
const { recordWeekendMasteryPass, serializeEvent } = require('../services/promotions');

const router = express.Router();

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '仅家长可操作' });
  return next();
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可操作' });
  return next();
}

function boundStudent(db, parentId, rawStudentId) {
  const studentId = Number(rawStudentId);
  return Number.isInteger(studentId) && studentId > 0 && parentBoundStudent(db, parentId, studentId)
    ? studentId : 0;
}

function parentAssignment(db, req, assignmentId) {
  const assignment = assignmentRow(db, Number(assignmentId));
  if (!assignment || !boundStudent(db, req.user.id, assignment.student_id)) return null;
  return assignment;
}

function sendError(res, error, fallback = '操作失败') {
  const status = Number(error?.statusCode) || (error instanceof WeekendMasteryError ? 400 : 500);
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code || 'WEEKEND_MASTERY_ERROR',
  });
}

router.get('/current', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权查看该学生的周末攻坚战' });
  try { return res.json(currentState(db, { studentId })); }
  catch (error) { return sendError(res, error, '攻坚战加载失败'); }
});

router.get('/gate', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.query.student_id);
  if (!studentId) return res.status(403).json({ error: '无权查看该学生的挑战门禁' });
  try { return res.json({ gate: terminalGateState(db, { studentId }) }); }
  catch (error) { return sendError(res, error, '挑战门禁加载失败'); }
});

router.get('/broadcasts', auth, (req, res) => {
  try {
    const broadcasts = masteryBroadcasts(getDB(), {
      userId: req.user.id,
      limit: req.query.limit,
    });
    return res.json({ count: broadcasts.length, broadcasts });
  } catch (error) {
    return sendError(res, error, '全服捷报加载失败');
  }
});

router.post('/broadcasts/:assignmentId/read', auth, (req, res) => {
  try {
    const result = markMasteryBroadcastRead(getDB(), {
      userId: req.user.id,
      assignmentId: req.params.assignmentId,
    });
    return res.json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error, '捷报状态保存失败');
  }
});

router.post('/assignments', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = boundStudent(db, req.user.id, req.body?.student_id);
  if (!studentId) return res.status(403).json({ error: '无权为该学生开始周末攻坚战' });
  try {
    const assignment = createFirstAssignment(db, { studentId });
    return res.status(201).json({ assignment, state: currentState(db, { studentId }) });
  } catch (error) {
    return sendError(res, error, '第一关领取失败');
  }
});

router.post('/assignments/:id/advance', auth, parentOnly, (req, res) => {
  const db = getDB();
  const first = parentAssignment(db, req, req.params.id);
  if (!first) return res.status(404).json({ error: '攻坚任务不存在' });
  try {
    const assignment = advanceAssignment(db, {
      assignmentId: first.id,
      studentId: first.student_id,
    });
    return res.status(201).json({ assignment, state: currentState(db, { studentId: first.student_id }) });
  } catch (error) {
    return sendError(res, error, '难度升级失败');
  }
});

router.post('/assignments/:id/upload', auth, parentOnly, async (req, res) => {
  const db = getDB();
  const assignment = parentAssignment(db, req, req.params.id);
  if (!assignment) return res.status(404).json({ error: '攻坚任务不存在' });
  const uploadCompleteValue = req.query?.upload_complete ?? req.body?.upload_complete;
  const uploadComplete = uploadCompleteValue === undefined
    || !['0', 'false'].includes(String(uploadCompleteValue).toLowerCase());
  let decoded;
  try { decoded = await decodePrivateImage(req.body?.base64); }
  catch (error) { return res.status(400).json({ error: error.message, code: 'WEEKEND_MASTERY_IMAGE_INVALID' }); }
  let stored;
  try {
    const result = db.transaction(() => {
      const draft = draftSubmission(db, {
        assignmentId: assignment.id,
        studentId: assignment.student_id,
        parentId: req.user.id,
      });
      const duplicate = db.get(`SELECT a.id,f.token FROM weekend_mastery_attachments a
        JOIN private_files f ON f.id=a.file_id WHERE a.submission_id=? AND a.sha256=?`, [
        draft.submission.id, decoded.sha256,
      ]);
      if (duplicate) {
        if (uploadComplete) {
          db.run(`UPDATE weekend_mastery_submissions SET status='submitted',submitted_at=COALESCE(submitted_at,CURRENT_TIMESTAMP),
            updated_at=CURRENT_TIMESTAMP WHERE id=?`, [draft.submission.id]);
          db.run(`UPDATE weekend_mastery_assignments SET status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [assignment.id]);
        }
        return { duplicate, submissionId: draft.submission.id };
      }
      const count = Number(db.get(`SELECT COUNT(*) count FROM weekend_mastery_attachments
        WHERE submission_id=?`, [draft.submission.id])?.count || 0);
      if (count >= 4) throw new WeekendMasteryError('每次提交最多上传 4 张图片', 'WEEKEND_MASTERY_TOO_MANY_PHOTOS', 400);
      stored = storePrivateFile(db, {
        ...decoded,
        studentId: assignment.student_id,
        purpose: 'weekend_mastery_photo',
        ownerType: 'weekend_mastery_submission',
        ownerId: draft.submission.id,
        createdBy: req.user.id,
        originalName: req.body?.fileName || 'weekend-mastery-photo',
      });
      const attachment = db.run(`INSERT INTO weekend_mastery_attachments(submission_id,file_id,sha256)
        VALUES(?,?,?)`, [draft.submission.id, stored.id, decoded.sha256]);
      if (uploadComplete) {
        db.run(`UPDATE weekend_mastery_submissions SET status='submitted',submitted_at=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP WHERE id=?`, [draft.submission.id]);
        db.run(`UPDATE weekend_mastery_assignments SET status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?`, [assignment.id]);
      }
      return { attachmentId: attachment.lastInsertRowid, submissionId: draft.submission.id };
    });
    const refreshed = serializeAssignment(db, assignmentRow(db, assignment.id), 'parent');
    if (result.duplicate) {
      return res.json({
        ok: true,
        idempotent: true,
        upload_complete: uploadComplete,
        attachment: { ...result.duplicate, url: `/api/private-files/${result.duplicate.token}` },
        assignment: refreshed,
      });
    }
    return res.status(201).json({
      ok: true,
      upload_complete: uploadComplete,
      submission_id: result.submissionId,
      attachment: { id: result.attachmentId, token: stored.token, url: `/api/private-files/${stored.token}` },
      assignment: refreshed,
    });
  } catch (error) {
    if (stored) removePrivateFile(db, { id: stored.id, storage_key: stored.storageKey });
    return sendError(res, error, '图片保存失败');
  }
});

router.post('/assignments/:id/submit', auth, parentOnly, (req, res) => {
  const db = getDB();
  const assignment = parentAssignment(db, req, req.params.id);
  if (!assignment) return res.status(404).json({ error: '攻坚任务不存在' });
  try {
    const result = submitAssignment(db, {
      assignmentId: assignment.id,
      studentId: assignment.student_id,
      parentId: req.user.id,
      studentNote: req.body?.student_note,
    });
    return res.json({
      ok: true,
      idempotent: result.idempotent,
      assignment: result.assignment,
      state: currentState(db, { studentId: assignment.student_id }),
    });
  } catch (error) {
    return sendError(res, error, '作答提交失败');
  }
});

router.get('/teacher/submissions', auth, teacherOnly, (req, res) => {
  const status = String(req.query.status || 'submitted');
  if (!['submitted', 'reviewed', 'all'].includes(status)) {
    return res.status(400).json({ error: '提交状态无效' });
  }
  try {
    return res.json(teacherQueue(getDB(), {
      teacherId: req.user.id,
      status,
      limit: req.query.limit,
    }));
  } catch (error) {
    return sendError(res, error, '批阅队列加载失败');
  }
});

router.put('/teacher/submissions/:id/review', auth, teacherOnly, (req, res) => {
  if (![true, false, 0, 1].includes(req.body?.is_correct)) {
    return res.status(400).json({ error: '请选择批改结果' });
  }
  try {
    const db = getDB();
    const result = reviewSubmission(db, {
      teacherId: req.user.id,
      submissionId: Number(req.params.id),
      isCorrect: Boolean(req.body.is_correct),
      teacherNote: req.body?.teacher_note,
    });
    const event = result.poster_ready && result.stage === 2 && result.is_correct && !result.idempotent
      ? recordWeekendMasteryPass(db, { assignmentId:result.assignment_id })
      : null;
    return res.json({ ok: true, ...result, promotion:event?serializeEvent(event):null });
  } catch (error) {
    return sendError(res, error, '批改保存失败');
  }
});

module.exports = router;
