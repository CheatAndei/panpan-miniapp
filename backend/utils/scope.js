function teacherOwnsClass(db, teacherId, classId) {
  if (!teacherId || !classId) return false;
  return !!db.get('SELECT 1 FROM classes WHERE id=? AND teacher_id=?', [classId, teacherId]);
}

function teacherOwnsStudent(db, teacherId, studentId) {
  if (!teacherId || !studentId) return false;
  return !!db.get(`SELECT 1
    FROM students s
    LEFT JOIN classes c ON c.id=s.class_id
    WHERE s.id=? AND COALESCE(s.teacher_id,c.teacher_id)=?`, [studentId, teacherId]);
}

function teacherOwnsSchedule(db, teacherId, scheduleId) {
  if (!teacherId || !scheduleId) return false;
  return !!db.get('SELECT 1 FROM schedules WHERE id=? AND teacher_id=?', [scheduleId, teacherId]);
}

function teacherOwnsSession(db, teacherId, sessionId) {
  if (!teacherId || !sessionId) return false;
  return !!db.get('SELECT 1 FROM sessions WHERE id=? AND teacher_id=?', [sessionId, teacherId]);
}

function parentBoundStudent(db, parentId, studentId) {
  if (!parentId || !studentId) return false;
  return !!db.get('SELECT 1 FROM bindings WHERE parent_id=? AND student_id=?', [parentId, studentId]);
}

function parentFeedbackBelongsToTeacher(db, teacherId, feedbackId) {
  if (!teacherId || !feedbackId) return false;
  return !!db.get(`SELECT 1
    FROM parent_feedbacks pf
    JOIN students s ON s.id=pf.student_id
    LEFT JOIN classes c ON c.id=s.class_id
    WHERE pf.id=? AND COALESCE(s.teacher_id,c.teacher_id)=?`, [feedbackId, teacherId]);
}

function leaveBelongsToTeacher(db, teacherId, leaveId) {
  if (!teacherId || !leaveId) return false;
  return !!db.get(`SELECT 1
    FROM leaves l
    JOIN students s ON s.id=l.student_id
    LEFT JOIN classes c ON c.id=s.class_id
    WHERE l.id=? AND COALESCE(s.teacher_id,c.teacher_id)=?`, [leaveId, teacherId]);
}

module.exports = {
  teacherOwnsClass,
  teacherOwnsStudent,
  teacherOwnsSchedule,
  teacherOwnsSession,
  parentBoundStudent,
  parentFeedbackBelongsToTeacher,
  leaveBelongsToTeacher
};
