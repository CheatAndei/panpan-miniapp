const {
  normalizeGradeCode,
  normalizeSubjectCode,
  gradeLabel,
} = require('../utils/content-dimensions');
const {
  GRADE_CODE,
  SUBJECT_CODE,
  SOURCE_LABEL,
  topics: fixedTopics,
  topicKeys: fixedTopicKeys,
  topicKeySet,
} = require('../resources/g8-content/topics');

const RELATION_TABLES = new Set([
  'choice_king_question_topics',
  'weekly_challenge_question_topics',
]);
const QUESTION_TABLES = new Set([
  'choice_king_questions',
  'weekly_challenge_questions',
]);
const TARGETS = Object.freeze({ choice: 60, fill: 12, subjective: 12 });

function parseJson(value, fallback) {
  try { return JSON.parse(value || ''); } catch { return fallback; }
}

function uniqueTopicKeys(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter((key) => topicKeySet.has(key)))]
    .sort((left, right) => fixedTopicKeys.indexOf(left) - fixedTopicKeys.indexOf(right));
}

function seedCurriculumTopics(db) {
  db.transaction(() => {
    for (const topic of fixedTopics) {
      db.run(`INSERT INTO curriculum_topics
        (topic_key,grade_code,subject_code,title,short_title,source_label,sort_order,is_active)
        VALUES(?,?,?,?,?,?,?,1)
        ON CONFLICT(topic_key) DO UPDATE SET
          grade_code=excluded.grade_code,subject_code=excluded.subject_code,
          title=excluded.title,short_title=excluded.short_title,
          source_label=excluded.source_label,sort_order=excluded.sort_order,
          is_active=1,updated_at=CURRENT_TIMESTAMP`, [
        topic.topic_key, GRADE_CODE, SUBJECT_CODE, topic.title, topic.short_title,
        SOURCE_LABEL, topic.sort_order,
      ]);
    }
    db.run(`UPDATE curriculum_topics SET is_active=0,updated_at=CURRENT_TIMESTAMP
      WHERE grade_code=? AND subject_code=? AND topic_key NOT IN (${fixedTopicKeys.map(() => '?').join(',')})`, [
      GRADE_CODE, SUBJECT_CODE, ...fixedTopicKeys,
    ]);
    db.run(`INSERT OR IGNORE INTO choice_king_question_topics(question_id,topic_key,is_primary)
      SELECT q.id,q.topic_key,1 FROM choice_king_questions q
      JOIN curriculum_topics t ON t.topic_key=q.topic_key
      WHERE q.topic_key IS NOT NULL AND q.topic_key<>''`);
    db.run(`INSERT OR IGNORE INTO weekly_challenge_question_topics(question_id,topic_key,is_primary)
      SELECT q.id,q.topic_key,1 FROM weekly_challenge_questions q
      JOIN curriculum_topics t ON t.topic_key=q.topic_key
      WHERE q.topic_key IS NOT NULL AND q.topic_key<>''`);
  });
  return { topics: fixedTopics.length };
}

function classRow(db, classId, teacherId = null) {
  const params = [Number(classId)];
  let teacherSql = '';
  if (teacherId !== null) { teacherSql = ' AND teacher_id=?'; params.push(Number(teacherId)); }
  return db.get(`SELECT * FROM classes WHERE id=?${teacherSql} AND deleted_at IS NULL`, params);
}

function studentContext(db, studentId) {
  return db.get(`SELECT s.id,s.class_id,s.teacher_id,c.teacher_id class_teacher_id,c.grade class_grade,c.subject class_subject
    FROM students s LEFT JOIN classes c ON c.id=s.class_id AND c.deleted_at IS NULL
    WHERE s.id=? AND s.deleted_at IS NULL`, [Number(studentId)]);
}

function storedScope(db, classId, gradeCode, subjectCode) {
  if (!classId) return null;
  return db.get(`SELECT * FROM class_content_scopes
    WHERE class_id=? AND grade_code=? AND subject_code=?`, [
    Number(classId), normalizeGradeCode(gradeCode), normalizeSubjectCode(subjectCode),
  ]);
}

function classScope(db, {
  classId,
  gradeCode = GRADE_CODE,
  subjectCode = SUBJECT_CODE,
}) {
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  const row = storedScope(db, classId, grade, subject);
  const allowed = row ? uniqueTopicKeys(parseJson(row.topic_keys_json, [])) : [...fixedTopicKeys];
  return {
    class_id: Number(classId) || 0,
    grade_code: grade,
    subject_code: subject,
    configured: Boolean(row),
    allowed_topic_keys: allowed,
    all_enabled: allowed.length === fixedTopicKeys.length,
    empty: allowed.length === 0,
    updated_at: row?.updated_at || null,
  };
}

