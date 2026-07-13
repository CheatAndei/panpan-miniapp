const crypto = require('node:crypto');

const EXTERNAL_STUDENT_ID_PATTERN = /^stu_[a-f0-9]{32}$/;

function createExternalStudentId() {
  return `stu_${crypto.randomBytes(16).toString('hex')}`;
}

function ensureStudentExternalId(db, studentId) {
  const current = db.get('SELECT external_id FROM students WHERE id=?', [studentId])?.external_id;
  if (EXTERNAL_STUDENT_ID_PATTERN.test(String(current || ''))) return current;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const externalId = createExternalStudentId();
    try {
      db.run('UPDATE students SET external_id=? WHERE id=?', [externalId, studentId]);
      return externalId;
    } catch (error) {
      if (!/UNIQUE/i.test(String(error?.message || error))) throw error;
    }
  }
  throw new Error('无法生成统一学生 ID');
}

function withExternalStudentId(student) {
  if (!student) return student;
  const { external_id: externalId, ...rest } = student;
  return { ...rest, external_student_id: externalId || '' };
}

function resolveTeacherStudentId(db, teacherId, submission) {
  const externalId = String(submission?.external_student_id || '').trim();
  const numericId = Number(submission?.student_id);
  if (externalId) {
    if (!EXTERNAL_STUDENT_ID_PATTERN.test(externalId)) return null;
    const student = db.get(`SELECT s.id FROM students s
      LEFT JOIN classes c ON c.id=s.class_id
      WHERE s.external_id=? AND COALESCE(s.teacher_id,c.teacher_id)=?`, [externalId, teacherId]);
    if (!student || (numericId > 0 && numericId !== Number(student.id))) return null;
    return Number(student.id);
  }
  return Number.isInteger(numericId) && numericId > 0 ? numericId : null;
}

module.exports = {
  EXTERNAL_STUDENT_ID_PATTERN,
  createExternalStudentId,
  ensureStudentExternalId,
  withExternalStudentId,
  resolveTeacherStudentId,
};
