const express = require('express');
const { getDB } = require('../db/init');
const router = express.Router();
const { authRequired: auth } = require('../middleware/auth');
const { createExternalStudentId, withExternalStudentId } = require('../utils/student-identity');

function shanghaiDate() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(db) {
  let code;
  do { code = ''; for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)]; }
  while (db.get('SELECT id FROM students WHERE invite_code=?', [code]));
  return code;
}

router.get('/', auth, (req, res) => {
  const db = getDB();
  const { class_id } = req.query;
  if (req.user.role === 'parent') {
    if (class_id) {
      // 家长只能查看自己已绑定孩子所在班级的学生
      const allowed = db.get('SELECT 1 FROM bindings b JOIN students bs ON bs.id=b.student_id WHERE b.parent_id=? AND bs.class_id=?', [req.user.id, class_id]);
      if (!allowed) return res.status(403).json({ error: '无权限' });
      const students = db.all('SELECT s.id, s.name, s.class_id FROM students s WHERE s.class_id=? ORDER BY s.name', [class_id]);
      return res.json({ students: students.map(withExternalStudentId) });
    }
    // 查自己的绑定
    const students = db.all('SELECT DISTINCT s.* FROM students s JOIN bindings b ON b.student_id=s.id WHERE b.parent_id=? ORDER BY s.name', [req.user.id]);
    return res.json({ students: students.map(withExternalStudentId) });
  }
  let sql = `SELECT s.*,
    (SELECT COUNT(*) FROM bindings b WHERE b.student_id=s.id) AS parent_count,
    (SELECT GROUP_CONCAT(COALESCE(NULLIF(u.nickname,''),'家长'), '、') FROM bindings b JOIN users u ON u.id=b.parent_id WHERE b.student_id=s.id) AS parent_names
    FROM students s JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=? AND c.deleted_at IS NULL`;
  const params = [req.user.id];
  if (class_id) { sql += ' AND s.class_id=?'; params.push(class_id); }
  sql += ' ORDER BY s.name';
  res.json({ students: db.all(sql, params).map(withExternalStudentId) });
});

router.post('/', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { class_id, name, level, personality, gender } = req.body;
  if (!name || !class_id) return res.status(400).json({ error: '缺少信息' });
  const db = getDB();
  const cls = db.get('SELECT id FROM classes WHERE id=? AND teacher_id=? AND deleted_at IS NULL', [class_id, req.user.id]);
  if (!cls) return res.status(403).json({ error: '无权限' });
  const code = genCode(db);
  const externalStudentId = createExternalStudentId();
  const r = db.run('INSERT INTO students (teacher_id, class_id, name, level, personality, gender, invite_code, external_id) VALUES (?,?,?,?,?,?,?,?)', [req.user.id, class_id, name, level||'', personality||'', gender||'boy', code, externalStudentId]);
  db.run('INSERT OR IGNORE INTO class_students(class_id,student_id) VALUES(?,?)', [class_id, r.lastInsertRowid]);
  res.json({ ok: true, student: { id: r.lastInsertRowid, external_student_id: externalStudentId, name, level, personality, invite_code: code } });
});

