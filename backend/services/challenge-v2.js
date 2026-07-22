const { normalizeGradeCode, normalizeSubjectCode } = require('../utils/content-dimensions');
const { practiceDateAt } = require('./practice');

const ACTIVE_STATUSES = ['active', 'submitted', 'reviewed_wrong'];
const TYPES = new Set(['fill', 'subjective']);

function fileUrl(token) { return token ? `/api/private-files/${token}` : null; }

function assignmentRow(db, assignmentId) {
  return db.get(`SELECT a.*,q.title,q.question_asset_id,q.answer_asset_id,q.answer_text,q.source_label,
    s.name student_name,c.name class_name,CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END teacher_id
    FROM challenge_assignments_v2 a JOIN weekly_challenge_questions q ON q.id=a.question_id
    JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE a.id=?`, [assignmentId]);
}

function submissionsForAssignment(db, assignmentId) {
  return db.all(`SELECT * FROM challenge_submissions_v2 WHERE assignment_id=? ORDER BY attempt_no,id`, [assignmentId]).map((submission) => ({
    ...submission,
    id: Number(submission.id),
    attempt_no: Number(submission.attempt_no),
    is_correct: submission.is_correct === null ? null : Boolean(submission.is_correct),
    attachments: db.all(`SELECT a.id,f.token,f.mime_type,f.byte_size FROM challenge_attachments_v2 a
      JOIN private_files f ON f.id=a.file_id WHERE a.submission_id=? ORDER BY a.created_at,a.id`, [submission.id])
      .map((item) => ({ ...item, id: Number(item.id), url: fileUrl(item.token) })),
  }));
}

function serializeAssignment(db, assignment, role = 'parent') {
  if (!assignment) return null;
  const submissions = submissionsForAssignment(db, assignment.id);
  const latest = submissions[submissions.length - 1] || null;
  return {
    id: Number(assignment.id),student_id:Number(assignment.student_id),student_name:assignment.student_name,
    class_name:assignment.class_name,question_type:assignment.question_type,status:assignment.status,
    grade_code:assignment.grade_code,subject_code:assignment.subject_code,title:assignment.title,
    source_label:assignment.source_label || '',assigned_on:assignment.assigned_on,
    question_url:`/api/weekly-challenge/assets/${assignment.question_asset_id}`,
    answer_url:role==='teacher'&&assignment.answer_asset_id?`/api/weekly-challenge/assets/${assignment.answer_asset_id}`:null,
    answer_text:role==='teacher'?assignment.answer_text:undefined,
    submission:latest,submissions:role==='teacher'?submissions:undefined,
  };
}

function currentAssignment(db, { studentId, gradeCode, subjectCode, questionType }) {
  const grade=normalizeGradeCode(gradeCode);const subject=normalizeSubjectCode(subjectCode);
  const params=[studentId,grade,subject];
  let typeSql='';
  if(questionType&&TYPES.has(questionType)){typeSql=' AND question_type=?';params.push(questionType);}
  return db.get(`SELECT id FROM challenge_assignments_v2 WHERE student_id=? AND grade_code=? AND subject_code=?
    AND status IN ('active','submitted','reviewed_wrong')${typeSql} ORDER BY id DESC LIMIT 1`,params);
}

function availableCounts(db,{studentId,gradeCode,subjectCode}){
  const grade=normalizeGradeCode(gradeCode);const subject=normalizeSubjectCode(subjectCode);
  const rows=db.all(`SELECT q.question_type,COUNT(*) count FROM weekly_challenge_questions q
    WHERE q.grade_code=? AND q.subject_code=? AND q.is_active=1 AND q.question_type IN ('fill','subjective')
      AND NOT EXISTS(SELECT 1 FROM challenge_assignments_v2 a WHERE a.student_id=? AND a.question_id=q.id AND a.status='passed')
    GROUP BY q.question_type`,[grade,subject,studentId]);
  return Object.fromEntries(rows.map(item=>[item.question_type,Number(item.count)]));
}

