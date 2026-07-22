const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const crypto = require('node:crypto');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'teach.db');
const DB_PATH = process.env.DATABASE_PATH || DEFAULT_DB_PATH;
let _db = null;
let _transactionDepth = 0;

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function saveDB() {
  if (!_db) return;
  ensureDir(DB_PATH);
  const tempPath = `${DB_PATH}.${process.pid}.tmp`;
  const backupPath = `${DB_PATH}.${process.pid}.bak`;
  fs.writeFileSync(tempPath, Buffer.from(_db.export()));
  try {
    fs.renameSync(tempPath, DB_PATH);
  } catch (error) {
    if (!fs.existsSync(DB_PATH)) throw error;
    try { fs.renameSync(DB_PATH, backupPath); }
    catch { try { fs.unlinkSync(tempPath); } catch {} throw error; }
    try {
      fs.renameSync(tempPath, DB_PATH);
      fs.unlinkSync(backupPath);
    } catch (replaceError) {
      try { if (!fs.existsSync(DB_PATH)) fs.renameSync(backupPath, DB_PATH); } catch {}
      try { fs.unlinkSync(tempPath); } catch {}
      throw replaceError;
    }
  }
}

function execSQL(sql, params = []) {
  const stmt = _db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function execOne(sql, params = []) {
  const rows = execSQL(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function execRun(sql, params = []) {
  _db.run(sql, params);
  const r = execOne('SELECT last_insert_rowid() as id');
  const changes = _db.getRowsModified();
  if (_transactionDepth === 0) saveDB();
  return { lastInsertRowid: r?.id || 0, changes };
}

function withTransaction(work) {
  if (_transactionDepth > 0) return work();
  _db.run('BEGIN IMMEDIATE');
  _transactionDepth = 1;
  let result;
  try {
    result = work();
    _db.run('COMMIT');
  } catch (error) {
    try { _db.run('ROLLBACK'); } catch {}
    throw error;
  } finally {
    _transactionDepth = 0;
  }
  saveDB();
  return result;
}

function seedPracticeQuestions() {
  const add = (grade, module, type, difficulty, template, stem, answer, seconds, signature) => {
    _db.run(`INSERT OR IGNORE INTO practice_questions
      (grade_band,subject,module,question_type,difficulty,template_key,stem,answer,estimated_seconds,signature,source_type)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [grade, '数学', module, type, difficulty, template, stem, String(answer), seconds, signature, 'self_authored']);
  };

  for (let i = 1; i <= 80; i++) {
    const a = 20 + (i * 7) % 80;
    const b = 5 + (i * 11) % 60;
    const difficulty = i <= 30 ? 1 : i <= 60 ? 2 : 3;
    if (i % 2) add('小学', '四则运算', '口算', difficulty, `add-two-${i % 10}`, `${a} + ${b} = ?`, a + b, 75, `primary-arithmetic-add-${i}`);
    else {
      const high = a + b;
      add('小学', '四则运算', '口算', difficulty, `subtract-two-${i % 10}`, `${high} - ${b} = ?`, a, 75, `primary-arithmetic-sub-${i}`);
    }
  }
  for (let i = 1; i <= 80; i++) {
    const a = 2 + (i % 9);
    const b = 2 + ((i * 5) % 9);
    const difficulty = i <= 30 ? 1 : i <= 60 ? 2 : 3;
    if (i % 2) add('小学', '乘除法', '口算', difficulty, `multiply-${i % 10}`, `${a} × ${b} = ?`, a * b, 80, `primary-multiply-${i}`);
    else add('小学', '乘除法', '口算', difficulty, `divide-${i % 10}`, `${a * b} ÷ ${a} = ?`, b, 80, `primary-divide-${i}`);
  }
  for (let i = 1; i <= 60; i++) {
    const groups = 3 + (i % 8);
    const each = 4 + ((i * 3) % 9);
    add('小学', '应用题', '文字题', i <= 25 ? 2 : 3, `equal-groups-${i % 10}`,
      `每组有 ${each} 本练习册，共有 ${groups} 组，一共有多少本练习册？`, groups * each, 120, `primary-word-${i}`);
  }
  for (let i = 1; i <= 80; i++) {
    const a = -20 + (i * 7) % 41;
    const b = -18 + (i * 11) % 37;
    add('初中', '有理数', '计算', i <= 30 ? 1 : i <= 60 ? 2 : 3, `signed-add-${i % 10}`,
      `${a} + (${b}) = ?`, a + b, 85, `middle-signed-${i}`);
  }
  for (let i = 1; i <= 80; i++) {
    const x = 2 + (i % 24);
    const a = 1 + ((i * 7) % 20);
    add('初中', '一元一次方程', '方程', i <= 25 ? 2 : i <= 60 ? 3 : 4, `linear-one-step-${i % 10}`,
      `解方程：x + ${a} = ${x + a}`, `x=${x}`, 110, `middle-equation-${i}`);
  }
  for (let i = 1; i <= 60; i++) {
    const a = 2 + (i % 12);
    const b = 1 + ((i * 5) % 11);
    add('初中', '整式运算', '化简', i <= 25 ? 2 : 3, `combine-like-terms-${i % 10}`,
      `化简：${a}x + ${b}x`, `${a + b}x`, 100, `middle-algebra-${i}`);
  }
}

function seedGuangzhouPracticeQuestions() {
  const { importQuestionDataset } = require('../services/practice-question-import');
  const dataset = require('../resources/practice/guangzhou-original-v1');
  importQuestionDataset(getDB(), dataset, { dryRun: false });
}

function retireLegacyJuniorPracticeQuestions() {
  _db.run(`UPDATE practice_questions SET is_active=0
    WHERE grade_band='初中' AND (source_batch IS NULL OR source_batch='guangzhou-original-math-v1')`);
}

function seedJuniorCalculationQuestions() {
  const { importQuestionDataset, migrateQuestionDatasetStems } = require('../services/practice-question-import');
  const { normalizeLinearEquationDisplay } = require('../utils/math-expression');
  const dataset = require('../resources/practice/junior-calculation-v3');
  migrateQuestionDatasetStems(getDB(), dataset, normalizeLinearEquationDisplay);
  importQuestionDataset(getDB(), dataset, { dryRun: false });
}

function activateJuniorCalculationQuestions() {
  _db.run(`UPDATE practice_questions SET is_active=CASE WHEN source_batch='panpan-junior-calculation-v3' THEN 1 ELSE 0 END
    WHERE grade_band='初中'`);
}

function ensureColumn(table, column, definition) {
  const columns = execSQL(`PRAGMA table_info(${table})`);
  if (!columns.some((item) => item.name === column)) {
    _db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateExamPapersV2() {
  const row = execOne("SELECT sql FROM sqlite_master WHERE type='table' AND name='exam_papers'");
  const sql = String(row?.sql || '');
  if (!sql || (sql.includes("'mock'") && sql.includes('subject_code'))) return;
  _db.run(`CREATE TABLE exam_papers_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stable_code TEXT UNIQUE NOT NULL,
    display_title TEXT NOT NULL,
    school_name TEXT,
    district TEXT,
    school_year TEXT,
    exam_year INTEGER,
    grade TEXT NOT NULL DEFAULT '七年级',
    grade_code TEXT NOT NULL DEFAULT 'g7' CHECK(grade_code IN ('g7','g8','g9')),
    subject_code TEXT NOT NULL DEFAULT 'math',
    semester TEXT NOT NULL DEFAULT '上学期',
    semester_code TEXT NOT NULL DEFAULT 's1',
    exam_type TEXT NOT NULL CHECK(exam_type IN ('midterm','final','monthly','mock')),
    paper_asset_id INTEGER NOT NULL REFERENCES exam_assets(id),
    answer_asset_id INTEGER REFERENCES exam_assets(id),
    source_relative_path TEXT NOT NULL,
    license_status TEXT NOT NULL DEFAULT 'pending_review',
    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','hidden')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  _db.run(`INSERT INTO exam_papers_v2
    (id,stable_code,display_title,school_name,district,school_year,exam_year,grade,grade_code,subject_code,
     semester,semester_code,exam_type,paper_asset_id,answer_asset_id,source_relative_path,license_status,status,created_at,updated_at)
    SELECT id,stable_code,display_title,school_name,district,school_year,exam_year,grade,
      CASE WHEN grade LIKE '%九%' OR grade LIKE '%中考%' THEN 'g9' WHEN grade LIKE '%八%' THEN 'g8' ELSE 'g7' END,
      'math',semester,CASE WHEN semester LIKE '%下%' THEN 's2' ELSE 's1' END,exam_type,
      paper_asset_id,answer_asset_id,source_relative_path,license_status,status,created_at,updated_at
    FROM exam_papers`);
  _db.run('DROP TABLE exam_papers');
  _db.run('ALTER TABLE exam_papers_v2 RENAME TO exam_papers');
}

function migrateLearningAttemptsV2() {
  const row = execOne("SELECT sql FROM sqlite_master WHERE type='table' AND name='learning_attempts'");
  const sql = String(row?.sql || '');
  if (!sql || (sql.includes('grade_code') && /logical_date\s*,\s*grade_code\s*,\s*subject_code/i.test(sql))) return;
  _db.run(`CREATE TABLE learning_attempts_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),parent_id INTEGER NOT NULL REFERENCES users(id),
    task_type TEXT NOT NULL,task_title TEXT NOT NULL,logical_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
    battle TEXT NOT NULL CHECK(battle IN ('primary','junior')),
    grade_code TEXT NOT NULL DEFAULT 'g7' CHECK(grade_code IN ('g7','g8','g9')),
    subject_code TEXT NOT NULL DEFAULT 'math',questions_json TEXT NOT NULL,answer_detail TEXT,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at DATETIME,elapsed_seconds INTEGER,
    correct_count INTEGER,total_questions INTEGER NOT NULL,score INTEGER,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id,task_type,logical_date,grade_code,subject_code)
  )`);
  _db.run(`INSERT INTO learning_attempts_v2
    (id,student_id,parent_id,task_type,task_title,logical_date,status,battle,grade_code,subject_code,
     questions_json,answer_detail,started_at,completed_at,elapsed_seconds,correct_count,total_questions,score,created_at)
    SELECT a.id,a.student_id,a.parent_id,a.task_type,a.task_title,a.logical_date,a.status,a.battle,
      CASE WHEN COALESCE(s.grade,'') LIKE '%九%' THEN 'g9' WHEN COALESCE(s.grade,'') LIKE '%八%' THEN 'g8' ELSE 'g7' END,
      'math',a.questions_json,a.answer_detail,a.started_at,a.completed_at,a.elapsed_seconds,a.correct_count,a.total_questions,a.score,a.created_at
    FROM learning_attempts a LEFT JOIN students s ON s.id=a.student_id`);
  _db.run('DROP TABLE learning_attempts');
  _db.run('ALTER TABLE learning_attempts_v2 RENAME TO learning_attempts');
}

function migrateLegacyChallengesToV2() {
  const legacy = execSQL(`SELECT a.*,q.grade_code,q.subject_code,sub.id submission_id,sub.parent_id,
    sub.status submission_status,sub.teacher_note,sub.is_correct,sub.submitted_at,sub.reviewed_by,sub.reviewed_at
    FROM weekly_challenge_assignments a JOIN weekly_challenge_questions q ON q.id=a.question_id
    LEFT JOIN weekly_challenge_submissions sub ON sub.assignment_id=a.id ORDER BY a.student_id,a.question_type,a.id`);
  if (!legacy.length) return;
  const newestOpen = new Map();
  for (const row of legacy) {
    if (row.submission_id && row.submission_status === 'reviewed' && Number(row.is_correct)) continue;
    newestOpen.set(`${row.student_id}|${row.grade_code || 'g7'}|${row.subject_code || 'math'}|${row.question_type}`, Number(row.id));
  }
  for (const row of legacy) {
    const key = `${row.student_id}|${row.grade_code || 'g7'}|${row.subject_code || 'math'}|${row.question_type}`;
    let status = 'replaced';
    if (row.submission_status === 'reviewed' && Number(row.is_correct)) status = 'passed';
    else if (Number(row.id) === newestOpen.get(key)) status = row.submission_status === 'reviewed' ? 'reviewed_wrong' : row.submission_id ? 'submitted' : 'active';
    _db.run(`INSERT OR IGNORE INTO challenge_assignments_v2
      (student_id,question_id,grade_code,subject_code,question_type,status,assigned_on,legacy_assignment_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,COALESCE(?,CURRENT_TIMESTAMP),COALESCE(?,CURRENT_TIMESTAMP))`, [
      row.student_id,row.question_id,row.grade_code || 'g7',row.subject_code || 'math',row.question_type,status,
      row.week_start,row.id,row.created_at,row.created_at,
    ]);
    const assignment = execOne('SELECT id FROM challenge_assignments_v2 WHERE legacy_assignment_id=?', [row.id]);
    if (!assignment || !row.submission_id) continue;
    _db.run(`INSERT OR IGNORE INTO challenge_submissions_v2
      (assignment_id,parent_id,attempt_no,status,teacher_note,is_correct,submitted_at,reviewed_by,reviewed_at,legacy_submission_id)
      VALUES(?,?,1,?,?,?,?,?,?,?)`, [assignment.id,row.parent_id,row.submission_status,row.teacher_note,row.is_correct,
      row.submitted_at,row.reviewed_by,row.reviewed_at,row.submission_id]);
    const submission = execOne('SELECT id FROM challenge_submissions_v2 WHERE legacy_submission_id=?', [row.submission_id]);
    if (submission) _db.run(`INSERT OR IGNORE INTO challenge_attachments_v2(submission_id,file_id,sha256,created_at)
      SELECT ?,file_id,sha256,created_at FROM weekly_challenge_attachments WHERE submission_id=?`, [submission.id,row.submission_id]);
  }
  _db.run(`INSERT INTO challenge_progress_v2(student_id,grade_code,subject_code,question_type,passed_count,updated_at)
    SELECT student_id,grade_code,subject_code,question_type,COUNT(*),CURRENT_TIMESTAMP
    FROM challenge_assignments_v2 WHERE status='passed' GROUP BY student_id,grade_code,subject_code,question_type
    ON CONFLICT(student_id,grade_code,subject_code,question_type) DO UPDATE SET
      passed_count=excluded.passed_count,updated_at=CURRENT_TIMESTAMP`);
}

function runMigrations() {
  migrateExamPapersV2();
  migrateLearningAttemptsV2();
  ensureColumn('feedbacks', 'student_feedbacks', 'TEXT');
  ensureColumn('feedbacks', 'notes_pdf_url', 'TEXT');
  ensureColumn('checkins', 'check_out_note', 'TEXT');
  ensureColumn('students', 'external_id', 'TEXT');
  ensureColumn('classes', 'deleted_at', 'DATETIME');
  ensureColumn('homework_batches', 'class_id', 'INTEGER REFERENCES classes(id)');
  ensureColumn('practice_plans', 'topic_keys', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('practice_questions', 'source_batch', 'TEXT');
  ensureColumn('practice_questions', 'source_title', 'TEXT');
  ensureColumn('practice_questions', 'source_url', 'TEXT');
  ensureColumn('practice_questions', 'source_region', 'TEXT');
  ensureColumn('practice_questions', 'source_license', 'TEXT');
  ensureColumn('practice_questions', 'source_retrieved_at', 'DATE');
  ensureColumn('practice_questions', 'source_snapshot_sha256', 'TEXT');
  ensureColumn('practice_questions', 'content_sha256', 'TEXT');
  ensureColumn('practice_questions', 'copy_allowed', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('practice_questions', 'grade_code', "TEXT NOT NULL DEFAULT 'g7'");
  ensureColumn('practice_questions', 'topic_key', 'TEXT');
  ensureColumn('weekly_challenge_questions', 'source_key', 'TEXT');
  ensureColumn('weekly_challenge_questions', 'grade_code', "TEXT NOT NULL DEFAULT 'g7'");
  ensureColumn('weekly_challenge_questions', 'subject_code', "TEXT NOT NULL DEFAULT 'math'");
  ensureColumn('weekly_challenge_questions', 'topic_key', 'TEXT');
  ensureColumn('weekly_challenge_questions', 'difficulty', 'INTEGER NOT NULL DEFAULT 3');
  ensureColumn('choice_king_questions', 'grade_code', "TEXT NOT NULL DEFAULT 'g7'");
  ensureColumn('choice_king_questions', 'subject_code', "TEXT NOT NULL DEFAULT 'math'");
  ensureColumn('choice_king_questions', 'topic_key', 'TEXT');
  ensureColumn('choice_king_questions', 'difficulty', 'INTEGER NOT NULL DEFAULT 2');
  ensureColumn('learning_attempts', 'grade_code', "TEXT NOT NULL DEFAULT 'g7'");
  ensureColumn('learning_attempts', 'subject_code', "TEXT NOT NULL DEFAULT 'math'");
  ensureColumn('choice_king_reports', 'selected_answer', 'TEXT');
  _db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_challenge_source_key ON weekly_challenge_questions(source_key)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_classes_teacher_active ON classes(teacher_id, deleted_at)');
  _db.run('DROP INDEX IF EXISTS idx_choice_king_question_active');
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_question_active
    ON choice_king_questions(grade_code, subject_code, is_active, source_period, id)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_exam_paper_catalog
    ON exam_papers(grade_code,subject_code,exam_type,exam_year,status)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_weekly_challenge_catalog
    ON weekly_challenge_questions(grade_code,subject_code,question_type,is_active)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_attempt_student_question
    ON choice_king_attempts(student_id, question_id, is_review, answered_at)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_attempt_first_correct
    ON choice_king_attempts(question_id, student_id, is_correct, is_review, answered_at)`);
  _db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_choice_king_one_active_issuance
    ON choice_king_issuances(student_id) WHERE closed_at IS NULL`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_issuance_question
    ON choice_king_issuances(question_id, closed_at, expires_at)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_wrong_due
    ON choice_king_wrong_progress(student_id, status, next_due_at, new_questions_since_review)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_report_status
    ON choice_king_reports(status, created_at)`);
  _db.run(`CREATE INDEX IF NOT EXISTS idx_teacher_alert_unread
    ON teacher_alerts(teacher_id, read_at, created_at)`);
  _db.run(`UPDATE practice_plans SET topic_keys='["rational_numbers","absolute_value","algebra","linear_equation"]'
    WHERE topic_keys IS NULL OR trim(topic_keys)='' OR topic_keys='[]'`);
  _db.run(`UPDATE practice_questions SET grade_code=CASE
    WHEN grade_band LIKE '%九%' THEN 'g9' WHEN grade_band LIKE '%八%' THEN 'g8' ELSE 'g7' END
    WHERE grade_code IS NULL OR grade_code=''`);
  _db.run("UPDATE weekly_challenge_questions SET grade_code='g7',subject_code='math' WHERE grade_code IS NULL OR grade_code=''");
  _db.run("UPDATE choice_king_questions SET grade_code='g7',subject_code='math' WHERE grade_code IS NULL OR grade_code=''");
  _db.run(`UPDATE homework_batches SET class_id=(
      SELECT s.class_id FROM homework_submissions hs JOIN students s ON s.id=hs.student_id
      WHERE hs.batch_id=homework_batches.id AND s.class_id IS NOT NULL LIMIT 1
    ) WHERE class_id IS NULL`);
  _db.run(`INSERT OR IGNORE INTO class_students(class_id, student_id)
    SELECT class_id,id FROM students WHERE class_id IS NOT NULL`);
  const students = execSQL('SELECT id,external_id FROM students');
  for (const student of students) {
    if (!/^stu_[a-f0-9]{32}$/.test(String(student.external_id || ''))) {
      let assigned = false;
      for (let attempt = 0; attempt < 5 && !assigned; attempt += 1) {
        try {
          _db.run('UPDATE students SET external_id=? WHERE id=?', [`stu_${crypto.randomBytes(16).toString('hex')}`, student.id]);
          assigned = true;
        } catch (error) {
          if (!/UNIQUE/i.test(String(error?.message || error))) throw error;
        }
      }
      if (!assigned) throw new Error(`学生 ${student.id} 的统一 ID 生成失败`);
    }
  }
  _db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_students_external_id ON students(external_id)');
  _db.run(`CREATE TRIGGER IF NOT EXISTS students_external_id_after_insert
    AFTER INSERT ON students
    WHEN NEW.external_id IS NULL OR trim(NEW.external_id) = ''
    BEGIN
      UPDATE students SET external_id='stu_' || lower(hex(randomblob(16))) WHERE id=NEW.id;
    END`);
  _db.run(`CREATE TABLE IF NOT EXISTS parent_feedbacks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER REFERENCES users(id),
    student_id INTEGER REFERENCES students(id),
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  ensureColumn('parent_feedbacks', 'student_id', 'INTEGER REFERENCES students(id)');
  _db.run(`CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK(role IN ('parent', 'teacher')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, role)
  )`);

  // 兼容旧库：旧默认角色、真实家长绑定和真实教师班级都可恢复身份。
  // INSERT OR IGNORE + 复合主键保证每次启动重复执行也不会产生重复数据。
  _db.run(`INSERT OR IGNORE INTO user_roles(user_id, role)
    SELECT id, role FROM users WHERE role IN ('parent', 'teacher')`);
  _db.run(`INSERT OR IGNORE INTO user_roles(user_id, role)
    SELECT DISTINCT parent_id, 'parent' FROM bindings WHERE parent_id IS NOT NULL`);
  _db.run(`INSERT OR IGNORE INTO user_roles(user_id, role)
    SELECT DISTINCT teacher_id, 'teacher' FROM classes WHERE teacher_id IS NOT NULL`);
  _db.run(`INSERT OR IGNORE INTO user_roles(user_id, role)
    SELECT DISTINCT teacher_id, 'teacher' FROM students WHERE teacher_id IS NOT NULL`);
  migrateLegacyChallengesToV2();
  // 作业批改表由 schema.sql 以 CREATE TABLE IF NOT EXISTS 创建。
  // 这里保留可向后兼容的增量字段迁移位置。
}

async function initDB() {
  // 先审计全部生成题，再打开/迁移数据库，避免坏题随启动流程进入生产。
  require('../services/question-bank-audit').assertCalculationQuestionBanks();
  const SQL = await initSqlJs();
  ensureDir(DB_PATH);
  _db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  _db.run(schema);
  runMigrations();
  // The full generated banks are intentionally exercised by their dedicated
  // seed tests. Avoid importing 2,420 image-backed resources again for every
  // unrelated test process; production can never enter this branch by merely
  // setting the skip flag.
  const skipStartupResourceSeed = (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT)
    && process.env.PANPAN_SKIP_STARTUP_RESOURCE_SEED === '1';
  if (!skipStartupResourceSeed) {
    require('../services/weekly-challenge-seed').seedWeeklyChallenges(getDB());
    require('../services/choice-king').seedChoiceKingQuestions(getDB());
  }
  require('../services/knowledge-challenge').seedKnowledgeBank(getDB());
  seedPracticeQuestions();
  seedGuangzhouPracticeQuestions();
  retireLegacyJuniorPracticeQuestions();
  seedJuniorCalculationQuestions();
  activateJuniorCalculationQuestions();
  saveDB();
  const saveTimer = setInterval(saveDB, 30000);
  saveTimer.unref?.();
  console.log(`DB ready: ${DB_PATH}`);
}

function getDB() {
  return {
    all: execSQL,
    get: execOne,
    run: execRun,
    transaction: withTransaction,
    exec: (s) => { _db.run(s); if (_transactionDepth === 0) saveDB(); }
  };
}

module.exports = { initDB, getDB, runMigrations, DB_PATH };
