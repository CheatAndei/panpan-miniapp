const { ownedStudent } = require('./student-learning-records');

function clampPage(value) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function clampLimit(value) {
  return Math.max(1, Math.min(50, Number.parseInt(value, 10) || 20));
}

function submissionUnion() {
  return `
    SELECT 'homework' source_type,CAST(hs.id AS TEXT) source_id,
      COALESCE(hb.title,'作业提交') title,COALESCE(hb.subject,'作业批改') subtitle,
      hs.grading_status status,hs.created_at occurred_at,
      (SELECT COUNT(*) FROM homework_answers ha WHERE ha.submission_id=hs.id) question_count,
      (SELECT COUNT(*) FROM homework_answers ha WHERE ha.submission_id=hs.id AND ha.is_correct=1) correct_count,
      0 photo_count,hs.overall_comment detail,0 route_id
    FROM homework_submissions hs LEFT JOIN homework_batches hb ON hb.id=hs.batch_id
    WHERE hs.student_id=?
    UNION ALL
    SELECT 'practice',CAST(ps.id AS TEXT),COALESCE(pp.title,'每日打卡'),
      '每日打卡 · '||COALESCE(pa.practice_date,''),ps.status,ps.submitted_at,
      (SELECT COUNT(*) FROM practice_assignment_items pai WHERE pai.assignment_id=pa.id),
      (SELECT COUNT(*) FROM practice_reviews pr WHERE pr.submission_id=ps.id AND pr.is_correct=1),
      (SELECT COUNT(*) FROM practice_attachments patt WHERE patt.submission_id=ps.id),
      ps.teacher_note,pa.plan_id
    FROM practice_submissions ps JOIN practice_assignments pa ON pa.id=ps.assignment_id
    LEFT JOIN practice_plans pp ON pp.id=pa.plan_id WHERE pa.student_id=?
    UNION ALL
    SELECT 'challenge',CAST(cs.id AS TEXT),COALESCE(wq.title,'压轴挑战'),
      '压轴挑战 · '||CASE ca.question_type WHEN 'fill' THEN '填空题' ELSE '解答题' END,
      cs.status,cs.submitted_at,1,CASE WHEN cs.is_correct=1 THEN 1 ELSE 0 END,
      (SELECT COUNT(*) FROM challenge_attachments_v2 catt WHERE catt.submission_id=cs.id),
      COALESCE(cs.teacher_note,cs.student_note),ca.id
    FROM challenge_submissions_v2 cs JOIN challenge_assignments_v2 ca ON ca.id=cs.assignment_id
    JOIN weekly_challenge_questions wq ON wq.id=ca.question_id WHERE ca.student_id=?
    UNION ALL
    SELECT 'weekend_mastery',CAST(ws.id AS TEXT),COALESCE(wmq.title,wms.title,'周末攻坚战'),
      '周末攻坚战 · 第'||wma.stage||'关',ws.status,COALESCE(ws.submitted_at,ws.created_at),
      1,CASE WHEN ws.is_correct=1 THEN 1 ELSE 0 END,
      (SELECT COUNT(*) FROM weekend_mastery_attachments watt WHERE watt.submission_id=ws.id),
      COALESCE(ws.teacher_note,ws.student_note),wma.id
    FROM weekend_mastery_submissions ws JOIN weekend_mastery_assignments wma ON wma.id=ws.assignment_id
    JOIN weekend_mastery_questions wmq ON wmq.id=wma.question_id
    JOIN weekend_mastery_sets wms ON wms.id=wma.set_id
    WHERE wma.student_id=? AND ws.status<>'draft'
    UNION ALL
    SELECT 'choice',substr(cka.answered_at,1,10),'选择题王',
      substr(cka.answered_at,1,10)||' 当日答题','completed',MAX(cka.answered_at),
      COUNT(*),SUM(CASE WHEN cka.is_correct=1 THEN 1 ELSE 0 END),0,NULL,0
    FROM choice_king_attempts cka WHERE cka.student_id=?
    GROUP BY substr(cka.answered_at,1,10)
    UNION ALL
    SELECT 'mental',CAST(mc.id AS TEXT),'口算王',
      CASE mc.battle WHEN 'primary' THEN '小学口算挑战' ELSE '初中口算挑战' END,
      mc.status,COALESCE(mc.completed_at,mc.started_at),mc.total_questions,mc.correct_count,0,
      CASE WHEN mc.elapsed_seconds IS NULL THEN NULL ELSE '用时 '||mc.elapsed_seconds||' 秒' END,0
    FROM mental_challenges mc WHERE mc.student_id=? AND mc.status='completed'
    UNION ALL
    SELECT 'learning',CAST(la.id AS TEXT),COALESCE(la.task_title,'学习中心任务'),
      '学习中心 · '||COALESCE(la.logical_date,''),la.status,COALESCE(la.completed_at,la.started_at),
      la.total_questions,la.correct_count,0,NULL,0
    FROM learning_attempts la WHERE la.student_id=? AND la.status='completed'
    UNION ALL
    SELECT 'knowledge',CAST(ka.id AS TEXT),COALESCE(kt.title,'知识闯关'),
      COALESCE(kt.chapter_name,'知识点练习'),ka.status,COALESCE(ka.completed_at,ka.started_at),
      CASE WHEN ka.question_ids_json='[]' THEN 0
        ELSE LENGTH(ka.question_ids_json)-LENGTH(REPLACE(ka.question_ids_json,',',''))+1 END,
      ka.correct_count,0,NULL,0
    FROM knowledge_attempts ka LEFT JOIN knowledge_topics kt ON kt.topic_key=ka.topic_key
    WHERE ka.student_id=? AND ka.status='completed'`;
}

