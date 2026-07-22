const express = require('express');
const crypto = require('node:crypto');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { teacherOwnsStudent, parentBoundStudent } = require('../utils/scope');
const { resolveTeacherStudentId } = require('../utils/student-identity');
const { decodePrivateImage, storePrivateFile, removePrivateFile } = require('../utils/private-files');

const router = express.Router();

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

function validDate(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
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

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function semanticBatchPayload(body) {
  const sourceManifest = { ...(body.source_manifest || {}) };
  delete sourceManifest.server_payload_digest;
  delete sourceManifest.client_payload_digest;
  return {
    class_id: Number(body.class_id || 0),
    title: String(body.title || ''),
    subject: String(body.subject || ''),
    assigned_date: String(body.assigned_date || ''),
    prompt_version: String(body.prompt_version || ''),
    source_manifest: sourceManifest,
    submissions: (Array.isArray(body.submissions) ? body.submissions : []).map((submission) => ({
      ...(submission.external_student_id
        ? { external_student_id: String(submission.external_student_id) }
        : { student_id: Number(submission.student_id) }),
      processed_image_sha256s: (submission.processed_image_sha256s || []).map(String),
      original_image_sha256s: (submission.original_image_sha256s || []).map(String),
      overall_comment: String(submission.overall_comment || ''),
      points_delta: Number(submission.points_delta || 0),
      answers: (Array.isArray(submission.answers) ? submission.answers : []).map((answer) => ({
        question_no: String(answer.question_no || ''),
        student_answer: String(answer.student_answer || ''),
        is_correct: !!answer.is_correct,
        wrong_step: String(answer.wrong_step || ''),
        error_type: String(answer.error_type || ''),
        comment: String(answer.comment || ''),
        confidence: Number(answer.confidence || 0).toFixed(6),
        teacher_status: String(answer.teacher_status || ''),
        teacher_note: String(answer.teacher_note || ''),
        question_image_sha256: String(answer.question_image_sha256 || ''),
      })),
    })),
  };
}

function batchPayloadDigest(body) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stableValue(semanticBatchPayload(body))))
    .digest('hex');
}

function privateFileToken(url) {
  return String(url || '').match(/^\/api\/private-files\/([a-f0-9]{32})$/)?.[1] || '';
}

function submissionPrivateTokens(submission) {
  const urls = [
    ...(Array.isArray(submission.processed_image_urls) ? submission.processed_image_urls : []),
    ...(Array.isArray(submission.original_image_urls) ? submission.original_image_urls : []),
    ...(Array.isArray(submission.answers) ? submission.answers.map((item) => item?.question_image_url) : []),
  ].filter(Boolean);
  return [...new Set(urls.map(privateFileToken).filter(Boolean))];
}

function validateDraftFiles(db, teacherId, submissions) {
  const errors = [];
  for (const submission of submissions) {
    const expectedHashes = new Map();
    const groups = [
      ['整页图片', submission.processed_image_urls, submission.processed_image_sha256s],
      ['原始图片', submission.original_image_urls, submission.original_image_sha256s],
    ];
    for (const [label, rawUrls, rawHashes] of groups) {
      const urls = Array.isArray(rawUrls) ? rawUrls : [];
      const hashes = Array.isArray(rawHashes) ? rawHashes.map(String) : [];
      if (urls.length !== hashes.length) errors.push(`学生 ${submission.student_id} 的${label}哈希数量不匹配`);
      urls.forEach((url, index) => expectedHashes.set(privateFileToken(url), hashes[index] || ''));
    }
    for (const answer of Array.isArray(submission.answers) ? submission.answers : []) {
      if (answer.question_image_url) {
        expectedHashes.set(privateFileToken(answer.question_image_url), String(answer.question_image_sha256 || ''));
      }
    }
    for (const token of submissionPrivateTokens(submission)) {
      const file = db.get('SELECT * FROM private_files WHERE token=?', [token]);
      if (!file || file.owner_type !== 'homework_draft'
        || Number(file.owner_id) !== Number(teacherId)
        || Number(file.created_by) !== Number(teacherId)
        || Number(file.student_id) !== Number(submission.student_id)) {
        errors.push(`学生 ${submission.student_id} 的作业图片无效或不属于当前任务`);
      } else if (!/^[a-f0-9]{64}$/.test(expectedHashes.get(token) || '')
        || expectedHashes.get(token) !== file.sha256) {
        errors.push(`学生 ${submission.student_id} 的作业图片哈希不匹配`);
      }
    }
  }
  return errors;
}

