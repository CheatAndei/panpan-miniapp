const { syncWrongSources } = require('./learning');

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || '');
  } catch {
    return fallback;
  }
}

function number(value) {
  return Number(value || 0);
}

function ownedStudent(db, teacherId, studentId) {
  return db.get(`SELECT s.id,s.name,s.level,s.class_id,c.name class_name,c.grade,c.subject
    FROM students s JOIN classes c ON c.id=s.class_id
    WHERE s.id=? AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND c.teacher_id=?`, [
    studentId,
    teacherId,
  ]);
}

function latestDate(values) {
  return values.filter(Boolean).sort((left, right) => String(right).localeCompare(String(left)))[0] || '';
}

function studentStats(db, studentId) {
  const practice = db.get(`SELECT COUNT(i.id) total,
      SUM(CASE WHEN r.is_correct=0 THEN 1 ELSE 0 END) wrong,
      SUM(CASE WHEN r.is_correct=1 THEN 1 ELSE 0 END) correct,
      COUNT(DISTINCT a.practice_date) days,
      MAX(ps.submitted_at) latest_at
    FROM practice_submissions ps
    JOIN practice_assignments a ON a.id=ps.assignment_id
    JOIN practice_assignment_items i ON i.assignment_id=a.id
    LEFT JOIN practice_reviews r ON r.submission_id=ps.id AND r.assignment_item_id=i.id
    WHERE a.student_id=?`, [studentId]) || {};
  const choice = db.get(`SELECT COUNT(*) total,
      SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END) wrong,
      SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) correct,
      COUNT(DISTINCT question_id) distinct_total,
      MAX(answered_at) latest_at
    FROM choice_king_attempts WHERE student_id=? AND is_review=0`, [studentId]) || {};
  const mental = db.get(`SELECT COUNT(*) sessions,
      SUM(total_questions) total,
      SUM(total_questions-COALESCE(correct_count,0)) wrong,
      SUM(COALESCE(correct_count,0)) correct,
      MAX(completed_at) latest_at
    FROM mental_challenges WHERE student_id=? AND status='completed'`, [studentId]) || {};
  const learning = db.get(`SELECT COUNT(*) sessions,
      SUM(total_questions) total,
      SUM(total_questions-COALESCE(correct_count,0)) wrong,
      SUM(COALESCE(correct_count,0)) correct,
      MAX(completed_at) latest_at
    FROM learning_attempts WHERE student_id=? AND status='completed'`, [studentId]) || {};
  const knowledgeAttempts = db.all(`SELECT question_ids_json,correct_count,completed_at
    FROM knowledge_attempts WHERE student_id=? AND status='completed'`, [studentId]);
  const knowledge = knowledgeAttempts.reduce((result, item) => {
    const total = parseJson(item.question_ids_json, []).length;
    result.total += total;
    result.correct += number(item.correct_count);
    result.wrong += Math.max(0, total - number(item.correct_count));
    result.latest_at = latestDate([result.latest_at, item.completed_at]);
    return result;
  }, { total: 0, correct: 0, wrong: 0, latest_at: '' });

  const channels = {
    practice: {
      total: number(practice.total),
      correct: number(practice.correct),
      wrong: number(practice.wrong),
      days: number(practice.days),
    },
    choice: {
      total: number(choice.total),
      distinct_total: number(choice.distinct_total),
      correct: number(choice.correct),
      wrong: number(choice.wrong),
    },
    mental: {
      total: number(mental.total),
      correct: number(mental.correct),
      wrong: number(mental.wrong),
      sessions: number(mental.sessions),
    },
    learning: {
      total: number(learning.total),
      correct: number(learning.correct),
      wrong: number(learning.wrong),
      sessions: number(learning.sessions),
    },
    knowledge,
  };
  const total = Object.values(channels).reduce((sum, item) => sum + number(item.total), 0);
  const correct = Object.values(channels).reduce((sum, item) => sum + number(item.correct), 0);
  const wrong = Object.values(channels).reduce((sum, item) => sum + number(item.wrong), 0);
  const openWrong = number(db.get(`SELECT COUNT(*) count FROM wrong_item_progress
    WHERE student_id=? AND status='open'`, [studentId])?.count)
    + number(db.get(`SELECT COUNT(*) count FROM choice_king_wrong_progress
      WHERE student_id=? AND status='open'`, [studentId])?.count);

  return {
    total_questions: total,
    correct_questions: correct,
    wrong_questions: wrong,
    accuracy: total ? Math.round(correct / total * 100) : null,
    open_wrong_count: openWrong,
    latest_activity_at: latestDate([
      practice.latest_at,
      choice.latest_at,
      mental.latest_at,
      learning.latest_at,
      knowledge.latest_at,
    ]),
    channels,
  };
}

