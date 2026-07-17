const express = require('express');
const crypto = require('node:crypto');
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db/init');
const { authRequired: auth } = require('../middleware/auth');
const { parentBoundStudent } = require('../utils/scope');
const { EXAM_LIBRARY_DIR, ensureExamLibraryDir, resolveExamPath } = require('../utils/exam-files');

const router = express.Router();

function importAuthorized(req) {
  const expected = String(process.env.EXAM_IMPORT_TOKEN || '');
  const supplied = String(req.get('x-exam-import-token') || '');
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function importOnly(req, res, next) {
  if (!importAuthorized(req)) return res.status(404).json({ error: '接口不存在' });
  next();
}

function importedAsset(db, raw, kind) {
  if (!raw?.base64 || !raw?.original_name) throw new Error('导入文件信息不完整');
  const name = path.basename(String(raw.original_name)).slice(0, 180);
  const ext = path.extname(name).toLowerCase();
  if (!['.pdf', '.doc', '.docx'].includes(ext)) throw new Error('仅支持 PDF、DOC、DOCX');
  const buffer = Buffer.from(String(raw.base64), 'base64');
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error('导入文件大小无效');
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  if (raw.sha256 && String(raw.sha256) !== sha256) throw new Error('导入文件哈希不匹配');
  const existing = db.get('SELECT id FROM exam_assets WHERE sha256=?', [sha256]);
  if (existing) return Number(existing.id);
  ensureExamLibraryDir();
  const storageKey = `${kind}/${sha256.slice(0, 2)}/${sha256}${ext}`;
  const target = path.join(EXAM_LIBRARY_DIR, storageKey);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) fs.writeFileSync(target, buffer, { flag: 'wx' });
  const mimeType = ext === '.pdf' ? 'application/pdf' : ext === '.doc' ? 'application/msword'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const created = db.run(`INSERT INTO exam_assets(asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
    VALUES(?,?,?,?,?,?)`, [kind, storageKey, name, mimeType, buffer.length, sha256]);
  return Number(created.lastInsertRowid);
}

router.get('/admin/status', importOnly, (req, res) => {
  const db = getDB();
  const paperCounts = db.all(`SELECT status,COUNT(*) count FROM exam_papers GROUP BY status`);
  const challengeCounts = db.all(`SELECT question_type,COUNT(*) count FROM weekly_challenge_questions
    WHERE is_active=1 GROUP BY question_type`);
  res.json({ ok: true, papers: paperCounts, assets: Number(db.get('SELECT COUNT(*) count FROM exam_assets')?.count || 0), challenges: challengeCounts });
});

router.post('/admin/import-batch', importOnly, (req, res) => {
  const db = getDB();
  const metadata = req.body?.metadata || {};
  if (!/^GZ7-[A-Z0-9-]{8,40}$/.test(String(metadata.stable_code || ''))) return res.status(400).json({ error: '试卷编号无效' });
  if (!['midterm', 'final', 'monthly'].includes(metadata.exam_type)) return res.status(400).json({ error: '考试类型无效' });
  try {
    const paperAssetId = importedAsset(db, req.body.paper, 'paper');
    const answerAssetId = req.body.answer ? importedAsset(db, req.body.answer, 'answer') : null;
    db.run(`INSERT INTO exam_papers(stable_code,display_title,school_name,district,school_year,exam_year,grade,semester,exam_type,
      paper_asset_id,answer_asset_id,source_relative_path,license_status,status)
      VALUES(?,?,?,?,?,?,?,'上学期',?,?,?,?,?,'published') ON CONFLICT(stable_code) DO UPDATE SET
      display_title=excluded.display_title,school_name=excluded.school_name,district=excluded.district,
      school_year=excluded.school_year,exam_year=excluded.exam_year,exam_type=excluded.exam_type,
      paper_asset_id=excluded.paper_asset_id,answer_asset_id=excluded.answer_asset_id,
      source_relative_path=excluded.source_relative_path,license_status='teacher_provided',status='published',updated_at=CURRENT_TIMESTAMP`, [
      metadata.stable_code, String(metadata.display_title || '').slice(0, 180), String(metadata.school_name || '').slice(0, 100),
      String(metadata.district || '').slice(0, 40), String(metadata.school_year || '').slice(0, 20), metadata.exam_year || null,
      String(metadata.grade || '七年级').slice(0, 20), metadata.exam_type, paperAssetId, answerAssetId,
      String(metadata.source_relative_path || '').slice(0, 600), 'teacher_provided',
    ]);
    res.json({ ok: true, stable_code: metadata.stable_code, has_answer: Boolean(answerAssetId) });
  } catch (error) {
    res.status(400).json({ error: error.message || '试卷导入失败' });
  }
});

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可操作' });
  next();
}

function parentOnly(req, res, next) {
  if (req.user.role !== 'parent') return res.status(403).json({ error: '仅家长可操作' });
  next();
}

function ownedStudent(db, user, rawStudentId) {
  const studentId = Number(rawStudentId);
  return Number.isInteger(studentId) && studentId > 0 && parentBoundStudent(db, user.id, studentId) ? studentId : 0;
}