function claimDraftFiles(db, teacherId, submissionId, submission) {
  for (const token of submissionPrivateTokens(submission)) {
    const result = db.run(`UPDATE private_files SET owner_type='homework_submission',owner_id=?
      WHERE token=? AND owner_type='homework_draft' AND owner_id=? AND student_id=? AND created_by=?`, [
      submissionId, token, teacherId, submission.student_id, teacherId,
    ]);
    if (Number(result.changes) !== 1) throw new Error('作业私有图片关联失败');
  }
}

function cleanupIncomingDrafts(db, teacherId, submissions) {
  for (const submission of submissions) {
    for (const token of submissionPrivateTokens(submission)) {
      const file = db.get(`SELECT * FROM private_files
        WHERE token=? AND owner_type='homework_draft' AND owner_id=? AND created_by=?`, [token, teacherId, teacherId]);
      if (file) removePrivateFile(db, file);
    }
  }
}

function validateBatch(db, teacherId, body) {
  const errors = [];
  const submissions = Array.isArray(body.submissions) ? body.submissions : [];
  if (!String(body.title || '').trim()) errors.push('缺少作业标题');
  if (!validDate(body.assigned_date)) errors.push('作业日期格式应为有效的 YYYY-MM-DD');
  if (!String(body.idempotency_key || '').trim()) errors.push('缺少幂等键');
  if (submissions.length === 0) errors.push('没有学生作业');
  const seen = new Set();
  const normalizedSubmissions = [];
  for (const submission of submissions) {
    const studentId = resolveTeacherStudentId(db, teacherId, submission);
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
      if (answer.question_image_url && !privateFileToken(answer.question_image_url)) {
        errors.push(`学生 ${studentId} 的题目 ${answer.question_no} 图片必须使用私有文件`);
      }
    }
    if ((submission.processed_image_urls || []).some((url) => !privateFileToken(url))) {
      errors.push(`学生 ${studentId} 的整页图片必须使用私有文件`);
    }
    if ((submission.original_image_urls || []).some((url) => !privateFileToken(url))) {
      errors.push(`学生 ${studentId} 的原始图片必须使用私有文件`);
    }
    normalizedSubmissions.push({ ...submission, student_id: studentId });
  }
  return { errors, submissions: normalizedSubmissions };
}