function studentScope(db, {
  studentId,
  gradeCode = GRADE_CODE,
  subjectCode = SUBJECT_CODE,
}) {
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  const context = studentContext(db, studentId);
  if (!context) throw new Error('学生不存在');
  if (grade !== GRADE_CODE || subject !== SUBJECT_CODE) {
    return {
      student_id: Number(studentId),
      class_id: Number(context.class_id) || 0,
      grade_code: grade,
      subject_code: subject,
      scoped: false,
      configured: false,
      allowed_topic_keys: null,
      all_enabled: true,
      empty: false,
    };
  }
  return {
    student_id: Number(studentId),
    ...classScope(db, { classId: context.class_id, gradeCode: grade, subjectCode: subject }),
    scoped: true,
  };
}

function questionScopeFilter(db, {
  studentId,
  gradeCode,
  subjectCode,
  relationTable,
  questionAlias = 'q',
}) {
  if (!RELATION_TABLES.has(relationTable)) throw new Error('题目范围关联表无效');
  const scope = studentScope(db, { studentId, gradeCode, subjectCode });
  if (!scope.scoped) return { scope, clause: '', params: [], empty: false };
  if (scope.empty) return { scope, clause: ' AND 1=0', params: [], empty: true };
  const placeholders = scope.allowed_topic_keys.map(() => '?').join(',');
  return {
    scope,
    clause: ` AND EXISTS (
        SELECT 1 FROM ${relationTable} scope_required
        WHERE scope_required.question_id=${questionAlias}.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${relationTable} scope_blocked
        WHERE scope_blocked.question_id=${questionAlias}.id
          AND scope_blocked.topic_key NOT IN (${placeholders})
      )`,
    params: [...scope.allowed_topic_keys],
    empty: false,
  };
}

function questionTopicKeys(db, relationTable, questionId) {
  if (!RELATION_TABLES.has(relationTable)) throw new Error('题目范围关联表无效');
  return db.all(`SELECT topic_key FROM ${relationTable}
    WHERE question_id=? ORDER BY is_primary DESC,topic_key`, [Number(questionId)]).map((row) => row.topic_key);
}

function questionAllowedForStudent(db, {
  studentId,
  gradeCode,
  subjectCode,
  relationTable,
  questionId,
}) {
  const scope = studentScope(db, { studentId, gradeCode, subjectCode });
  if (!scope.scoped) return true;
  if (scope.empty) return false;
  const keys = questionTopicKeys(db, relationTable, questionId);
  return keys.length > 0 && keys.every((key) => scope.allowed_topic_keys.includes(key));
}

function eligibleQuestionCount(db, {
  studentId,
  gradeCode,
  subjectCode,
  questionTable,
  relationTable,
  questionType = '',
}) {
  if (!QUESTION_TABLES.has(questionTable)) throw new Error('题库表无效');
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  const filter = questionScopeFilter(db, {
    studentId, gradeCode: grade, subjectCode: subject, relationTable, questionAlias: 'q',
  });
  if (filter.empty) return 0;
  const typeSql = questionType ? ' AND q.question_type=?' : '';
  const params = [grade, subject];
  if (questionType) params.push(questionType);
  params.push(...filter.params);
  return Number(db.get(`SELECT COUNT(*) count FROM ${questionTable} q
    WHERE q.grade_code=? AND q.subject_code=? AND q.is_active=1${typeSql}${filter.clause}`, params)?.count || 0);
}

function replaceQuestionTopics(db, {
  relationTable,
  questionId,
  topicKeys,
  primaryTopicKey = '',
}) {
  if (!RELATION_TABLES.has(relationTable)) throw new Error('题目范围关联表无效');
  const normalized = uniqueTopicKeys(topicKeys);
  if (!normalized.length) throw new Error('八年级题目必须至少关联一个固定范围');
  const primary = normalized.includes(primaryTopicKey) ? primaryTopicKey : normalized[0];
  db.run(`DELETE FROM ${relationTable} WHERE question_id=?`, [Number(questionId)]);
  for (const topicKey of normalized) {
    db.run(`INSERT INTO ${relationTable}(question_id,topic_key,is_primary) VALUES(?,?,?)`, [
      Number(questionId), topicKey, topicKey === primary ? 1 : 0,
    ]);
  }
  return normalized;
}

