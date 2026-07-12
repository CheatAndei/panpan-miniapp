const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const { JWT_SECRET } = require('../config');
const { teacherOwnsStudent, parentBoundStudent } = require('../utils/scope');

const router = express.Router();

function auth(req, res, next) {
  try {
    req.user = jwt.verify((req.headers.authorization || '').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: '登录过期' });
  }
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  next();
}

function json(value, fallback = []) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function finiteConfidence(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function answerPayload(answer) {
  return {
    question_no: String(answer.question_no || '').trim(),
    question_image_url: String(answer.question_image_url || ''),
    student_answer: String(answer.student_answer || ''),
    is_correct: answer.is_correct === true || answer.is_correct === 1 ? 1 : 0,
    wrong_step: String(answer.wrong_step || ''),
    error_type: String(answer.error_type || ''),
    comment: String(answer.comment || ''),
    confidence: finiteConfidence(answer.confidence),
    teacher_status: String(answer.teacher_status || 'confirmed'),
    teacher_note: String(answer.teacher_note || '')
  };
}

function validateBatch(db, teacherId, body) {
  const errors = [];
  const submissions = Array.isArray(body.submissions) ? body.submissions : [];
  if (!String(body.title || '').trim()) errors.push('缺少作业标题');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.assigned_date || ''))) errors.push('作业日期格式应为 YYYY-MM-DD');
  if (!String(body.idempotency_key || '').trim()) errors.push('缺少幂等键');
  if (submissions.length === 0) errors.push('没有学生作业');
  const seen = new Set();
  for (const submission of submissions) {
    const studentId = Number(submission.student_id);
    if (!teacherOwnsStudent(db, teacherId, studentId)) errors.push(`学生 ${studentId || '?'} 不属于当前老师`);
    if (seen.has(studentId)) errors.push(`学生 ${studentId} 重复`);
    seen.add(studentId);
    const answers = Array.isArray(submission.answers) ? submission.answers : [];
    const points = Number(submission.points_delta || 0);
    if (!Number.isInteger(points) || points < -999 || points > 999) errors.push(`学生 ${studentId} 的积分变动无效`);
    if (answers.length === 0) errors.push(`学生 ${studentId} 没有题目`);
    const questionNumbers = new Set();
    for (const raw of answers) {
      const answer = answerPayload(raw);
      if (!answer.question_no) errors.push(`学生 ${studentId} 存在空题号`);
      if (questionNumbers.has(answer.question_no)) errors.push(`学生 ${studentId} 的题号 ${answer.question_no} 重复`);
      questionNumbers.add(answer.question_no);
      if (answer.teacher_status !== 'confirmed') errors.push(`学生 ${studentId} 的题目 ${answer.question_no} 尚未人工确认`);
      if (answer.confidence === null) errors.push(`学生 ${studentId} 的题目 ${answer.question_no} 置信度无效`);
    }
  }
  return { errors, submissions };
}

function logOperation(db, actorId, action, entityType, entityId, detail = {}) {
  db.run('INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?)', [
    actorId, action, entityType, entityId || null, JSON.stringify(detail)
  ]);
}

router.post('/preview', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const { errors, submissions } = validateBatch(db, req.user.id, req.body || {});
  const answerCount = submissions.reduce((sum, item) => sum + (Array.isArray(item.answers) ? item.answers.length : 0), 0);
  const wrongCount = submissions.reduce((sum, item) => sum + (Array.isArray(item.answers) ? item.answers.filter((a) => !a.is_correct).length : 0), 0);
  res.status(errors.length ? 400 : 200).json({ ok: errors.length === 0, errors, students: submissions.length, answers: answerCount, wrong: wrongCount });
});