function persistBatch(db, teacherId, body, submissions, serverPayloadDigest) {
  return db.transaction(() => {
    const storedManifest = { ...(body.source_manifest || {}), server_payload_digest: serverPayloadDigest };
    const submittedClassIds = db.all(`SELECT DISTINCT class_id FROM students WHERE id IN (${submissions.map(() => '?').join(',')})`,
      submissions.map((item) => Number(item.student_id))).map((item) => Number(item.class_id)).filter(Boolean);
    const classId = Number(body.class_id || 0) || (submittedClassIds.length === 1 ? submittedClassIds[0] : null);
    const batch = db.run(`INSERT INTO homework_batches
      (teacher_id,class_id,title,subject,assigned_date,status,prompt_version,source_manifest,idempotency_key,confirmed_at)
      VALUES(?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`, [
      teacherId, classId, String(body.title).trim(), String(body.subject || ''), body.assigned_date, 'reviewed',
      String(body.prompt_version || 'manual-chatgpt-v1'), JSON.stringify(storedManifest), String(body.idempotency_key)
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
      claimDraftFiles(db, teacherId, submission.lastInsertRowid, rawSubmission);
    }
    logOperation(db, teacherId, 'homework_batch_created', 'homework_batch', batch.lastInsertRowid, { students: submissions.length });
    return batch.lastInsertRowid;
  });
}

router.post('/upload-image', auth, teacherOnly, async (req, res) => {
  const db = getDB();
  const studentId = resolveTeacherStudentId(db, req.user.id, req.body || {});
  if (!teacherOwnsStudent(db, req.user.id, studentId)) return res.status(403).json({ error: '无权操作该学生' });
  const purpose = String(req.body?.purpose || 'homework_question');
  if (!['homework_page', 'homework_question'].includes(purpose)) return res.status(400).json({ error: '图片用途无效' });
  let decoded;
  try { decoded = await decodePrivateImage(req.body?.base64); }
  catch (error) { return res.status(400).json({ error: error.message }); }
  const duplicate = db.get(`SELECT token,sha256 FROM private_files
    WHERE student_id=? AND purpose=? AND owner_type='homework_draft' AND owner_id=? AND created_by=? AND sha256=?
    ORDER BY id DESC LIMIT 1`, [studentId, purpose, req.user.id, req.user.id, decoded.sha256]);
  if (duplicate) {
    return res.json({ ok: true, url: `/api/private-files/${duplicate.token}`, sha256: duplicate.sha256, idempotent: true });
  }
  try {
    const stored = storePrivateFile(db, {
      ...decoded, studentId, purpose, ownerType: 'homework_draft', ownerId: req.user.id,
      createdBy: req.user.id, originalName: req.body?.fileName || 'homework-image',
    });
    return res.status(201).json({ ok: true, url: `/api/private-files/${stored.token}`, sha256: decoded.sha256 });
  } catch {
    return res.status(500).json({ error: '图片保存失败' });
  }
});

function logOperation(db, actorId, action, entityType, entityId, detail = {}) {
  db.run('INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?)', [
    actorId, action, entityType, entityId || null, JSON.stringify(detail)
  ]);
}

router.post('/preview', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const { errors, submissions } = validateBatch(db, req.user.id, req.body || {});
  if (req.body?.payload_digest && req.body.payload_digest !== batchPayloadDigest(req.body || {})) {
    errors.push('发布载荷摘要不匹配');
  }
  const answerCount = submissions.reduce((sum, item) => sum + (Array.isArray(item.answers) ? item.answers.length : 0), 0);
  const wrongCount = submissions.reduce((sum, item) => sum + (Array.isArray(item.answers) ? item.answers.filter((a) => !a.is_correct).length : 0), 0);
  res.status(errors.length ? 400 : 200).json({ ok: errors.length === 0, errors, students: submissions.length, answers: answerCount, wrong: wrongCount });
});