function invalidScopeSql(relationTable, questionAlias, allowedTopicKeys) {
  if (!RELATION_TABLES.has(relationTable)) throw new Error('题目范围关联表无效');
  if (!allowedTopicKeys.length) return {
    sql: `NOT EXISTS (SELECT 1 FROM ${relationTable} tagged WHERE tagged.question_id=${questionAlias}.id)
      OR EXISTS (SELECT 1 FROM ${relationTable} tagged WHERE tagged.question_id=${questionAlias}.id)`,
    params: [],
  };
  const placeholders = allowedTopicKeys.map(() => '?').join(',');
  return {
    sql: `NOT EXISTS (
        SELECT 1 FROM ${relationTable} tagged WHERE tagged.question_id=${questionAlias}.id
      ) OR EXISTS (
        SELECT 1 FROM ${relationTable} blocked
        WHERE blocked.question_id=${questionAlias}.id
          AND blocked.topic_key NOT IN (${placeholders})
      )`,
    params: [...allowedTopicKeys],
  };
}

function withdrawInvalidAssignments(db, classId, allowedTopicKeys) {
  const choiceInvalid = invalidScopeSql('choice_king_question_topics', 'q', allowedTopicKeys);
  const challengeInvalid = invalidScopeSql('weekly_challenge_question_topics', 'q', allowedTopicKeys);
  const choice = db.run(`UPDATE choice_king_issuances SET
      closed_at=CURRENT_TIMESTAMP,close_reason='expired'
    WHERE closed_at IS NULL
      AND student_id IN (
        SELECT id FROM students WHERE class_id=? AND deleted_at IS NULL
      )
      AND question_id IN (
        SELECT q.id FROM choice_king_questions q
        WHERE q.grade_code='g8' AND q.subject_code='math'
          AND (${choiceInvalid.sql})
      )`, [Number(classId), ...choiceInvalid.params]);
  const challenge = db.run(`UPDATE challenge_assignments_v2 SET
      status='skipped',updated_at=CURRENT_TIMESTAMP
    WHERE status IN ('active','reviewed_wrong')
      AND student_id IN (
        SELECT id FROM students WHERE class_id=? AND deleted_at IS NULL
      )
      AND question_id IN (
        SELECT q.id FROM weekly_challenge_questions q
        WHERE q.grade_code='g8' AND q.subject_code='math'
          AND (${challengeInvalid.sql})
      )`, [Number(classId), ...challengeInvalid.params]);
  return {
    choice_issuances: Number(choice.changes || 0),
    challenge_assignments: Number(challenge.changes || 0),
  };
}

function saveClassScope(db, {
  classId,
  teacherId,
  topicKeys,
  gradeCode = GRADE_CODE,
  subjectCode = SUBJECT_CODE,
}) {
  const cls = classRow(db, classId, teacherId);
  if (!cls) throw Object.assign(new Error('学习小组不存在'), { statusCode: 404 });
  const grade = normalizeGradeCode(gradeCode);
  const subject = normalizeSubjectCode(subjectCode);
  if (grade !== GRADE_CODE || subject !== SUBJECT_CODE) throw new Error('当前仅支持八年级数学进度控制');
  if (normalizeGradeCode(cls.grade) !== GRADE_CODE) throw new Error('请先在管理班级中把该小组年级调整为初二');
  if (!Array.isArray(topicKeys)) throw new Error('学习范围格式无效');
  const invalid = topicKeys.map(String).filter((key) => !topicKeySet.has(key));
  if (invalid.length) throw new Error(`存在未知学习范围：${invalid[0]}`);
  const allowed = uniqueTopicKeys(topicKeys);
  let withdrawn;
  db.transaction(() => {
    db.run(`INSERT INTO class_content_scopes
      (class_id,grade_code,subject_code,topic_keys_json,updated_by,updated_at)
      VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(class_id,grade_code,subject_code) DO UPDATE SET
        topic_keys_json=excluded.topic_keys_json,updated_by=excluded.updated_by,
        updated_at=CURRENT_TIMESTAMP`, [
      Number(classId), grade, subject, JSON.stringify(allowed), Number(teacherId),
    ]);
    withdrawn = withdrawInvalidAssignments(db, classId, allowed);
    db.run(`INSERT INTO operation_logs(actor_id,action,entity_type,entity_id,detail)
      VALUES(?,?,?,?,?)`, [
      Number(teacherId), 'class_content_scope_updated', 'class', Number(classId),
      JSON.stringify({ grade_code: grade, subject_code: subject, topic_keys: allowed, withdrawn }),
    ]);
  });
  return { ...classScope(db, { classId, gradeCode: grade, subjectCode: subject }), withdrawn };
}