function progress(db,{studentId,gradeCode,subjectCode}){
  const grade=normalizeGradeCode(gradeCode);const subject=normalizeSubjectCode(subjectCode);
  const rows=db.all(`SELECT question_type,passed_count FROM challenge_progress_v2
    WHERE student_id=? AND grade_code=? AND subject_code=?`,[studentId,grade,subject]);
  return Object.fromEntries(rows.map(item=>[item.question_type,Number(item.passed_count)]));
}

function currentState(db,{studentId,gradeCode='g7',subjectCode='math'}){
  const grade=normalizeGradeCode(gradeCode);const subject=normalizeSubjectCode(subjectCode);
  const current=currentAssignment(db,{studentId,gradeCode:grade,subjectCode:subject});
  const lastPassed=db.get(`SELECT id FROM challenge_assignments_v2 WHERE student_id=? AND grade_code=? AND subject_code=?
    AND status='passed' ORDER BY updated_at DESC,id DESC LIMIT 1`,[studentId,grade,subject]);
  const today=practiceDateAt(new Date());
  const changedToday=Number(db.get(`SELECT COUNT(*) count FROM challenge_assignments_v2 WHERE student_id=? AND grade_code=?
    AND subject_code=? AND status='replaced' AND assigned_on=?`,[studentId,grade,subject,today])?.count||0);
  const serialized=current?serializeAssignment(db,assignmentRow(db,current.id),'parent'):null;
  return {
    grade_code:grade,subject_code:subject,assignment:serialized,
    last_passed:!serialized&&lastPassed?serializeAssignment(db,assignmentRow(db,lastPassed.id),'parent'):null,
    available:availableCounts(db,{studentId,gradeCode:grade,subjectCode:subject}),
    progress:progress(db,{studentId,gradeCode:grade,subjectCode:subject}),
    can_change:Boolean(serialized&&serialized.status==='active'&&!serialized.submission&&changedToday<1),
    change_remaining:Math.max(0,1-changedToday),
  };
}

function pickQuestion(db,{studentId,grade,subject,questionType,excludeId=0}){
  return db.get(`SELECT q.id FROM weekly_challenge_questions q WHERE q.grade_code=? AND q.subject_code=?
    AND q.question_type=? AND q.is_active=1 AND q.id<>?
    AND NOT EXISTS(SELECT 1 FROM challenge_assignments_v2 a WHERE a.student_id=? AND a.question_id=q.id AND a.status='passed')
    ORDER BY RANDOM() LIMIT 1`,[grade,subject,questionType,excludeId,studentId]);
}

function createAssignment(db,{studentId,gradeCode='g7',subjectCode='math',questionType}){
  const grade=normalizeGradeCode(gradeCode);const subject=normalizeSubjectCode(subjectCode);
  if(!TYPES.has(questionType))throw new Error('压轴挑战只可选择填空题或解答题');
  const existing=currentAssignment(db,{studentId,gradeCode:grade,subjectCode:subject,questionType});
  if(existing)return serializeAssignment(db,assignmentRow(db,existing.id),'parent');
  const question=pickQuestion(db,{studentId,grade,subject,questionType});
  if(!question)throw new Error('该题型已全部通关，等待老师补充新题');
  const created=db.run(`INSERT INTO challenge_assignments_v2
    (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
    VALUES(?,?,?,?,?,'active',?)`,[studentId,question.id,grade,subject,questionType,practiceDateAt(new Date())]);
  return serializeAssignment(db,assignmentRow(db,created.lastInsertRowid),'parent');
}

