const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');
const { teacherOwnsClass, teacherOwnsSchedule, teacherOwnsStudent } = require('../utils/scope');
const feedbackEmojiConfig = require('../shared/feedback-emojis.json');
const FEEDBACK_EMOJIS = Object.freeze([...feedbackEmojiConfig.emojis]);
const SUPPORTED_FEEDBACK_EMOJIS = new Set(FEEDBACK_EMOJIS);
const FEEDBACK_EMOJI_PROMPT = FEEDBACK_EMOJIS.join('、');

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const FEEDBACK_EMOJI_PATTERN = new RegExp(FEEDBACK_EMOJIS.map(escapeRegExp).join('|'), 'gu');
const LEADING_FEEDBACK_EMOJI_PATTERN = new RegExp(`^(?:${FEEDBACK_EMOJIS.map(escapeRegExp).join('|')})\\s*`, 'u');
const EMOJI_LIKE_PATTERN = /(?:[\u2300-\u23FF]|[\u2600-\u27BF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDFFF])\uFE0F?/g;
const EMOJI_JOINER_OR_MODIFIER_PATTERN = /[\u200D\uFE0F]|\uD83C[\uDFFB-\uDFFF]/g;

function studentFeedbackRules(style, studentLabel = '姓名') {
  if (style === 'warm') {
    return `1. 正文 80-130 个中文字符，最多 4 句。语气温和但克制，是熟悉学生的老师在说课堂情况，不哄、不煽情。
2. 第一行格式：${studentLabel} + 一个兼容 emoji；第二行开始写正文。只放 1 个 emoji，从这些里面选：${FEEDBACK_EMOJI_PROMPT}。
3. 先写一个真实课堂细节，再写本节课的进步、卡点或下一步；有问题就直接说明，不绕弯，也不要拔高成性格结论。
4. 只使用输入中已有的课堂内容、备注和出门测信息，不编造动作、对话、情绪或前后对比。
5. 禁止过度温柔和 AI 套话：“宝贝”“闪闪发光”“令人欣慰”“让人眼前一亮”“潜力无限”“未来可期”“老师相信你”“成长的路上”“继续保持”。
6. 不要写成 AI 评语、总结、分析报告或鸡汤；不用“首先、此外、同时、总体来说”等连接词。`;
  }
  return `1. 正文 45-90 个中文字符，2-3 个短句，像老师课后随手发给家长的记录，短、准、直接。
2. 第一行格式：${studentLabel} + 一个兼容 emoji；第二行开始写正文。只放 1 个 emoji，从这些里面选：${FEEDBACK_EMOJI_PROMPT}。
3. 开头直接写一个具体观察：课堂动作、答题步骤、出门测情况或老师备注；接着给一句肯定或提醒。没有问题就不要硬找问题。
4. 只使用输入中已有的信息，不编造学生的动作、对话、情绪或“比上次更好”等前后对比。
5. 不要写成总结、评语、分析报告，不讲大道理，不夸张，不鸡汤。
6. 禁止 AI 套话：“表现不错”“继续努力”“态度端正”“总体来说”“首先”“此外”“同时”“相信在未来”“值得肯定”“未来可期”。`;
}

// AI生成班级反馈
router.post('/generate-class', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { grade, subject, lesson, topic, perfScore, homework } = req.body;
  const prompt = `你是教培老师，写一段发家长群的课后反馈。无空行，模块用 --- 分隔。

信息：${grade} ${subject} ${lesson||''} 课题《${topic||'未设定'}》课堂表现${perfScore||5}/10。独立作业字段：${homework||'无'}

格式（严格按此）：
各位家长好📘
${grade} ${lesson||''} ${topic||''}
---
📖 本讲重点
· 知识点1
· 知识点2
· 知识点3
---
💪 课堂表现
[一段话，根据分数写。8-10分肯定为主，5-7分有进步空间，1-4分温和提醒。说具体表现不要说空话]
---
[一句鼓励收尾，体现学科价值]

要求：200-300字，不要空行，知识点准确。作业由独立组件展示，不要把作业写进反馈正文。返回纯文本。`;

  try {
    const text = await callAI(prompt, 900);
    res.json({ text });
  } catch(e) { res.status(500).json({ error: '生成失败' }); }
});