router.post('/:id/transfer', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '仅教师可迁移学生' });
  const db = getDB();
  const studentId = Number(req.params.id);
  const targetClassId = Number(req.body?.target_class_id);
  const reason = String(req.body?.reason || '').trim().slice(0, 120);
  const student = db.get(`SELECT s.*,c.name class_name,c.teacher_id class_teacher_id
    FROM students s JOIN classes c ON c.id=s.class_id
    WHERE s.id=? AND COALESCE(s.teacher_id,c.teacher_id)=? AND c.deleted_at IS NULL`, [studentId, req.user.id]);
  if (!student) return res.status(404).json({ error: '学生不存在' });
  const target = db.get(`SELECT * FROM classes WHERE id=? AND teacher_id=? AND deleted_at IS NULL`, [targetClassId, req.user.id]);
  if (!target) return res.status(404).json({ error: '目标学习小组不存在' });
  if (Number(student.class_id) === Number(target.id)) return res.status(400).json({ error: '学生已经在该学习小组' });
  const today = shanghaiDate();
  const futureAssignments = db.all(`SELECT a.id FROM practice_assignments a
    JOIN practice_plans p ON p.id=a.plan_id
    LEFT JOIN practice_submissions ps ON ps.assignment_id=a.id
    WHERE a.student_id=? AND p.class_id=? AND a.practice_date>=?
      AND a.claimed_at IS NULL AND ps.id IS NULL`, [student.id, student.class_id, today]);
  db.transaction(() => {
    if (futureAssignments.length) {
      const placeholders = futureAssignments.map(() => '?').join(',');
      const ids = futureAssignments.map((item) => item.id);
      db.run(`DELETE FROM practice_assignment_items WHERE assignment_id IN (${placeholders})`, ids);
      db.run(`DELETE FROM practice_assignments WHERE id IN (${placeholders})`, ids);
    }
    db.run('UPDATE students SET class_id=?,teacher_id=? WHERE id=?', [target.id, req.user.id, student.id]);
    db.run('DELETE FROM class_students WHERE student_id=?', [student.id]);
    db.run('INSERT OR IGNORE INTO class_students(class_id,student_id) VALUES(?,?)', [target.id, student.id]);
    const transfer = db.run(`INSERT INTO student_class_transfers
      (student_id,teacher_id,from_class_id,to_class_id,reason) VALUES(?,?,?,?,?)`, [
      student.id, req.user.id, student.class_id, target.id, reason,
    ]);
    db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
      VALUES(?,?,?,?,?)`, [req.user.id, 'student_class_transferred', 'student', student.id, JSON.stringify({
      transfer_id: transfer.lastInsertRowid,
      from_class_id: student.class_id,
      to_class_id: target.id,
      removed_future_assignments: futureAssignments.length,
      reason,
    })]);
  });
  res.json({
    ok: true,
    student: { id: student.id, name: student.name, class_id: target.id, class_name: target.name },
    from_class: { id: student.class_id, name: student.class_name },
    to_class: { id: target.id, name: target.name },
    removed_future_assignments: futureAssignments.length,
  });
});

router.get('/:id', auth, (req, res) => {
  const db = getDB();
  const sql = req.user.role === 'teacher'
    ? `SELECT s.*, c.name as class_name,
      (SELECT COUNT(*) FROM bindings b WHERE b.student_id=s.id) AS parent_count,
      (SELECT GROUP_CONCAT(COALESCE(NULLIF(u.nickname,''),'家长'), '、') FROM bindings b JOIN users u ON u.id=b.parent_id WHERE b.student_id=s.id) AS parent_names
      FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=? AND c.teacher_id=?`
    : 'SELECT s.*, c.name as class_name FROM students s JOIN bindings b ON b.student_id=s.id LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=? AND b.parent_id=?';
  const s = db.get(sql, [req.params.id, req.user.id]);
  res.json({ student: withExternalStudentId(s) || null });
});

router.put('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const { personality, level, name } = req.body;
  const result = getDB().run('UPDATE students SET personality=COALESCE(?,personality), level=COALESCE(?,level), name=COALESCE(?,name) WHERE id=? AND class_id IN (SELECT id FROM classes WHERE teacher_id=?)', [personality||null, level||null, name||null, req.params.id, req.user.id]);
  if (result.changes === 0) return res.status(404).json({ error: '学生不存在' });
  res.json({ ok: true });
});

router.delete('/:id', auth, (req, res) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: '无权限' });
  const db = getDB();
  const owned = db.get('SELECT id FROM students WHERE id=? AND class_id IN (SELECT id FROM classes WHERE teacher_id=?)', [req.params.id, req.user.id]);
  if (!owned) return res.status(404).json({ error: '学生不存在' });
  const dependency = db.get(`SELECT
    EXISTS(SELECT 1 FROM bindings WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM class_students WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM checkins WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM leaves WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM parent_feedbacks WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM student_profiles WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM homework_submissions WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM wrong_questions WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM point_ledger WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM practice_assignments WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM private_files WHERE student_id=?) OR
    EXISTS(SELECT 1 FROM mental_challenges WHERE student_id=?) AS found`, Array(12).fill(req.params.id));
  if (Number(dependency?.found)) return res.status(409).json({ error: '该学生已有绑定或学习历史，不能删除；可修改姓名或停止后续计划' });
  const result = db.run('DELETE FROM students WHERE id=? AND class_id IN (SELECT id FROM classes WHERE teacher_id=?)', [req.params.id, req.user.id]);
  if (result.changes === 0) return res.status(404).json({ error: '学生不存在' });
  res.json({ ok: true });
});

module.exports = router;