function publicPaper(row, teacher = false) {
  return {
    id: Number(row.id),
    stable_code: row.stable_code,
    display_title: row.display_title,
    school_name: row.school_name || '',
    district: row.district || '',
    school_year: row.school_year || '',
    exam_year: row.exam_year ? Number(row.exam_year) : null,
    grade: row.grade,
    semester: row.semester,
    exam_type: row.exam_type,
    has_answer: !!row.answer_asset_id,
    status: teacher ? row.status : undefined,
    license_status: teacher ? row.license_status : undefined,
  };
}

router.get('/', auth, (req, res) => {
  const db = getDB();
  const parentStudentId = req.user.role === 'parent' ? ownedStudent(db, req.user, req.query.student_id) : 0;
  if (req.user.role === 'parent' && !parentStudentId) {
    return res.status(403).json({ error: '请先绑定学生' });
  }
  const clauses = [req.user.role === 'teacher' ? "p.status!='hidden'" : "p.status='published'"];
  const params = [];
  const type = String(req.query.exam_type || '');
  if (['midterm', 'final', 'monthly'].includes(type)) { clauses.push('p.exam_type=?'); params.push(type); }
  const yearBucket = String(req.query.year_bucket || '');
  if (yearBucket === 'recent') clauses.push('p.exam_year>=2024');
  if (yearBucket === 'older') clauses.push('(p.exam_year<2024 OR p.exam_year IS NULL)');
  const keyword = String(req.query.keyword || '').trim().slice(0, 40);
  if (keyword) { clauses.push('(p.display_title LIKE ? OR p.school_name LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(10, Math.min(50, Number.parseInt(req.query.limit || '20', 10) || 20));
  const where = clauses.join(' AND ');
  const total = Number(db.get(`SELECT COUNT(*) count FROM exam_papers p WHERE ${where}`, params)?.count || 0);
  const rows = db.all(`SELECT p.* FROM exam_papers p WHERE ${where}
    ORDER BY COALESCE(p.exam_year,0) DESC,p.exam_type,p.display_title LIMIT ? OFFSET ?`, [...params, limit, (page - 1) * limit]);
  const papers = rows.map((row) => {
    const paper = publicPaper(row, req.user.role === 'teacher');
    if (parentStudentId) {
      paper.answer_request_status = db.get(`SELECT status FROM exam_answer_requests
        WHERE exam_id=? AND parent_id=? AND student_id=?`, [row.id, req.user.id, parentStudentId])?.status || null;
    }
    return paper;
  });
  res.json({
    papers,
    filters: { exam_types: ['midterm', 'final', 'monthly'], year_buckets: ['recent', 'older'] },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/teacher/activity', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const downloads = db.all(`SELECT e.id,e.status,e.created_at,e.exam_id,p.display_title,
    s.name student_name,u.nickname parent_name,
    (SELECT COUNT(*) FROM exam_download_events r WHERE r.exam_id=e.exam_id AND r.actor_id=e.actor_id
      AND COALESCE(r.student_id,0)=COALESCE(e.student_id,0)) repeat_count
    FROM exam_download_events e JOIN exam_papers p ON p.id=e.exam_id
    LEFT JOIN students s ON s.id=e.student_id LEFT JOIN users u ON u.id=e.actor_id
    WHERE e.teacher_id=? ORDER BY e.created_at DESC LIMIT 100`, [req.user.id]);
  const requests = db.all(`SELECT r.*,p.display_title,s.name student_name,u.nickname parent_name,
    a.id answer_asset_id FROM exam_answer_requests r JOIN exam_papers p ON p.id=r.exam_id
    JOIN students s ON s.id=r.student_id JOIN users u ON u.id=r.parent_id
    LEFT JOIN exam_assets a ON a.id=p.answer_asset_id
    WHERE r.teacher_id=? ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100`, [req.user.id]);
  res.json({ downloads, requests });
});

router.patch('/teacher/answer-requests/:id', auth, teacherOnly, (req, res) => {
  const status = String(req.body?.status || '');
  if (!['sent', 'dismissed'].includes(status)) return res.status(400).json({ error: '处理状态无效' });
  const result = getDB().run(`UPDATE exam_answer_requests SET status=?,handled_at=CURRENT_TIMESTAMP
    WHERE id=? AND teacher_id=?`, [status, req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: '答案请求不存在' });
  res.json({ ok: true });
});

router.get('/assets/:assetId', auth, (req, res) => {
  const db = getDB();
  const asset = db.get(`SELECT a.*,p.id exam_id,p.status paper_status,p.paper_asset_id,p.answer_asset_id
    FROM exam_assets a JOIN exam_papers p ON p.paper_asset_id=a.id OR p.answer_asset_id=a.id
    WHERE a.id=? LIMIT 1`, [Number(req.params.assetId)]);
  if (!asset) return res.status(404).json({ error: '文件不存在' });
  const isAnswer = Number(asset.answer_asset_id) === Number(asset.id);
  if (isAnswer && req.user.role !== 'teacher') return res.status(404).json({ error: '文件不存在' });
  if (!isAnswer && req.user.role === 'parent') {
    const studentId = ownedStudent(db, req.user, req.query.student_id);
    if (!studentId || asset.paper_status !== 'published') return res.status(404).json({ error: '文件不存在' });
  }
  const fullPath = resolveExamPath(asset.storage_key);
  if (!fullPath || !fs.existsSync(fullPath)) return res.status(404).json({ error: '文件暂未同步到服务器' });
  const eventId = Number(req.query.event_id);
  if (eventId) db.run(`UPDATE exam_download_events SET status='download_succeeded'
    WHERE id=? AND actor_id=? AND exam_id=?`, [eventId, req.user.id, asset.exam_id]);
  res.set({
    'Content-Type': asset.mime_type,
    'Content-Length': String(asset.byte_size),
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.original_name)}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(fullPath).pipe(res);
});

router.post('/:id/download', auth, (req, res) => {
  const db = getDB();
  const paper = db.get('SELECT * FROM exam_papers WHERE id=?', [Number(req.params.id)]);
  if (!paper) return res.status(404).json({ error: '试卷不存在' });
  const assetKind = req.user.role === 'teacher' && req.body?.asset_kind === 'answer' ? 'answer' : 'paper';
  let studentId = null;
  let teacherId = req.user.role === 'teacher' ? req.user.id : null;
  if (req.user.role === 'parent') {
    studentId = ownedStudent(db, req.user, req.body?.student_id);
    if (!studentId || paper.status !== 'published') return res.status(403).json({ error: '无权下载该试卷' });
    teacherId = db.get(`SELECT COALESCE(s.teacher_id,c.teacher_id) teacher_id FROM students s
      LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?`, [studentId])?.teacher_id || null;
  }
  const assetId = assetKind === 'answer' ? paper.answer_asset_id : paper.paper_asset_id;
  if (!assetId) return res.status(404).json({ error: assetKind === 'answer' ? '该试卷尚未配对答案' : '试卷文件不存在' });
  const asset = db.get('SELECT original_name,mime_type FROM exam_assets WHERE id=?', [assetId]);
  if (!asset) return res.status(404).json({ error: '试卷文件不存在' });
  const event = db.run(`INSERT INTO exam_download_events(exam_id,actor_id,student_id,teacher_id,asset_kind,status)
    VALUES(?,?,?,?,?,'requested')`, [paper.id, req.user.id, studentId, teacherId, assetKind]);
  const studentQuery = studentId ? `&student_id=${studentId}` : '';
  res.status(201).json({
    event_id: event.lastInsertRowid,
    asset_kind: assetKind,
    original_name: asset.original_name,
    mime_type: asset.mime_type,
    file_type: String(asset.original_name).split('.').pop().toLowerCase(),
    download_url: `/api/exams/assets/${assetId}?event_id=${event.lastInsertRowid}${studentQuery}`,
  });
});

router.post('/:id/download/:eventId/complete', auth, (req, res) => {
  const status = req.body?.opened === true ? 'opened' : (req.body?.success === false ? 'failed' : 'download_succeeded');
  const result = getDB().run(`UPDATE exam_download_events SET status=?,error=?
    WHERE id=? AND exam_id=? AND actor_id=?`, [status, String(req.body?.error || '').slice(0, 240), req.params.eventId, req.params.id, req.user.id]);
  if (!result.changes) return res.status(404).json({ error: '下载记录不存在' });
  res.json({ ok: true });
});

router.post('/:id/answer-requests', auth, parentOnly, (req, res) => {
  const db = getDB();
  const studentId = ownedStudent(db, req.user, req.body?.student_id);
  if (!studentId) return res.status(403).json({ error: '无权为该学生申请答案' });
  const paper = db.get(`SELECT * FROM exam_papers WHERE id=? AND status='published'`, [Number(req.params.id)]);
  if (!paper) return res.status(404).json({ error: '试卷不存在' });
  const teacherId = db.get(`SELECT COALESCE(s.teacher_id,c.teacher_id) teacher_id FROM students s
    LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=?`, [studentId])?.teacher_id;
  if (!teacherId) return res.status(400).json({ error: '当前学生尚未关联教师' });
  db.run(`INSERT INTO exam_answer_requests(exam_id,parent_id,student_id,teacher_id,status,note)
    VALUES(?,?,?,?,'pending',?) ON CONFLICT(exam_id,parent_id,student_id)
    DO UPDATE SET status='pending',note=excluded.note,handled_at=NULL,created_at=CURRENT_TIMESTAMP`, [
    paper.id, req.user.id, studentId, teacherId, String(req.body?.note || '').trim().slice(0, 160),
  ]);
  res.status(201).json({ ok: true, message: '老师已收到答案请求' });
});

router.get('/:id', auth, (req, res) => {
  const paper = getDB().get('SELECT * FROM exam_papers WHERE id=?', [Number(req.params.id)]);
  if (!paper || (req.user.role === 'parent' && paper.status !== 'published')) return res.status(404).json({ error: '试卷不存在' });
  res.json({ paper: publicPaper(paper, req.user.role === 'teacher') });
});

module.exports = router;
