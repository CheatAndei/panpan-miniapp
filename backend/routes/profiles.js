const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');
const { teacherOwnsStudent } = require('../utils/scope');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}

router.put('/:studentId', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { personality, strengths, weaknesses } = req.body;
  const db = getDB();
  if (!teacherOwnsStudent(db, req.user.id, req.params.studentId)) return res.status(403).json({ error: '无权操作该学生' });
  const existing = db.get('SELECT id FROM student_profiles WHERE student_id=?', [req.params.studentId]);
  if (existing) {
    db.run('UPDATE student_profiles SET personality=?,strengths=?,weaknesses=? WHERE student_id=?', [personality||'', strengths||'', weaknesses||'', req.params.studentId]);
  } else {
    db.run('INSERT INTO student_profiles (student_id,personality,strengths,weaknesses,tags) VALUES (?,?,?,?,?)', [req.params.studentId, personality||'', strengths||'', weaknesses||'', '[]']);
  }
  res.json({ ok: true });
});

router.get('/my', auth, (req, res) => {
  const p = getDB().get('SELECT * FROM student_profiles WHERE student_id=(SELECT student_id FROM bindings WHERE parent_id=? LIMIT 1)', [req.user.id]);
  if (!p) return res.json({ profile: null });
  try { p.tags = JSON.parse(p.tags||'[]'); } catch {}
  res.json({ profile: p });
});

router.get('/:studentId', auth, (req, res) => {
  const db = getDB();
  const allowed = req.user.role === 'teacher'
    ? teacherOwnsStudent(db, req.user.id, req.params.studentId)
    : db.get('SELECT 1 FROM bindings WHERE student_id=? AND parent_id=?', [req.params.studentId, req.user.id]);
  if (!allowed) return res.status(403).json({ error: '无权限' });
  const p = db.get('SELECT * FROM student_profiles WHERE student_id=?', [req.params.studentId]);
  if (!p) return res.json({ profile: null });
  try { p.tags = JSON.parse(p.tags||'[]'); } catch {}
  res.json({ profile: p });
});

router.post('/generate', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { studentId } = req.body;
  const db = getDB();
  const s = teacherOwnsStudent(db, req.user.id, studentId) ? db.get('SELECT * FROM students WHERE id=?', [studentId]) : null;
  if (!s) return res.status(404).json({ error: '学生不存在' });

  const prompt = `你是教育心理学家，为学生生成个性画像。
学生：${s.name}，成绩水平：${s.level||'未设定'}，性格描述：${s.personality||'无'}
请生成JSON：
{"tags":["标签1","标签2","标签3","标签4","标签5"],"personality":"像最了解TA的老师写给家长的信，150字，不说套话","strengths":"学习优势80字","weaknesses":"成长空间80字","suggestion":"给家长的具体建议80字"}
tags要有趣精准如"逻辑大师""暖心担当"，用孩子名字称呼。`;

  callAI(prompt).then(text => {
    try {
      const json = text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const result = JSON.parse(json);
      const existing = db.get('SELECT id FROM student_profiles WHERE student_id=?', [studentId]);
      if (existing) {
        db.run('UPDATE student_profiles SET tags=?,personality=?,strengths=?,weaknesses=?,suggestion=?,generated_at=CURRENT_TIMESTAMP WHERE student_id=?', [JSON.stringify(result.tags),result.personality,result.strengths,result.weaknesses,result.suggestion,studentId]);
      } else {
        db.run('INSERT INTO student_profiles (student_id,tags,personality,strengths,weaknesses,suggestion) VALUES (?,?,?,?,?,?)', [studentId,JSON.stringify(result.tags),result.personality,result.strengths,result.weaknesses,result.suggestion]);
      }
      res.json({ ok: true, profile: { ...result, student_id: studentId } });
    } catch(e) { res.status(500).json({ error: '解析失败' }); }
  }).catch(() => res.status(500).json({ error: '生成失败' }));
});

async function callAI(prompt) {
  const axios = require('axios');
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY is required');
  const { data } = await axios.post('https://api.deepseek.com/v1/chat/completions', {
    model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.8, max_tokens: 1000
  }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  return data.choices[0].message.content;
}

module.exports = router;
