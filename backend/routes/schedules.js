const express = require('express');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/init');
const router = express.Router();
const { JWT_SECRET } = require('../config');

function auth(req, res, next) {
  try { req.user = jwt.verify((req.headers.authorization||'').split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] }); next(); }
  catch { res.status(401).json({ error: '登录过期' }); }
}
function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  next();
}

// 家长看全部课表（返回老师的所有班级，家长可区分自己的班级）
router.get('/parent', auth, (req, res) => {
  const db = getDB();
  const teacher = db.get('SELECT c.teacher_id FROM students st JOIN classes c ON c.id=st.class_id JOIN bindings b ON b.student_id=st.id WHERE b.parent_id=? LIMIT 1', [req.user.id]);
  if (!teacher) return res.json({ schedules: [], myClassIds: [] });
  const myClasses = db.all('SELECT DISTINCT st.class_id FROM students st JOIN bindings b ON b.student_id=st.id WHERE b.parent_id=?', [req.user.id]);
  const schedules = db.all('SELECT s.*, c.name as class_name, c.id as class_id, (SELECT COUNT(*) FROM students st WHERE st.class_id=c.id) as student_count FROM schedules s JOIN classes c ON c.id=s.class_id WHERE s.teacher_id=? AND s.is_active=1 ORDER BY s.day_of_week, s.start_time', [teacher.teacher_id]);
  res.json({ schedules, myClassIds: myClasses.map(c=>c.class_id) });
});

// 获取老师的所有课表
router.get('/', auth, (req, res) => {
  const db = getDB();
  const schedules = db.all('SELECT s.*, c.name as class_name, c.subject FROM schedules s LEFT JOIN classes c ON c.id=s.class_id WHERE s.teacher_id=? ORDER BY s.day_of_week, s.start_time', [req.user.id]);
  res.json({ schedules });
});

// 添加课表
router.post('/', auth, teacherOnly, (req, res) => {
  const { class_id, day_of_week, start_time, end_time, location } = req.body;
  if (day_of_week===undefined || !start_time || !end_time) return res.status(400).json({ error: '请填写完整' });
  const db = getDB();
  // 用班级名作 title
  const cls = db.get('SELECT name FROM classes WHERE id=?', [class_id]);
  const title = cls ? cls.name : '未命名';
  const r = db.run('INSERT INTO schedules (teacher_id,class_id,title,day_of_week,start_time,end_time,location) VALUES (?,?,?,?,?,?,?)', [req.user.id, class_id, title, day_of_week, start_time, end_time, location||'']);
  res.json({ ok: true, schedule: { id: r.lastInsertRowid, title, day_of_week, start_time, end_time, location } });
});

// 删除课表
router.delete('/:id', auth, teacherOnly, (req, res) => {
  getDB().run('DELETE FROM schedules WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// 特殊发布：自定义日期时间
router.post('/special-publish', auth, teacherOnly, (req, res) => {
  const { class_id, class_date, start_time, end_time, location } = req.body;
  if (!class_id || !class_date || !start_time || !end_time) return res.status(400).json({ error: '缺少信息' });
  const db = getDB();
  const cls = db.get('SELECT name FROM classes WHERE id=?', [class_id]);
  db.run('INSERT INTO sessions (teacher_id,class_id,title,class_date,start_time,end_time,status) VALUES (?,?,?,?,?,?,?)', [req.user.id, class_id, cls?.name||'特殊课程', class_date, start_time, end_time, 'published']);
  res.json({ ok: true, message: '特殊发布成功' });
});

// 删除已发布的课程实例
router.delete('/sessions/:id', auth, teacherOnly, (req, res) => {
  getDB().run('DELETE FROM sessions WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// 标记课程完成/已反馈
router.put('/sessions/:id/complete', auth, teacherOnly, (req, res) => {
  getDB().run('UPDATE sessions SET status=? WHERE id=? AND teacher_id=?', [req.body.status||'completed', req.params.id, req.user.id]);
  res.json({ ok: true });
});

// 获取已完成的课程（反馈用）
router.get('/sessions/completed', auth, (req, res) => {
  const db = getDB();
  const sessions = db.all('SELECT se.*, c.name as class_name FROM sessions se LEFT JOIN classes c ON c.id=se.class_id WHERE se.teacher_id=? AND se.status=? ORDER BY se.class_date DESC LIMIT 20', [req.user.id, 'completed']);
  res.json({ sessions });
});

// 获取已发布的课程实例（签到用：只显示未完成的）
router.get('/sessions', auth, (req, res) => {
  const db = getDB();
  const sessions = db.all('SELECT se.*, c.name as class_name FROM sessions se LEFT JOIN classes c ON c.id=se.class_id WHERE se.teacher_id=? AND se.status=? AND se.class_date >= date("now") ORDER BY se.class_date', [req.user.id, 'published']);
  res.json({ sessions });
});

// 一键发布：根据课表计算本周末日期，创建 sessions
router.post('/publish', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const { ids } = req.body || {};
  const now = new Date();
  let count = 0;

  // 获取要发布的课表（指定 ids 或全部）
  let schedules;
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    schedules = db.all(`SELECT s.*, c.name as class_name FROM schedules s LEFT JOIN classes c ON c.id=s.class_id WHERE s.teacher_id=? AND s.id IN (${placeholders})`, [req.user.id, ...ids]);
  } else {
    schedules = db.all('SELECT s.*, c.name as class_name FROM schedules s LEFT JOIN classes c ON c.id=s.class_id WHERE s.teacher_id=?', [req.user.id]);
  }
  if (schedules.length === 0) return res.status(400).json({ error: '没有可发布的课程' });

  for (const sc of schedules) {
    const today = now.getDay();
    let diff = sc.day_of_week - today;
    if (diff < 0) diff += 7;
    const target = new Date(now);
    target.setDate(target.getDate() + diff);
    const dateStr = target.toISOString().slice(0, 10);

    const exists = db.get('SELECT id FROM sessions WHERE schedule_id=? AND class_date=?', [sc.id, dateStr]);
    if (exists) continue;

    db.run('INSERT INTO sessions (teacher_id,class_id,schedule_id,title,class_date,start_time,end_time) VALUES (?,?,?,?,?,?,?)', [req.user.id, sc.class_id, sc.id, sc.class_name||sc.title, dateStr, sc.start_time, sc.end_time]);
    count++;
  }

  // 清空旧反馈
  db.run('DELETE FROM feedbacks WHERE teacher_id=?', [req.user.id]);
  for (const sc of schedules) { try { require('./notify').notifyReminder(sc.class_id); } catch(e) {} }
  res.json({ ok: true, count });
});

module.exports = router;