function studentQuestionBank(db, studentId) {
  syncWrongSources(db, studentId);
  const common = db.all(`SELECT id,source_type,source_id,module,question_type,
      snapshot_stem stem,snapshot_answer answer,status,total_attempts,created_at,last_attempt_at,mastered_at
    FROM wrong_item_progress WHERE student_id=?
    ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,
      COALESCE(last_attempt_at,created_at) DESC,id DESC LIMIT 120`, [studentId]).map((item) => ({
    ...item,
    id: `learning:${item.id}`,
    options: null,
    selected_answer: null,
  }));
  const choice = db.all(`SELECT p.id,p.status,p.review_attempts total_attempts,p.created_at,
      p.last_wrong_at last_attempt_at,p.mastered_at,q.id question_id,q.stem,q.options_json,
      q.correct_option answer,q.explanation,q.topic_key module,q.is_active,
      (SELECT a.selected_option FROM choice_king_attempts a
        WHERE a.student_id=p.student_id AND a.question_id=p.question_id
        ORDER BY a.answered_at DESC,a.id DESC LIMIT 1) selected_answer
    FROM choice_king_wrong_progress p JOIN choice_king_questions q ON q.id=p.question_id
    WHERE p.student_id=?
    ORDER BY CASE p.status WHEN 'open' THEN 0 ELSE 1 END,
      COALESCE(p.last_wrong_at,p.created_at) DESC,p.id DESC LIMIT 120`, [studentId]).map((item) => ({
    ...item,
    id: `choice:${item.id}`,
    source_type: 'choice_king',
    source_id: String(item.question_id),
    question_type: '选择题',
    options: parseJson(item.options_json, {}),
  }));
  const items = [...common, ...choice].sort((left, right) => {
    if (left.status !== right.status) return left.status === 'open' ? -1 : 1;
    return String(right.last_attempt_at || right.created_at || '').localeCompare(
      String(left.last_attempt_at || left.created_at || ''),
    );
  });
  return {
    items,
    summary: {
      total: items.length,
      open: items.filter((item) => item.status === 'open').length,
      mastered: items.filter((item) => item.status === 'mastered').length,
    },
  };
}

function teacherStudentRecords(db, { teacherId, classId }) {
  const params = [teacherId];
  let classFilter = '';
  if (classId) {
    classFilter = ' AND c.id=?';
    params.push(classId);
  }
  const students = db.all(`SELECT s.id,s.name,s.level,s.class_id,c.name class_name,c.grade,c.subject
    FROM students s JOIN classes c ON c.id=s.class_id
    WHERE s.deleted_at IS NULL AND c.deleted_at IS NULL AND c.teacher_id=?${classFilter}
    ORDER BY c.name,s.name`, params);
  return students.map((student) => {
    syncWrongSources(db, student.id);
    return { ...student, stats: studentStats(db, student.id) };
  });
}

function teacherStudentRecord(db, { teacherId, studentId }) {
  const student = ownedStudent(db, teacherId, studentId);
  if (!student) return null;
  const questionBank = studentQuestionBank(db, student.id);
  return {
    student,
    stats: studentStats(db, student.id),
    question_bank: questionBank,
  };
}

module.exports = {
  ownedStudent,
  studentStats,
  studentQuestionBank,
  teacherStudentRecords,
  teacherStudentRecord,
};