router.post('/batches', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const body = req.body || {};
  const serverPayloadDigest = batchPayloadDigest(body);
  const existing = db.get('SELECT id,status,source_manifest FROM homework_batches WHERE idempotency_key=? AND teacher_id=?', [body.idempotency_key, req.user.id]);
  if (existing) {
    const storedDigest = json(existing.source_manifest, {}).server_payload_digest;
    cleanupIncomingDrafts(db, req.user.id, Array.isArray(body.submissions) ? body.submissions : []);
    if (storedDigest && storedDigest !== serverPayloadDigest) {
      return res.status(409).json({ error: '幂等键已用于不同的批改内容' });
    }
    return res.json({ ok: true, batch_id: existing.id, status: existing.status, idempotent: true });
  }
  if (!/^[a-f0-9]{64}$/.test(String(body.payload_digest || ''))
    || body.payload_digest !== serverPayloadDigest
    || body.idempotency_key !== body.payload_digest) {
    return res.status(400).json({ error: '发布载荷摘要不匹配' });
  }
  const { errors, submissions } = validateBatch(db, req.user.id, body);
  errors.push(...validateDraftFiles(db, req.user.id, submissions));
  if (errors.length) return res.status(400).json({ error: '批改数据校验失败', errors });
  try {
    const batchId = persistBatch(db, req.user.id, body, submissions, serverPayloadDigest);
    res.status(201).json({ ok: true, batch_id: batchId, status: 'reviewed' });
  } catch (error) {
    res.status(500).json({ error: '批次保存失败，所有数据库修改已回滚' });
  }
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
  const submissions = db.all(`SELECT s.*,st.name student_name,st.external_id external_student_id,
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
    ? db.all(`SELECT u.id FROM users u JOIN bindings b ON b.parent_id=u.id
      JOIN students st ON st.id=b.student_id LEFT JOIN classes c ON c.id=st.class_id
      WHERE u.id=? AND b.student_id=? AND st.deleted_at IS NULL AND c.deleted_at IS NULL
        AND u.openid IS NOT NULL AND u.openid!=''`, [parentId, submission.student_id])
    : db.all(`SELECT u.id FROM users u JOIN bindings b ON b.parent_id=u.id
      JOIN students st ON st.id=b.student_id LEFT JOIN classes c ON c.id=st.class_id
      WHERE b.student_id=? AND st.deleted_at IS NULL AND c.deleted_at IS NULL
        AND u.openid IS NOT NULL AND u.openid!=''`, [submission.student_id]);
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
  db.transaction(() => {
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
      db.run(`INSERT OR IGNORE INTO homework_parent_notices(submission_id,parent_id)
        SELECT ?,bind.parent_id FROM bindings bind
        JOIN students st ON st.id=bind.student_id
        LEFT JOIN classes c ON c.id=st.class_id
        WHERE bind.student_id=? AND st.deleted_at IS NULL AND c.deleted_at IS NULL`, [submission.id, submission.student_id]);
    }
    db.run('UPDATE homework_batches SET status=?,published_at=CURRENT_TIMESTAMP WHERE id=?', ['published', batch.id]);
    logOperation(db, req.user.id, 'homework_batch_published', 'homework_batch', batch.id, { students: submissions.length, notify: !!req.body?.send_notifications });
  });

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

router.get('/notices', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const db = getDB();
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const unreadOnly = String(req.query.unread || '1') !== '0';
  const unreadClause = unreadOnly ? 'AND n.seen_at IS NULL' : '';
  const scopeSql = `FROM homework_parent_notices n
    JOIN homework_submissions s ON s.id=n.submission_id
    JOIN homework_batches batch ON batch.id=s.batch_id
    JOIN students st ON st.id=s.student_id
    JOIN bindings bind ON bind.parent_id=n.parent_id AND bind.student_id=s.student_id
    LEFT JOIN classes c ON c.id=st.class_id
    WHERE n.parent_id=? ${unreadClause} AND batch.status='published'
      AND st.deleted_at IS NULL AND c.deleted_at IS NULL`;
  const notices = db.all(`SELECT n.id,n.submission_id,n.seen_at,n.created_at,
      s.batch_id,s.student_id,st.name student_name,batch.title,batch.subject,batch.assigned_date,batch.published_at
    ${scopeSql} ORDER BY COALESCE(batch.published_at,n.created_at) DESC,n.id DESC LIMIT ?`, [req.user.id, limit]);
  const total = db.get(`SELECT COUNT(*) total ${scopeSql}`, [req.user.id]);
  res.json({ notices, total: Number(total?.total || 0) });
});

router.post('/notices/seen', auth, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '无权限' });
  const noticeIds = [...new Set((Array.isArray(req.body?.notice_ids) ? req.body.notice_ids : [])
    .map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 50);
  if (noticeIds.length === 0) return res.status(400).json({ error: '缺少提醒编号' });
  const db = getDB();
  const placeholders = noticeIds.map(() => '?').join(',');
  const updated = db.run(`UPDATE homework_parent_notices
    SET seen_at=COALESCE(seen_at,CURRENT_TIMESTAMP)
    WHERE parent_id=? AND id IN (${placeholders})`, [req.user.id, ...noticeIds]);
  res.json({ ok: true, seen: Number(updated.changes || 0) });
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
module.exports._test = { batchPayloadDigest, persistBatch, semanticBatchPayload };