function reportUnion() {
  return `
    SELECT 'choice_report' source_type,CAST(r.id AS TEXT) source_id,'选择题报错' title,
      COALESCE(q.source_label,'选择题王') subtitle,r.status,r.created_at occurred_at,
      1 question_count,0 correct_count,0 photo_count,COALESCE(r.detail,r.teacher_note) detail,0 route_id
    FROM choice_king_reports r JOIN choice_king_questions q ON q.id=r.question_id
    WHERE r.student_id=?
    UNION ALL
    SELECT 'calculation_report',CAST(r.id AS TEXT),'计算题报错',COALESCE(r.source_label,'计算练习'),
      r.status,r.created_at,1,0,0,COALESCE(r.detail,r.teacher_note),0
    FROM calculation_question_reports r WHERE r.student_id=?`;
}

function queryArchive(db, { studentId, kind, page, limit }) {
  const isReports = kind === 'reports';
  const union = isReports ? reportUnion() : submissionUnion();
  const params = isReports ? [studentId, studentId] : Array(8).fill(studentId);
  const total = Number(db.get(`SELECT COUNT(*) count FROM (${union}) archive`, params)?.count || 0);
  const offset = (page - 1) * limit;
  const items = db.all(`SELECT * FROM (${union}) archive
    ORDER BY datetime(occurred_at) DESC,source_type DESC,source_id DESC LIMIT ? OFFSET ?`, [
    ...params, limit, offset,
  ]).map((item) => ({
    ...item,
    question_count: Number(item.question_count || 0),
    correct_count: Number(item.correct_count || 0),
    photo_count: Number(item.photo_count || 0),
    route: item.source_type === 'practice' && Number(item.route_id)
      ? `/pages/practice-review/index?plan_id=${Number(item.route_id)}&submission_id=${Number(item.source_id)}`
      : null,
  }));
  return { items, total, page, limit, has_more: offset + items.length < total };
}

function teacherStudentSubmissionArchive(db, { teacherId, studentId, kind = 'submissions', page = 1, limit = 20 }) {
  const student = ownedStudent(db, teacherId, studentId);
  if (!student) return null;
  const normalizedKind = kind === 'reports' ? 'reports' : 'submissions';
  const normalizedPage = clampPage(page);
  const normalizedLimit = clampLimit(limit);
  const result = queryArchive(db, {
    studentId: student.id,
    kind: normalizedKind,
    page: normalizedPage,
    limit: normalizedLimit,
  });
  const submissionCount = normalizedKind === 'submissions'
    ? result.total
    : queryArchive(db, { studentId: student.id, kind: 'submissions', page: 1, limit: 1 }).total;
  const reportCount = normalizedKind === 'reports'
    ? result.total
    : queryArchive(db, { studentId: student.id, kind: 'reports', page: 1, limit: 1 }).total;
  return {
    student,
    kind: normalizedKind,
    submission_count: submissionCount,
    report_count: reportCount,
    ...result,
  };
}

module.exports = {
  submissionUnion,
  reportUnion,
  queryArchive,
  teacherStudentSubmissionArchive,
};