function topicCounts(db, topicKey) {
  const choice = Number(db.get(`SELECT COUNT(*) count FROM choice_king_questions q
    JOIN choice_king_question_topics qt ON qt.question_id=q.id
    WHERE qt.topic_key=? AND q.grade_code='g8' AND q.subject_code='math' AND q.is_active=1`, [topicKey])?.count || 0);
  const terminalRows = db.all(`SELECT q.question_type,COUNT(*) count FROM weekly_challenge_questions q
    JOIN weekly_challenge_question_topics qt ON qt.question_id=q.id
    WHERE qt.topic_key=? AND q.grade_code='g8' AND q.subject_code='math' AND q.is_active=1
      AND q.question_type IN ('fill','subjective')
    GROUP BY q.question_type`, [topicKey]);
  const terminal = Object.fromEntries(terminalRows.map((row) => [row.question_type, Number(row.count)]));
  return { choice, fill: terminal.fill || 0, subjective: terminal.subjective || 0 };
}

function classContentState(db, { classId, teacherId }) {
  const cls = classRow(db, classId, teacherId);
  if (!cls) throw Object.assign(new Error('学习小组不存在'), { statusCode: 404 });
  const classGradeCode = normalizeGradeCode(cls.grade);
  const supported = classGradeCode === GRADE_CODE && normalizeSubjectCode(cls.subject || '数学') === SUBJECT_CODE;
  const scope = classScope(db, { classId, gradeCode: GRADE_CODE, subjectCode: SUBJECT_CODE });
  const rows = fixedTopics.map((topic) => {
    const counts = topicCounts(db, topic.topic_key);
    return {
      ...topic,
      enabled: scope.allowed_topic_keys.includes(topic.topic_key),
      counts,
      ready: counts.choice >= TARGETS.choice
        && counts.fill >= TARGETS.fill
        && counts.subjective >= TARGETS.subjective,
    };
  });
  return {
    class: {
      id: Number(cls.id),
      name: cls.name,
      grade: cls.grade || '',
      grade_code: classGradeCode,
      grade_label: gradeLabel(classGradeCode),
      subject: cls.subject || '数学',
    },
    supported,
    targets: TARGETS,
    scope,
    topics: rows,
    totals: rows.reduce((sum, item) => ({
      choice: sum.choice + item.counts.choice,
      fill: sum.fill + item.counts.fill,
      subjective: sum.subjective + item.counts.subjective,
    }), { choice: 0, fill: 0, subjective: 0 }),
  };
}

function practiceCatalogForClass(db, { classId, teacherId }) {
  const cls = classRow(db, classId, teacherId);
  if (!cls) throw Object.assign(new Error('学习小组不存在'), { statusCode: 404 });
  const { GRADE_TOPICS, DEFAULT_TOPIC_KEYS_BY_GRADE, FIXED_MODULE } = require('./practice');
  const gradeCode = normalizeGradeCode(cls.grade);
  const supported = gradeCode === 'g7' || gradeCode === 'g8';
  const topicConfigs = supported ? GRADE_TOPICS[gradeCode] : {};
  const rows = supported ? db.all(`SELECT question_type,COUNT(*) question_count,
      SUM(CASE WHEN source_region='广州' THEN 1 ELSE 0 END) guangzhou_question_count
    FROM practice_questions
    WHERE grade_code=? AND subject='数学' AND module=? AND is_active=1
    GROUP BY question_type ORDER BY question_type`, [gradeCode, FIXED_MODULE]) : [];
  const topics = Object.entries(topicConfigs).map(([key, config]) => ({
    key,
    label: config.label,
    question_types: config.questionTypes,
    question_count: rows.filter((row) => config.questionTypes.includes(row.question_type))
      .reduce((sum, row) => sum + Number(row.question_count || 0), 0),
  }));
  return {
    class: {
      id: Number(cls.id),
      name: cls.name,
      grade: cls.grade || '',
      grade_code: gradeCode,
      grade_label: gradeLabel(gradeCode),
    },
    supported,
    module: FIXED_MODULE,
    default_topic_keys: supported ? [...DEFAULT_TOPIC_KEYS_BY_GRADE[gradeCode]] : [],
    topics,
    total_questions: topics.reduce((sum, topic) => sum + topic.question_count, 0),
  };
}

module.exports = {
  TARGETS,
  seedCurriculumTopics,
  uniqueTopicKeys,
  classRow,
  classScope,
  studentScope,
  questionScopeFilter,
  questionTopicKeys,
  questionAllowedForStudent,
  eligibleQuestionCount,
  replaceQuestionTopics,
  saveClassScope,
  classContentState,
  practiceCatalogForClass,
  withdrawInvalidAssignments,
};
