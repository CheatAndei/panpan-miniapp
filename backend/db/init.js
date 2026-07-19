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
  const { importQuestionDataset } = require('../services/practice-question-import');
  const dataset = require('../resources/practice/junior-calculation-v3');
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

function runMigrations() {
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
  ensureColumn('weekly_challenge_questions', 'source_key', 'TEXT');
  ensureColumn('choice_king_reports', 'selected_answer', 'TEXT');
  _db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_challenge_source_key ON weekly_challenge_questions(source_key)');
  _db.run('CREATE INDEX IF NOT EXISTS idx_classes_teacher_active ON classes(teacher_id, deleted_at)');
  _db.run(`CREATE INDEX IF NOT EXISTS idx_choice_king_question_active
    ON choice_king_questions(is_active, source_period, id)`);
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
  // 作业批改表由 schema.sql 以 CREATE TABLE IF NOT EXISTS 创建。
  // 这里保留可向后兼容的增量字段迁移位置。
}

async function initDB() {
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