router.post('/batches', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const body = req.body || {};
  const existing = db.get('SELECT id,status FROM homework_batches WHERE idempotency_key=? AND teacher_id=?', [body.idempotency_key, req.user.id]);
  if (existing) return res.json({ ok: true, batch_id: existing.id, status: existing.status, idempotent: true });
  const { errors, submissions } = validateBatch(db, req.user.id, body);
  if (errors.length) return res.status(400).json({ error: '批改数据校验失败', errors });

  const batch = db.run(`INSERT INTO homework_batches
    (teacher_id,title,subject,assigned_date,status,prompt_version,source_manifest,idempotency_key,confirmed_at)
    VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`, [
    req.user.id, String(body.title).trim(), String(body.subject || ''), body.assigned_date, 'reviewed',
    String(body.prompt_version || 'manual-chatgpt-v1'), JSON.stringify(body.source_manifest || {}), String(body.idempotency_key)
  ]);

  for (const rawSubmission of submissions) {
    const submission = db.run(`INSERT INTO homework_submissions
      (batch_id,student_id,original_image_urls,processed_image_urls,grading_status,overall_comment,points_delta)
      VALUES(?,?,?,?,?,?,?)`, [
      batch.lastInsertRowid, Number(rawSubmission.student_id), JSON.stringify(rawSubmission.original_image_urls || []),
      JSON.stringify(rawSubmission.processed_image_urls || []), 'confirmed', String(rawSubmission.overall_comment || ''),
      Math.max(-999, Math.min(999, Number(rawSubmission.points_delta || 0)))
    ]);
    for (const rawAnswer of rawSubmission.answers) {
      const answer = answerPayload(rawAnswer);
      db.run(`INSERT INTO homework_answers
        (submission_id,question_no,question_image_url,student_answer,is_correct,wrong_step,error_type,comment,confidence,teacher_status,teacher_note)
        VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [submission.lastInsertRowid, answer.question_no, answer.question_image_url,
        answer.student_answer, answer.is_correct, answer.wrong_step, answer.error_type, answer.comment,
        answer.confidence, answer.teacher_status, answer.teacher_note]);
    }
  }
  logOperation(db, req.user.id, 'homework_batch_created', 'homework_batch', batch.lastInsertRowid, { students: submissions.length });
  res.status(201).json({ ok: true, batch_id: batch.lastInsertRowid, status: 'reviewed' });
});

function batchSummary(db, batchId, teacherId) {
  const batch = db.get('SELECT * FROM homework_batches WHERE id=? AND teacher_id=?', [batchId, teacherId]);
  if (!batch) return null;
  const totals = db.get(`SELECT COUNT(DISTINCT s.id) students, COUNT(a.id) answers,
    SUM(CASE WHEN a.is_correct=0 THEN 1 ELSE 0 END) wrong,
    SUM(CASE WHEN a.teacher_status='confirmed' THEN 1 ELSE 0 END) confirmed
    FROM homework_submissions s LEFT JOIN homework_answers a ON a.submission_id=s.id WHERE s.batch_id=?`, [batchId]);
  return { ...batch, ...totals, confirmation: `确认发布 ${Number(totals.students || 0)} 名学生` };
}

router.get('/batches', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const batches = db.all(`SELECT b.*,
    (SELECT COUNT(*) FROM homework_submissions s WHERE s.batch_id=b.id) AS student_count
    FROM homework_batches b WHERE b.teacher_id=? ORDER BY b.created_at DESC LIMIT 50`, [req.user.id]);
  res.json({ batches });
});

router.get('/batches/:id', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const summary = batchSummary(db, req.params.id, req.user.id);
  if (!summary) return res.status(404).json({ error: '批次不存在' });
  const submissions = db.all(`SELECT s.*,st.name student_name,
    COALESCE((SELECT SUM(delta) FROM point_ledger p WHERE p.student_id=s.student_id),0) point_balance
    FROM homework_submissions s JOIN students st ON st.id=s.student_id WHERE s.batch_id=? ORDER BY st.name`, [req.params.id]);
  for (const submission of submissions) {
    submission.original_image_urls = json(submission.original_image_urls);
    submission.processed_image_urls = json(submission.processed_image_urls);
    submission.answers = db.all('SELECT * FROM homework_answers WHERE submission_id=? ORDER BY id', [submission.id]);
  }
  res.json({ batch: summary, submissions });
});

async function sendSubmissionNotification(db, submission, batch, parentId = null) {
  const parents = parentId
    ? db.all('SELECT id FROM users WHERE id=? AND openid IS NOT NULL AND openid!=\'\'', [parentId])
    : db.all(`SELECT u.id FROM users u JOIN bindings b ON b.parent_id=u.id
      WHERE b.student_id=? AND u.openid IS NOT NULL AND u.openid!=''`, [submission.student_id]);
  const notify = require('./notify');
  const result = { total: parents.length, sent: 0, failed: 0 };
  for (const parent of parents) {
    let record = db.get('SELECT * FROM push_records WHERE submission_id=? AND parent_id=?', [submission.id, parent.id]);
    if (record?.status === 'sent') { result.sent++; continue; }
    if (!record) {
      const created = db.run('INSERT INTO push_records(submission_id,parent_id,status,attempts) VALUES(?,?,?,0)', [submission.id, parent.id, 'pending']);
      record = { id: created.lastInsertRowid, attempts: 0 };
    }
    try {
      const sent = await notify.notifyHomeworkParent(parent.id, submission.student_id, batch.id, batch.title);
      const ok = !!sent.ok;
      db.run(`UPDATE push_records SET status=?,attempts=attempts+1,error=?,sent_at=${ok ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE id=?`, [
        ok ? 'sent' : 'failed', ok ? '' : String(sent.error || sent.errmsg || sent.errors?.join('; ') || '发送失败'), record.id
      ]);
      if (ok) result.sent++; else result.failed++;
    } catch (error) {
      db.run('UPDATE push_records SET status=?,attempts=attempts+1,error=? WHERE id=?', ['failed', String(error.message || error), record.id]);
      result.failed++;
    }
  }
  return result;
}

router.post('/batches/:id/publish', auth, teacherOnly, async (req, res) => {
  const db = getDB();
  const batch = batchSummary(db, req.params.id, req.user.id);
  if (!batch) return res.status(404).json({ error: '批次不存在' });
  if (batch.status === 'published') return res.json({ ok: true, batch_id: batch.id, status: 'published', idempotent: true });
  if (Number(batch.answers || 0) === 0 || Number(batch.confirmed || 0) !== Number(batch.answers || 0)) {
    return res.status(400).json({ error: '仍有题目未人工确认' });
  }
  if (String(req.body?.confirmation || '') !== batch.confirmation) {
    return res.status(400).json({ error: `请输入：${batch.confirmation}` });
  }

  const submissions = db.all('SELECT * FROM homework_submissions WHERE batch_id=?', [batch.id]);
  for (const submission of submissions) {
    const answers = db.all('SELECT * FROM homework_answers WHERE submission_id=?', [submission.id]);
    for (const answer of answers) {
      if (!answer.is_correct) {
        db.run('INSERT OR IGNORE INTO wrong_questions(student_id,answer_id,status) VALUES(?,?,?)', [submission.student_id, answer.id, 'open']);
      }
    }
    if (Number(submission.points_delta || 0) !== 0) {
      db.run('INSERT OR IGNORE INTO point_ledger(student_id,submission_id,delta,reason) VALUES(?,?,?,?)', [
        submission.student_id, submission.id, Number(submission.points_delta), `作业批改：${batch.title}`
      ]);
    }
    db.run('UPDATE homework_submissions SET grading_status=? WHERE id=?', ['published', submission.id]);
  }
  db.run('UPDATE homework_batches SET status=?,published_at=CURRENT_TIMESTAMP WHERE id=?', ['published', batch.id]);
  logOperation(db, req.user.id, 'homework_batch_published', 'homework_batch', batch.id, { students: submissions.length, notify: !!req.body?.send_notifications });

  const notifications = { requested: !!req.body?.send_notifications, total: 0, sent: 0, failed: 0 };
  if (req.body?.send_notifications === true) {
    for (const submission of submissions) {
      const part = await sendSubmissionNotification(db, submission, batch);
      notifications.total += part.total;
      notifications.sent += part.sent;
      notifications.failed += part.failed;
    }
  }
  res.json({ ok: true, batch_id: batch.id, status: 'published', notifications });
});

router.post('/push/:id/retry', auth, teacherOnly, async (req, res) => {
  const db = getDB();
  const record = db.get(`SELECT p.*,s.student_id,s.batch_id,b.teacher_id,b.title
    FROM push_records p JOIN homework_submissions s ON s.id=p.submission_id
    JOIN homework_batches b ON b.id=s.batch_id WHERE p.id=? AND b.teacher_id=?`, [req.params.id, req.user.id]);
  if (!record) return res.status(404).json({ error: '推送记录不存在' });
  if (String(req.body?.confirmation || '') !== '确认重试 1 条推送') return res.status(400).json({ error: '请输入：确认重试 1 条推送' });
  if (record.status === 'sent') return res.json({ ok: true, status: 'sent', idempotent: true });
  if (Number(record.attempts || 0) >= 5) return res.status(400).json({ error: '已达到最大重试次数' });
  const result = await sendSubmissionNotification(db, { id: record.submission_id, student_id: record.student_id }, { id: record.batch_id, title: record.title }, record.parent_id);
  logOperation(db, req.user.id, 'homework_push_retried', 'push_record', record.id, result);
  res.json({ ok: result.failed === 0, result });
});

router.get('/parent', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const studentId = Number(req.query.student_id);
  const db = getDB();
  if (!parentBoundStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生' });
  const batches = db.all(`SELECT b.id,b.title,b.subject,b.assigned_date,b.published_at,s.id submission_id,s.overall_comment,
    s.points_delta,(SELECT COUNT(*) FROM homework_answers a WHERE a.submission_id=s.id) question_count,
    (SELECT COUNT(*) FROM homework_answers a WHERE a.submission_id=s.id AND a.is_correct=1) correct_count
    FROM homework_batches b JOIN homework_submissions s ON s.batch_id=b.id
    WHERE s.student_id=? AND b.status='published' ORDER BY b.published_at DESC LIMIT 50`, [studentId]);
  const balance = db.get('SELECT COALESCE(SUM(delta),0) balance FROM point_ledger WHERE student_id=?', [studentId]);
  res.json({ batches, point_balance: Number(balance?.balance || 0) });
});

router.get('/parent/:batchId', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const studentId = Number(req.query.student_id);
  const db = getDB();
  if (!parentBoundStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权查看该学生' });
  const submission = db.get(`SELECT s.*,b.title,b.subject,b.assigned_date,b.published_at
    FROM homework_submissions s JOIN homework_batches b ON b.id=s.batch_id
    WHERE b.id=? AND s.student_id=? AND b.status='published'`, [req.params.batchId, studentId]);
  if (!submission) return res.status(404).json({ error: '作业不存在' });
  submission.original_image_urls = json(submission.original_image_urls);
  submission.processed_image_urls = json(submission.processed_image_urls);
  submission.answers = db.all(`SELECT question_no,question_image_url,student_answer,is_correct,wrong_step,error_type,comment,confidence
    FROM homework_answers WHERE submission_id=? AND teacher_status='confirmed' ORDER BY id`, [submission.id]);
  res.json({ submission });
});

module.exports = router;
