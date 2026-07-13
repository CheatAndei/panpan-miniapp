const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');
const { teacherOwnsClass } = require('../utils/scope');

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  next();
}
function localDateString(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function deleteFeedbackForSession(db, session) {
  if (!session) return;
  db.run('DELETE FROM feedbacks WHERE teacher_id=? AND class_id=? AND class_date=?', [session.teacher_id, session.class_id, session.class_date]);
}

// 家长看全部课表（返回老师的所有班级，家长可区分自己的班级）
router.get('/parent', auth, (req, res) => {
  const db = getDB();
  const { student_id } = req.query;
  let teacher;
  if (student_id) {
    teacher = db.get(`SELECT COALESCE(s.teacher_id,c.teacher_id) as teacher_id
      FROM students s
      JOIN bindings b ON b.student_id=s.id
      LEFT JOIN classes c ON c.id=s.class_id
      WHERE b.parent_id=? AND s.id=?`, [req.user.id, student_id]);
  } else {
    teacher = db.get('SELECT c.teacher_id FROM students st JOIN classes c ON c.id=st.class_id JOIN bindings b ON b.student_id=st.id WHERE b.parent_id=? LIMIT 1', [req.user.id]);
  }
  if (!teacher) return res.json({ schedules: [], myClassIds: [] });
  const myClasses = student_id
    ? db.all('SELECT DISTINCT st.class_id FROM students st JOIN bindings b ON b.student_id=st.id WHERE b.parent_id=? AND st.id=?', [req.user.id, student_id])
    : db.all('SELECT DISTINCT st.class_id FROM students st JOIN bindings b ON b.student_id=st.id WHERE b.parent_id=?', [req.user.id]);
  const schedules = db.all('SELECT s.*, c.name as class_name, c.id as class_id, (SELECT COUNT(*) FROM students st WHERE st.class_id=c.id) as student_count FROM schedules s JOIN classes c ON c.id=s.class_id WHERE s.teacher_id=? AND s.is_active=1 ORDER BY s.day_of_week, s.start_time', [teacher.teacher_id]);
  const sessions = db.all('SELECT se.*, c.name as class_name, c.id as class_id, (SELECT COUNT(*) FROM students st WHERE st.class_id=c.id) as student_count FROM sessions se JOIN classes c ON c.id=se.class_id WHERE se.teacher_id=? AND se.status IN (?,?) AND se.class_date>=? ORDER BY se.class_date, se.start_time', [teacher.teacher_id, 'published', 'completed', localDateString()]);
  const sessionSchedules = sessions.map((se) => {
    const date = new Date(`${se.class_date}T00:00:00+08:00`);
    return {
      ...se,
      id: `session-${se.id}`,
      session_id: se.id,
      day_of_week: date.getDay(),
      title: se.title || se.class_name,
      source: 'session'
    };
  });
  res.json({ schedules: [...sessionSchedules, ...schedules], myClassIds: myClasses.map(c=>c.class_id) });
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
  const cls = db.get('SELECT name FROM classes WHERE id=? AND teacher_id=?', [class_id, req.user.id]);
  if (!cls) return res.status(403).json({ error: '无权操作该学习小组' });
  const title = cls.name;
  const r = db.run('INSERT INTO schedules (teacher_id,class_id,title,day_of_week,start_time,end_time,location) VALUES (?,?,?,?,?,?,?)', [req.user.id, class_id, title, day_of_week, start_time, end_time, location||'']);
  res.json({ ok: true, schedule: { id: r.lastInsertRowid, title, day_of_week, start_time, end_time, location } });
});

// 删除课表
router.delete('/:id', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const sessions = db.all('SELECT * FROM sessions WHERE schedule_id=? AND teacher_id=?', [req.params.id, req.user.id]);
  for (const se of sessions) deleteFeedbackForSession(db, se);
  db.run('DELETE FROM sessions WHERE schedule_id=? AND teacher_id=?', [req.params.id, req.user.id]);
  db.run('DELETE FROM schedules WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

async function notifyClasses(items) {
  const notify = { ok: true, total: 0, sent: 0, failed: 0, errors: [] };
  const unique = new Map();
  for (const item of items.filter(Boolean)) {
    const classId = typeof item === 'object' ? item.classId : item;
    if (!classId || unique.has(classId)) continue;
    unique.set(classId, typeof item === 'object' ? (item.note || '') : '');
  }
  for (const [classId, note] of unique.entries()) {
    try {
      const result = await require('./notify').notifyReminder(classId, note);
      notify.total += result?.total || 0;
      notify.sent += result?.sent || 0;
      notify.failed += result?.failed || 0;
      if (result?.error) notify.errors.push(result.error);
      if (result?.errors?.length) notify.errors.push(...result.errors);
    } catch(e) {
      notify.failed++;
      notify.errors.push(e.message);
    }
  }
  notify.ok = notify.sent > 0 && notify.failed === 0;
  return notify;
}

// 特殊发布：自定义日期时间
router.post('/special-publish', auth, teacherOnly, async (req, res) => {
  const { class_id, class_date, start_time, end_time, location } = req.body;
  if (!class_id || !class_date || !start_time || !end_time) return res.status(400).json({ error: '缺少信息' });
  const db = getDB();
  const cls = db.get('SELECT name FROM classes WHERE id=? AND teacher_id=?', [class_id, req.user.id]);
  if (!cls) return res.status(403).json({ error: '无权操作该学习小组' });
  const exists = db.get('SELECT id FROM sessions WHERE teacher_id=? AND class_id=? AND class_date=? AND start_time=?', [req.user.id, class_id, class_date, start_time]);
  if (exists) {
    return res.json({ ok: true, count: 0, skipped: 1, notify: { ok: false, total: 0, sent: 0, failed: 0, errors: [] }, message: '该时间已发布，已跳过重复课程' });
  }
  db.run('INSERT INTO sessions (teacher_id,class_id,title,class_date,start_time,end_time,status) VALUES (?,?,?,?,?,?,?)', [req.user.id, class_id, cls?.name||'特殊课程', class_date, start_time, end_time, 'published']);
  const notify = await notifyClasses([{ classId: class_id, note: location || '' }]);
  res.json({ ok: true, count: 1, skipped: 0, notify, message: '特殊发布成功' });
});

// 删除已发布的课程实例
router.delete('/sessions/:id', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const session = db.get('SELECT * FROM sessions WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  deleteFeedbackForSession(db, session);
  db.run('DELETE FROM sessions WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
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
  const sessions = db.all('SELECT se.*, c.name as class_name FROM sessions se LEFT JOIN classes c ON c.id=se.class_id WHERE se.teacher_id=? AND se.status=? AND se.class_date >= ? ORDER BY se.class_date', [req.user.id, 'published', localDateString()]);
  res.json({ sessions });
});

// 一键发布：根据课表计算本周末日期，创建 sessions
router.post('/publish', auth, teacherOnly, async (req, res) => {
  const db = getDB();
  const { ids } = req.body || {};
  const now = new Date();
  let count = 0;
  let skipped = 0;
  const publishedClasses = [];

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
    const dateStr = localDateString(target);

    const exists = db.get('SELECT id FROM sessions WHERE teacher_id=? AND schedule_id=? AND class_date=?', [req.user.id, sc.id, dateStr]);
    if (exists) { skipped++; continue; }

    db.run('INSERT INTO sessions (teacher_id,class_id,schedule_id,title,class_date,start_time,end_time) VALUES (?,?,?,?,?,?,?)', [req.user.id, sc.class_id, sc.id, sc.class_name||sc.title, dateStr, sc.start_time, sc.end_time]);
    publishedClasses.push({ classId: sc.class_id, note: sc.location || '' });
    count++;
  }

  const notify = count > 0 ? await notifyClasses(publishedClasses) : { ok: false, total: 0, sent: 0, failed: 0, errors: [] };
  res.json({ ok: true, count, skipped, notify });
});

module.exports = router;
