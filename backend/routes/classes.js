const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可操作' });
  next();
}

function parseJson(value, fallback = {}) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

router.get('/', auth, (req, res) => {
  const db = getDB();
  const classes = db.all(`SELECT c.*,
    (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id AND s.deleted_at IS NULL) AS student_count,
    (SELECT COUNT(*) FROM feedbacks f WHERE f.class_id=c.id) AS feedback_count,
    (SELECT COUNT(*) FROM practice_plans p WHERE p.class_id=c.id) AS practice_count
    FROM classes c WHERE c.teacher_id=? AND c.deleted_at IS NULL ORDER BY c.name`, [req.user.id]);
  res.json({ classes: classes.map(c => ({ ...c, studentCount: c.student_count })) });
});

router.post('/', auth, teacherOnly, (req, res) => {
  const { name, grade, subject } = req.body;
  if (!name) return res.status(400).json({ error: '缺少班级名称' });
  const r = getDB().run('INSERT INTO classes (teacher_id, name, grade, subject) VALUES (?,?,?,?)', [req.user.id, name, grade, subject]);
  res.json({ ok: true, class: { id: r.lastInsertRowid, name, grade, subject } });
});

router.get('/:id/history', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const cls = db.get('SELECT * FROM classes WHERE id=? AND teacher_id=? AND deleted_at IS NULL', [req.params.id, req.user.id]);
  if (!cls) return res.status(404).json({ error: '学习小组不存在' });
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const limit = Math.max(10, Math.min(50, Number.parseInt(req.query.limit || '30', 10) || 30));
  const timeline = [];
  db.all(`SELECT id,class_date,summary,homework,notes_pdf_url,created_at FROM feedbacks
    WHERE class_id=? AND teacher_id=?`, [cls.id, req.user.id]).forEach((item) => timeline.push({
    id: `feedback:${item.id}`, type: 'feedback', date: item.class_date, created_at: item.created_at,
    title: item.homework ? '课后反馈与专属清单' : (item.notes_pdf_url ? '学习笔记' : '课后反馈'),
    summary: item.summary || '', homework: item.homework || '', attachment_url: item.notes_pdf_url || '',
  }));
  db.all(`SELECT id,class_date,title,status,created_at FROM sessions
    WHERE class_id=? AND teacher_id=?`, [cls.id, req.user.id]).forEach((item) => timeline.push({
    id: `session:${item.id}`, type: 'session', date: item.class_date, created_at: item.created_at,
    title: item.title || '课程安排', summary: item.status === 'completed' ? '课程已完成' : '课程已发布',
  }));
  db.all(`SELECT id,title,start_date,end_date,status,created_at FROM practice_plans
    WHERE class_id=? AND teacher_id=?`, [cls.id, req.user.id]).forEach((item) => timeline.push({
    id: `practice:${item.id}`, type: 'practice', date: item.start_date, created_at: item.created_at,
    title: `打卡计划 · ${item.title}`, summary: `${item.start_date} 至 ${item.end_date}`,
  }));
  db.all(`SELECT id,title,subject,assigned_date,status,source_manifest,created_at FROM homework_batches
    WHERE class_id=? AND teacher_id=?`, [cls.id, req.user.id]).forEach((item) => timeline.push({
    id: `homework:${item.id}`, type: 'homework', date: item.assigned_date, created_at: item.created_at,
    title: `作业批改 · ${item.title}`, summary: `${item.subject || '数学'} · ${item.status === 'published' ? '已发布' : '已确认'}`,
    source: parseJson(item.source_manifest, {}),
  }));
  db.all(`SELECT t.id,t.student_id,s.name student_name,t.from_class_id,t.to_class_id,
    fc.name from_class_name,tc.name to_class_name,t.reason,t.transferred_at
    FROM student_class_transfers t JOIN students s ON s.id=t.student_id
    JOIN classes fc ON fc.id=t.from_class_id JOIN classes tc ON tc.id=t.to_class_id
    WHERE t.teacher_id=? AND (t.from_class_id=? OR t.to_class_id=?)`, [req.user.id, cls.id, cls.id]).forEach((item) => timeline.push({
    id: `transfer:${item.id}`, type: 'transfer', date: String(item.transferred_at || '').slice(0, 10), created_at: item.transferred_at,
    title: item.to_class_id === cls.id ? `${item.student_name} 转入` : `${item.student_name} 转出`,
    summary: `${item.from_class_name} → ${item.to_class_name}${item.reason ? ` · ${item.reason}` : ''}`,
  }));
  timeline.sort((left, right) => String(right.date || right.created_at).localeCompare(String(left.date || left.created_at))
    || String(right.created_at || '').localeCompare(String(left.created_at || '')));
  const total = timeline.length;
  const start = (page - 1) * limit;
  const students = db.all(`SELECT id,name,external_id,level FROM students
    WHERE class_id=? AND deleted_at IS NULL ORDER BY name`, [cls.id]);
  res.json({
    class: cls,
    students,
    summary: {
      student_count: students.length,
      feedback_count: timeline.filter((item) => item.type === 'feedback').length,
      practice_count: timeline.filter((item) => item.type === 'practice').length,
      homework_count: timeline.filter((item) => item.type === 'homework').length,
    },
    timeline: timeline.slice(start, start + limit),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

router.get('/:id', auth, (req, res) => {
  const db = getDB();
  const sql = req.user.role === 'teacher'
    ? 'SELECT * FROM classes WHERE id=? AND teacher_id=? AND deleted_at IS NULL'
    : `SELECT c.* FROM classes c JOIN students s ON s.class_id=c.id JOIN bindings b ON b.student_id=s.id
      WHERE c.id=? AND b.parent_id=? AND c.deleted_at IS NULL AND s.deleted_at IS NULL LIMIT 1`;
  const c = db.get(sql, [req.params.id, req.user.id]);
  res.json({ class: c || null });
});

router.put('/:id', auth, teacherOnly, (req, res) => {
  const { name, grade, subject } = req.body;
  getDB().run('UPDATE classes SET name=?, grade=?, subject=? WHERE id=? AND teacher_id=? AND deleted_at IS NULL', [name, grade, subject, req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.delete('/:id', auth, teacherOnly, (req, res) => {
  const db = getDB();
  const cls = db.get('SELECT id FROM classes WHERE id=? AND teacher_id=? AND deleted_at IS NULL', [req.params.id, req.user.id]);
  if (!cls) return res.status(404).json({ error: '学习小组不存在' });
  const studentCount = Number(db.get('SELECT COUNT(*) count FROM students WHERE class_id=? AND deleted_at IS NULL', [cls.id])?.count || 0);
  if (studentCount) return res.status(409).json({ error: `请先迁移该小组的 ${studentCount} 名学生，再删除学习小组` });
  db.transaction(() => {
    db.run('UPDATE classes SET deleted_at=CURRENT_TIMESTAMP WHERE id=? AND teacher_id=?', [cls.id, req.user.id]);
    db.run('UPDATE schedules SET is_active=0 WHERE class_id=? AND teacher_id=?', [cls.id, req.user.id]);
    db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
      VALUES(?,?,?,?,?)`, [req.user.id, 'class_archived', 'class', cls.id, JSON.stringify({ soft_delete: true })]);
  });
  res.json({ ok: true, archived: true });
});

module.exports = router;