// 批量生成学生反馈 — 全班一次 API
router.post('/generate-student-batch', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { students, classInfo, style = 'concise' } = req.body;
  if (!students || students.length === 0) return res.status(400).json({ error: '没有学生数据' });
  const db = getDB();
  const invalidStudent = students.find((item) => item?.id && !teacherOwnsStudent(db, req.user.id, item.id));
  if (invalidStudent) return res.status(403).json({ error: '学生不属于当前老师' });

  const list = students.map((s, i) =>
    `[${i}] ${s.name} | 成绩${s.level||'未设定'} | 出门测${s.quizScore||5}/10 | ${s.note||''} | 性格:${s.personality||'无'}`
  ).join('\n');

  const prompt = `你是教培老师，为以下${students.length}位学生各写一段课后反馈。本课：${classInfo?.content||''}，整体课堂表现${classInfo?.perfScore||5}/10。

学生列表：
${list}

要求：
${studentFeedbackRules(style)}
7. 每位学生的切入点和句式要自然区分，不出现具体分数。性格只作语气参考，不直接评价性格。

返回JSON：{"results":[{"id":0,"feedback":"..."}]}`;

  try {
    const text = await callAI(prompt, batchMaxTokens(students.length, style));
    const json = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const data = JSON.parse(json);
    if (!Array.isArray(data.results) || data.results.length < students.length) {
      throw new Error('AI 返回的学生反馈不完整');
    }
    const results = students.map((student, index) => {
      const generated = data.results.find((item) => Number(item?.id) === index) || data.results[index];
      if (!generated?.feedback) throw new Error('AI 返回的学生反馈不完整');
      return {
        ...generated,
        // 提示词里的 id 是数组下标；响应给前端时必须恢复成真实学生 id。
        id: student.id ?? index,
        name: student.name,
        feedback: cleanStudentFeedback(generated.feedback, student.name, style)
      };
    });
    res.json({ ...data, results });
  } catch(e) { res.status(500).json({ error: '批量生成失败' }); }
});

// 单个学生反馈（重生成用）
router.post('/generate-student', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { name, level, personality, quizScore, note, content, perfScore, style = 'concise' } = req.body;
  const prompt = `你是教培老师，为一位学生写课后反馈。

本课：${content||'无'}，整体课堂表现${perfScore||5}/10
学生：${name}，成绩${level||'未设定'}，性格${personality||'无'}，出门测大致水平${quizScore||5}/10，${note||'无特殊说明'}

要求：
${studentFeedbackRules(style, name)}
7. 不出现具体分数；性格只作语气参考，不直接评价性格。返回纯文本。`;

  try {
    const text = await callAI(prompt, style === 'warm' ? 800 : 400);
    res.json({ text: cleanStudentFeedback(text, name, style) });
  } catch(e) { res.status(500).json({ error: '生成失败' }); }
});

// 发布反馈
router.post('/publish', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { class_id, class_date, schedule_id, class_feedback, homework, students, notes_pdf_url } = req.body;
  const db = getDB();
  if (!teacherOwnsClass(db, req.user.id, class_id)) return res.status(403).json({ error: '无权操作该学习小组' });
  if (schedule_id && !teacherOwnsSchedule(db, req.user.id, schedule_id)) return res.status(403).json({ error: '无权操作该课表' });
  const invalidStudent = (students || []).find((item) => item?.id && !teacherOwnsStudent(db, req.user.id, item.id));
  if (invalidStudent) return res.status(403).json({ error: '学生不属于当前老师' });
  // 保存班级反馈 + 每个学生的反馈
  const r = db.run('INSERT INTO feedbacks (teacher_id, class_id, schedule_id, class_date, summary, homework, notes_pdf_url, student_feedbacks) VALUES (?,?,?,?,?,?,?,?)', [req.user.id, class_id, schedule_id||null, class_date, class_feedback, homework||'', notes_pdf_url||'', JSON.stringify(students||[])]);
  let notify = { ok: false, error: '未发送' };
  try { notify = await require('./notify').notifyFeedback(class_id); } catch(e) { notify = { ok: false, error: e.message }; }
  res.json({ ok: true, id: r.lastInsertRowid, notify });
});

