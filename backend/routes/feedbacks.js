const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

// AI生成班级反馈
router.post('/generate-class', auth, async (req, res) => {
  const { grade, subject, lesson, topic, perfScore, homework } = req.body;
  const prompt = `你是教培老师，写一段发家长群的课后反馈。无空行，模块用 --- 分隔。

信息：${grade} ${subject} ${lesson||''} 课题《${topic||'未设定'}》课堂表现${perfScore||5}/10 作业:${homework||'无'}

格式（严格按此）：
各位家长好📘
${grade} ${lesson||''} ${topic||''}
---
📖 本讲重点
· 知识点1
· 知识点2
· 知识点3
---
[加油]课堂表现
[一段话，根据分数写。8-10分肯定为主，5-7分有进步空间，1-4分温和提醒。说具体表现不要说空话]
---
📚 作业说明
${homework||'请查看群内通知'}
---
[一句鼓励收尾，体现学科价值]

要求：200-300字，不要空行，知识点准确。返回纯文本。`;

  try {
    const text = await callAI(prompt, 900);
    res.json({ text });
  } catch(e) { res.status(500).json({ error: '生成失败' }); }
});

// 批量生成学生反馈 — 全班一次 API
router.post('/generate-student-batch', auth, async (req, res) => {
  const { students, classInfo } = req.body;
  if (!students || students.length === 0) return res.status(400).json({ error: '没有学生数据' });

  const list = students.map((s, i) =>
    `[${i}] ${s.name} | 成绩${s.level||'未设定'} | 出门测${s.quizScore||5}/10 | ${s.note||''} | 性格:${s.personality||'无'}`
  ).join('\n');

  const prompt = `你为以下${students.length}位学生各写一段课后反馈。本课：${classInfo?.content||''}，整体表现${classInfo?.perfScore||5}/10。

学生列表：
${list}

要求：
1. 每人 70-110 个中文字符，最多 3 句，像老师顺手写给家长，不像 AI 报告。
2. 格式：名字：正文。不要 emoji，不要标题，不要换行。
3. 必须写具体课堂行为或知识点，只说一个观察 + 一个提醒/肯定。
4. 性格只作语气参考，正文不要写"你是个xxx的孩子"。
5. 禁止套话和 AI 味："表现不错""继续努力""态度端正""总体来说""首先""此外""同时""相信在未来"。
6. 不要夸张，不要鸡汤，不要长段落。

返回JSON：{"results":[{"id":0,"feedback":"..."}]}`;

  try {
    const text = await callAI(prompt);
    const json = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const data = JSON.parse(json);
    data.results.forEach((r, i) => { if (students[i]) { r.name = students[i].name; r.feedback = cleanStudentFeedback(r.feedback, students[i].name); } });
    res.json(data);
  } catch(e) { res.status(500).json({ error: '批量生成失败' }); }
});

// 单个学生反馈（重生成用）
router.post('/generate-student', auth, async (req, res) => {
  const { name, level, personality, quizScore, note, content, perfScore } = req.body;
  const prompt = `你是教培老师，为一位学生写课后反馈。

本课：${content||'无'}，整体表现${perfScore||5}/10
学生：${name}，成绩${level||'未设定'}，性格${personality||'无'}
出门测大致水平：${quizScore||5}/10，${note||'无特殊说明'}

要求：
1. 70-110 个中文字符，最多 3 句。
2. 格式：${name}：正文。不要 emoji，不要标题，不要换行。
3. 像老师顺手写给家长，不像 AI 报告。
4. 只写一个具体观察 + 一个提醒/肯定。
5. 禁止："表现不错""继续努力""态度端正""总体来说""首先""此外""同时""相信在未来"。
返回纯文本。`;

  try {
    const text = await callAI(prompt, 400);
    res.json({ text: cleanStudentFeedback(text, name) });
  } catch(e) { res.status(500).json({ error: '生成失败' }); }
});

// 发布反馈
router.post('/publish', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { class_id, class_date, schedule_id, class_feedback, homework, students, notes_pdf_url } = req.body;
  const db = getDB();
  // 保存班级反馈 + 每个学生的反馈
  const r = db.run('INSERT INTO feedbacks (teacher_id, class_id, schedule_id, class_date, summary, homework, notes_pdf_url, student_feedbacks) VALUES (?,?,?,?,?,?,?,?)', [req.user.id, class_id, schedule_id||null, class_date, class_feedback, homework||'', notes_pdf_url||'', JSON.stringify(students||[])]);
  try { require('./notify').notifyFeedback(class_id); } catch(e) {}
  res.json({ ok: true, id: r.lastInsertRowid });
});

// 单独发送学习笔记
router.post('/publish-notes', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { class_id, class_date, schedule_id, notes_pdf_url, note_remark } = req.body;
  if (!class_id || !class_date) return res.status(400).json({ error: '缺少学习小组或日期' });
  if (!notes_pdf_url && !note_remark) return res.status(400).json({ error: '请选择学习笔记或填写备注' });
  const summary = note_remark || '学习笔记已发送，请查看附件';
  const db = getDB();
  const r = db.run('INSERT INTO feedbacks (teacher_id, class_id, schedule_id, class_date, summary, homework, notes_pdf_url, student_feedbacks) VALUES (?,?,?,?,?,?,?,?)', [req.user.id, class_id, schedule_id||null, class_date, summary, '', notes_pdf_url||'', '[]']);
  try { require('./notify').notifyFeedback(class_id); } catch(e) {}
  res.json({ ok: true, id: r.lastInsertRowid });
});

// 家长查反馈列表
// 上传反馈图片
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedImageTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);
const allowedPdfTypes = new Map([
  ['application/pdf', '.pdf']
]);