function changeAssignment(db,{studentId,assignmentId}){
  const current=assignmentRow(db,assignmentId);
  if(!current||Number(current.student_id)!==Number(studentId))throw new Error('挑战不存在');
  if(current.status!=='active'||submissionsForAssignment(db,current.id).length)throw new Error('提交后不能更换题目');
  const today=practiceDateAt(new Date());
  const changed=Number(db.get(`SELECT COUNT(*) count FROM challenge_assignments_v2 WHERE student_id=? AND grade_code=?
    AND subject_code=? AND status='replaced' AND assigned_on=?`,[studentId,current.grade_code,current.subject_code,today])?.count||0);
  if(changed>=1)throw new Error('今天已经更换过 1 次题目');
  const question=pickQuestion(db,{studentId,grade:current.grade_code,subject:current.subject_code,questionType:current.question_type,excludeId:current.question_id});
  if(!question)throw new Error('没有其他可更换的题目');
  let nextId=0;
  db.transaction(()=>{
    db.run("UPDATE challenge_assignments_v2 SET status='replaced',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'",[current.id]);
    const created=db.run(`INSERT INTO challenge_assignments_v2
      (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on)
      VALUES(?,?,?,?,?,'active',?)`,[studentId,question.id,current.grade_code,current.subject_code,current.question_type,today]);
    nextId=created.lastInsertRowid;
    db.run('UPDATE challenge_assignments_v2 SET replaced_by_id=? WHERE id=?',[nextId,current.id]);
  });
  return serializeAssignment(db,assignmentRow(db,nextId),'parent');
}

function refreshProgress(db,assignment){
  const count=Number(db.get(`SELECT COUNT(*) count FROM challenge_assignments_v2 WHERE student_id=? AND grade_code=?
    AND subject_code=? AND question_type=? AND status='passed'`,[assignment.student_id,assignment.grade_code,assignment.subject_code,assignment.question_type])?.count||0);
  db.run(`INSERT INTO challenge_progress_v2(student_id,grade_code,subject_code,question_type,passed_count,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(student_id,grade_code,subject_code,question_type)
    DO UPDATE SET passed_count=excluded.passed_count,updated_at=CURRENT_TIMESTAMP`,[assignment.student_id,assignment.grade_code,assignment.subject_code,assignment.question_type,count]);
  return count;
}

function teacherQueue(db,{teacherId,status='submitted',limit=100}){
  const clause=status==='all'?'':` AND sub.status='${status==='reviewed'?'reviewed':'submitted'}'`;
  const ids=db.all(`SELECT sub.id FROM challenge_submissions_v2 sub JOIN challenge_assignments_v2 a ON a.id=sub.assignment_id
    JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?${clause}
    ORDER BY CASE sub.status WHEN 'submitted' THEN 0 ELSE 1 END,sub.submitted_at ASC,sub.id ASC LIMIT ?`,[teacherId,Math.max(1,Math.min(100,Number(limit)||100))]);
  return ids.map(({id})=>{
    const submission=db.get('SELECT assignment_id FROM challenge_submissions_v2 WHERE id=?',[id]);
    const item=serializeAssignment(db,assignmentRow(db,submission.assignment_id),'teacher');
    item.submission=item.submissions.find(entry=>Number(entry.id)===Number(id));
    return item;
  });
}

function reviewSubmission(db,{teacherId,submissionId,isCorrect,teacherNote}){
  const submission=db.get(`SELECT sub.*,a.student_id,a.grade_code,a.subject_code,a.question_type,a.id assignment_id
    FROM challenge_submissions_v2 sub JOIN challenge_assignments_v2 a ON a.id=sub.assignment_id WHERE sub.id=?`,[submissionId]);
  if(!submission)return null;
  const owner=db.get(`SELECT s.id FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=? AND CASE WHEN c.id IS NOT NULL THEN c.teacher_id ELSE s.teacher_id END=?`,[submission.student_id,teacherId]);
  if(!owner)return null;
  db.transaction(()=>{
    db.run(`UPDATE challenge_submissions_v2 SET status='reviewed',is_correct=?,teacher_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?`,
      [isCorrect?1:0,String(teacherNote||'').trim().slice(0,500),teacherId,submission.id]);
    db.run(`UPDATE challenge_assignments_v2 SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[isCorrect?'passed':'reviewed_wrong',submission.assignment_id]);
    refreshProgress(db,submission);
  });
  return {assignment_id:Number(submission.assignment_id),is_correct:Boolean(isCorrect)};
}

module.exports={
  TYPES,ACTIVE_STATUSES,assignmentRow,serializeAssignment,submissionsForAssignment,currentState,
  createAssignment,changeAssignment,teacherQueue,reviewSubmission,refreshProgress,
};