// 单独发送学习笔记
router.post('/publish-notes', auth, async (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { class_id, class_date, schedule_id, notes_pdf_url, note_remark } = req.body;
  if (!class_id || !class_date) return res.status(400).json({ error: '缺少学习小组或日期' });
  if (!notes_pdf_url && !note_remark) return res.status(400).json({ error: '请选择学习笔记或填写备注' });
  const db = getDB();
  const cls = db.get('SELECT id FROM classes WHERE id=? AND teacher_id=?', [class_id, req.user.id]);
  if (!cls) return res.status(403).json({ error: '无权限操作该学习小组' });
  const summary = String(note_remark || (notes_pdf_url ? '学习笔记已发送，请查看附件' : '学习笔记已发送')).trim();
  const r = db.run('INSERT INTO feedbacks (teacher_id, class_id, schedule_id, class_date, summary, homework, notes_pdf_url, student_feedbacks) VALUES (?,?,?,?,?,?,?,?)', [req.user.id, class_id, schedule_id||null, class_date, summary, '', notes_pdf_url||'', '[]']);
  let notify = { ok: false, error: '未发送' };
  try { notify = await require('./notify').notifyFeedback(class_id); } catch(e) { notify = { ok: false, error: e.message }; }
  res.json({ ok: true, id: r.lastInsertRowid, notify });
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

function detectUploadType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return 'image/png';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

function extFromName(name = '') {
  return path.extname(name).toLowerCase();
}

function saveBase64Upload(req, res, options) {
  const { base64, fileName = '', mimeType = '' } = req.body || {};
  if (!base64) return res.status(400).json({ error: '未选择文件' });
  const clean = String(base64).replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(clean, 'base64');
  if (!buffer.length) return res.status(400).json({ error: '文件内容为空' });
  if (buffer.length > options.maxSize) return res.status(400).json({ error: options.tooLarge });
  const detected = detectUploadType(buffer);
  if (!detected || !options.allowed.has(detected)) return res.status(400).json({ error: options.invalid });
  const ext = options.allowed.get(detected);
  const savedName = crypto.randomUUID() + ext;
  fs.writeFileSync(path.join(uploadDir, savedName), buffer);
  return res.json({ url: '/uploads/' + savedName });
}

function removeUploadedFile(file) {
  if (!file?.path) return;
  try { fs.unlinkSync(file.path); } catch (e) {}
}

function validateUploadedFile(file, allowed) {
  if (!file?.path) return false;
  const buffer = fs.readFileSync(file.path);
  const detected = detectUploadType(buffer);
  return detected && allowed.has(detected);
}

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
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  if (req.body?.base64) {
    return saveBase64Upload(req, res, {
      allowed: allowedImageTypes,
      exts: ['.jpg', '.jpeg', '.png', '.webp'],
      maxSize: 10 * 1024 * 1024,
      tooLarge: '图片不能超过 10MB',
      invalid: '仅支持 JPG/PNG/WebP 图片'
    });
  }
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || '图片上传失败' });
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    if (!validateUploadedFile(req.file, allowedImageTypes)) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: '仅支持 JPG/PNG/WebP 图片' });
    }
    res.json({ url: '/uploads/'+req.file.filename });
  });
});

router.post('/upload-pdf', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  if (req.body?.base64) {
    return saveBase64Upload(req, res, {
      allowed: allowedPdfTypes,
      exts: ['.pdf'],
      maxSize: 25 * 1024 * 1024,
      tooLarge: 'PDF 不能超过 25MB',
      invalid: '仅支持 PDF 文件'
    });
  }
  uploadPdf.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'PDF 上传失败' });
    if (!req.file) return res.status(400).json({ error: '未选择文件' });
    if (!validateUploadedFile(req.file, allowedPdfTypes)) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: '仅支持 PDF 文件' });
    }
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

function normalizeFeedbackEmojis(text) {
  let normalizedText = String(text || '');
  for (const [placeholder, emoji] of Object.entries(feedbackEmojiConfig.placeholders || {})) {
    normalizedText = normalizedText.replaceAll(placeholder, emoji);
  }
  return normalizedText
    .replace(EMOJI_LIKE_PATTERN, (emoji) => {
      const normalized = emoji.replace(/\uFE0F/g, '');
      return SUPPORTED_FEEDBACK_EMOJIS.has(normalized) ? normalized : '';
    })
    .replace(EMOJI_JOINER_OR_MODIFIER_PATTERN, '');
}

function cleanStudentFeedback(text, name = '', style = 'concise') {
  let value = normalizeFeedbackEmojis(String(text || '')
    .replace(/\*/g, '')
    .replace(/```json\n?|```\n?/g, ''));
  if (style === 'warm') {
    value = value
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim();
  } else {
    value = value
      .replace(/\s+/g, ' ')
      .trim();
  }
  const banned = [
    '总体来说', '首先', '此外', '同时', '相信在未来', '表现不错', '继续努力', '态度端正',
    '希望你继续保持', '宝贝', '闪闪发光', '令人欣慰', '让人眼前一亮', '潜力无限',
    '未来可期', '老师相信你', '成长的路上', '值得肯定'
  ];
  for (const word of banned) value = value.replaceAll(word, '');
  value = style === 'warm'
    ? value.replace(/[^\S\n]+/g, ' ').trim()
    : value.replace(/\s+/g, ' ').trim();
  const valueWithoutLeadingEmoji = value.replace(LEADING_FEEDBACK_EMOJI_PATTERN, '');
  if (name && !value.startsWith(name) && !valueWithoutLeadingEmoji.startsWith(name)) {
    value = `${name}：${value.replace(/^：|:/, '')}`;
  }
  const limit = style === 'warm' ? 160 : 120;
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const lastPunc = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'));
  return (lastPunc > 50 ? cut.slice(0, lastPunc + 1) : cut).trim();
}

function batchMaxTokens(studentCount, style) {
  const perStudent = style === 'warm' ? 280 : 150;
  return Math.min(8192, Math.max(600, 240 + Number(studentCount || 0) * perStudent));
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