function pdfExt(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (allowedPdfTypes.has(file.mimetype)) return allowedPdfTypes.get(file.mimetype);
  if (ext === '.pdf') return '.pdf';
  if (file.fieldname === 'pdf') return '.pdf';
  return '';
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + allowedImageTypes.get(file.mimetype))
  }),
  fileFilter: (req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) return cb(new Error('仅支持 JPG/PNG/WebP 图片'));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});
const uploadPdf = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + pdfExt(file))
  }),
  fileFilter: (req, file, cb) => {
    if (!pdfExt(file)) return cb(new Error('仅支持 PDF 文件'));
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 }
});

function boundStudentIds(db, parentId) {
  return new Set(db.all('SELECT student_id FROM bindings WHERE parent_id=?', [parentId]).map((item) => Number(item.student_id)));
}

function sanitizeFeedbackForParent(db, fb, parentId) {
  if (!fb) return fb;
  const allowed = boundStudentIds(db, parentId);
  const copy = { ...fb };
  if (copy.student_feedbacks) {
    try {
      const list = JSON.parse(copy.student_feedbacks);
      copy.student_feedbacks = JSON.stringify((Array.isArray(list) ? list : []).filter((item) => allowed.has(Number(item.id))));
    } catch (e) {
      copy.student_feedbacks = '[]';
    }
  }
  return copy;
}

router.post('/upload-image', auth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '图片上传失败' });
  if (!req.file) return res.status(400).json({ error: '未选择文件' });
  res.json({ url: '/uploads/'+req.file.filename });
  });
});

router.post('/upload-pdf', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  uploadPdf.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'PDF 上传失败' });
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    res.json({ url: '/uploads/'+req.file.filename });
  });
});

router.get('/latest', auth, (req, res) => {
  const db = getDB();
  const { class_id } = req.query;
  let fb;
  if (class_id) {
    if (req.user.role === 'teacher') {
      fb = db.get('SELECT f.* FROM feedbacks f WHERE f.class_id=? AND f.teacher_id=? ORDER BY f.created_at DESC LIMIT 1', [class_id, req.user.id]);
    } else {
      fb = db.get('SELECT f.* FROM feedbacks f JOIN students s ON s.class_id=f.class_id JOIN bindings b ON b.student_id=s.id WHERE f.class_id=? AND b.parent_id=? ORDER BY f.created_at DESC LIMIT 1', [class_id, req.user.id]);
    }
  } else {
    fb = db.get('SELECT f.* FROM feedbacks f JOIN students s ON s.class_id=f.class_id JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? ORDER BY f.created_at DESC LIMIT 1', [req.user.id]);
  }
  if (req.user.role === 'parent') fb = sanitizeFeedbackForParent(db, fb, req.user.id);
  res.json({ feedback: fb || null });
});

router.get('/list', auth, (req, res) => {
  const db = getDB();
  const { class_id } = req.query;
  let sql,params;
  if (class_id) {
    if (req.user.role === 'teacher') {
      sql = 'SELECT * FROM feedbacks WHERE class_id=? AND teacher_id=? ORDER BY created_at DESC LIMIT 30';
      params = [class_id, req.user.id];
    } else {
      sql = 'SELECT DISTINCT f.* FROM feedbacks f JOIN students s ON s.class_id=f.class_id JOIN bindings b ON b.student_id=s.id WHERE f.class_id=? AND b.parent_id=? ORDER BY f.created_at DESC LIMIT 30';
      params = [class_id, req.user.id];
    }
  } else {
    sql = 'SELECT f.* FROM feedbacks f JOIN students s ON s.class_id=f.class_id JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? ORDER BY f.created_at DESC LIMIT 30';
    params = [req.user.id];
  }
  const feedbacks = db.all(sql, params);
  res.json({ feedbacks: req.user.role === 'parent' ? feedbacks.map((fb) => sanitizeFeedbackForParent(db, fb, req.user.id)) : feedbacks });
});

// 家长查单条反馈详情
router.get('/:id', auth, (req, res) => {
  const db = getDB();
  const sql = req.user.role === 'teacher'
    ? 'SELECT * FROM feedbacks WHERE id=? AND teacher_id=?'
    : 'SELECT DISTINCT f.* FROM feedbacks f JOIN students s ON s.class_id=f.class_id JOIN bindings b ON b.student_id=s.id WHERE f.id=? AND b.parent_id=?';
  const fb = db.get(sql, [req.params.id, req.user.id]);
  if (!fb) return res.status(404).json({ error: '不存在' });
  res.json({ feedback: req.user.role === 'parent' ? sanitizeFeedbackForParent(db, fb, req.user.id) : fb });
});

function cleanStudentFeedback(text, name = '') {
  let value = String(text || '')
    .replace(/\*/g, '')
    .replace(/```json\n?|```\n?/g, '')
    .replace(/[🎯🌟💡🔥💎🚀🐣🎨🏆🎵✨⭐🧸✏️🌱🎪📘📖📚]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const banned = ['总体来说', '首先', '此外', '同时', '相信在未来', '表现不错', '继续努力', '态度端正'];
  for (const word of banned) value = value.replaceAll(word, '');
  value = value.replace(/\s+/g, ' ').trim();
  if (name && !value.startsWith(name)) value = `${name}：${value.replace(/^：|:/, '')}`;
  if (value.length <= 130) return value;
  const cut = value.slice(0, 130);
  const lastPunc = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'));
  return (lastPunc > 50 ? cut.slice(0, lastPunc + 1) : cut).trim();
}

async function callAI(prompt, maxTokens = 400) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is required');
  const axios = require('axios');
  const { data } = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: maxTokens
  }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } });
  // 去 * 号，去空行
  return data.choices[0].message.content.replace(/\*/g, '').split('\n').filter(l=>l.trim()).join('\n');
}

module.exports = router;
