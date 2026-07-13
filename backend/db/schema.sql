-- 教培小程序数据库 Schema
-- SQLite

-- 用户表（老师 + 家长）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT UNIQUE NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'parent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 一个微信用户可同时拥有家长和教师身份；users.role 仅保留默认活跃身份以兼容旧代码。
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK(role IN ('parent', 'teacher')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, role)
);

-- 班级表
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  room TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 学生表
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE,
  teacher_id INTEGER REFERENCES users(id),
  class_id INTEGER REFERENCES classes(id),
  name TEXT NOT NULL,
  nickname TEXT,
  grade TEXT,
  school TEXT,
  level TEXT,
  personality TEXT,
  gender TEXT DEFAULT 'boy',
  invite_code TEXT UNIQUE,
  avatar_url TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 内部自增 id 只供本库关联；跨系统统一使用不可枚举的 external_id。
CREATE TRIGGER IF NOT EXISTS students_external_id_after_insert
AFTER INSERT ON students
WHEN NEW.external_id IS NULL OR trim(NEW.external_id) = ''
BEGIN
  UPDATE students SET external_id='stu_' || lower(hex(randomblob(16))) WHERE id=NEW.id;
END;

-- 班级-学生关联
CREATE TABLE IF NOT EXISTS class_students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER REFERENCES classes(id),
  student_id INTEGER REFERENCES students(id),
  UNIQUE(class_id, student_id)
);

-- 家长-学生绑定
CREATE TABLE IF NOT EXISTS bindings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES users(id),
  student_id INTEGER REFERENCES students(id),
  UNIQUE(parent_id, student_id)
);

-- 课表
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES users(id),
  class_id INTEGER REFERENCES classes(id),
  title TEXT NOT NULL,
  day_of_week INTEGER,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 签到记录
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  schedule_id INTEGER REFERENCES schedules(id),
  class_date DATE NOT NULL,
  check_in_time DATETIME,
  check_out_time DATETIME,
  status TEXT DEFAULT 'absent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 课后反馈
CREATE TABLE IF NOT EXISTS feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES users(id),
  class_id INTEGER REFERENCES classes(id),
  schedule_id INTEGER REFERENCES schedules(id),
  class_date DATE NOT NULL,
  image_urls TEXT,
  summary TEXT,
  notes_pdf_url TEXT,
  homework TEXT,
  student_feedbacks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 请假
CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  parent_id INTEGER REFERENCES users(id),
  schedule_id INTEGER REFERENCES schedules(id),
  class_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reply TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家长意见反馈
CREATE TABLE IF NOT EXISTS parent_feedbacks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES users(id),
  student_id INTEGER REFERENCES students(id),
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reply TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 发布的课程实例（课表套日期后生成）
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES users(id),
  class_id INTEGER REFERENCES classes(id),
  schedule_id INTEGER REFERENCES schedules(id),
  title TEXT NOT NULL,
  class_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  status TEXT DEFAULT 'published',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI 学生画像
CREATE TABLE IF NOT EXISTS student_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id) UNIQUE,
  tags TEXT,
  personality TEXT,
  strengths TEXT,
  weaknesses TEXT,
  suggestion TEXT,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI 作业批改批次。idempotency_key 防止本地后台重复提交。
CREATE TABLE IF NOT EXISTS homework_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  subject TEXT,
  assigned_date DATE NOT NULL,
  status TEXT DEFAULT 'reviewed',
  prompt_version TEXT,
  source_manifest TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  confirmed_at DATETIME,
  published_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER REFERENCES homework_batches(id),
  student_id INTEGER REFERENCES students(id),
  original_image_urls TEXT,
  processed_image_urls TEXT,
  grading_status TEXT DEFAULT 'confirmed',
  overall_comment TEXT,
  points_delta INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(batch_id, student_id)
);

CREATE TABLE IF NOT EXISTS homework_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER REFERENCES homework_submissions(id),
  question_no TEXT NOT NULL,
  question_image_url TEXT,
  student_answer TEXT,
  is_correct INTEGER NOT NULL DEFAULT 0,
  wrong_step TEXT,
  error_type TEXT,
  comment TEXT,
  confidence REAL,
  teacher_status TEXT DEFAULT 'confirmed',
  teacher_note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, question_no)
);

CREATE TABLE IF NOT EXISTS wrong_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  answer_id INTEGER REFERENCES homework_answers(id) UNIQUE,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER REFERENCES students(id),
  submission_id INTEGER REFERENCES homework_submissions(id) UNIQUE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER REFERENCES homework_submissions(id),
  parent_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  error TEXT,
  sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, parent_id)
);

-- 每日个性化练习题库。题目必须来自自编、授权或公版内容。
CREATE TABLE IF NOT EXISTS practice_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_band TEXT NOT NULL CHECK(grade_band IN ('小学', '初中')),
  subject TEXT NOT NULL DEFAULT '数学',
  module TEXT NOT NULL,
  question_type TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1 CHECK(difficulty BETWEEN 1 AND 5),
  template_key TEXT NOT NULL,
  stem TEXT NOT NULL,
  answer TEXT NOT NULL,
  estimated_seconds INTEGER NOT NULL DEFAULT 90,
  signature TEXT UNIQUE NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'self_authored',
  source_batch TEXT,
  source_title TEXT,
  source_url TEXT,
  source_region TEXT,
  source_license TEXT,
  source_retrieved_at DATE,
  source_snapshot_sha256 TEXT,
  content_sha256 TEXT,
  copy_allowed INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 题库导入审计。公开网页不等于开放许可；copy_allowed=0 时只允许自编题引用其命题方向。
CREATE TABLE IF NOT EXISTS practice_question_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_key TEXT UNIQUE NOT NULL,
  source_title TEXT NOT NULL,
  source_url TEXT,
  source_region TEXT,
  source_license TEXT NOT NULL,
  source_retrieved_at DATE,
  source_snapshot_sha256 TEXT NOT NULL,
  copy_allowed INTEGER NOT NULL DEFAULT 0,
  provenance TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 老师发布的连续打卡计划。
CREATE TABLE IF NOT EXISTS practice_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  class_id INTEGER NOT NULL REFERENCES classes(id),
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  grade_band TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '数学',
  module TEXT NOT NULL,
  question_types TEXT NOT NULL DEFAULT '[]',
  difficulty INTEGER NOT NULL DEFAULT 1,
  target_seconds INTEGER NOT NULL DEFAULT 1200,
  auto_advance INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'published',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 每个学生可被老师锁定、回退或调整模块。
CREATE TABLE IF NOT EXISTS practice_student_settings (
  plan_id INTEGER NOT NULL REFERENCES practice_plans(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  current_module TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  auto_advance INTEGER NOT NULL DEFAULT 1,
  is_locked INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(plan_id, student_id)
);

-- student_id + practice_date 全局唯一，避免并发领取重复出题。
CREATE TABLE IF NOT EXISTS practice_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES practice_plans(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  practice_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  estimated_seconds INTEGER NOT NULL DEFAULT 0,
  selection_meta TEXT NOT NULL DEFAULT '{}',
  claimed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, practice_date)
);

-- 保存题目快照；题库更新不会改变历史练习。
CREATE TABLE IF NOT EXISTS practice_assignment_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES practice_assignments(id),
  question_id INTEGER REFERENCES practice_questions(id),
  position INTEGER NOT NULL,
  snapshot_stem TEXT NOT NULL,
  snapshot_answer TEXT NOT NULL,
  snapshot_module TEXT NOT NULL,
  snapshot_type TEXT NOT NULL,
  snapshot_difficulty INTEGER NOT NULL,
  estimated_seconds INTEGER NOT NULL,
  signature TEXT NOT NULL,
  template_key TEXT NOT NULL,
  UNIQUE(assignment_id, position),
  UNIQUE(assignment_id, signature)
);

CREATE TABLE IF NOT EXISTS practice_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER UNIQUE NOT NULL REFERENCES practice_assignments(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'submitted',
  teacher_note TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at DATETIME
);

-- 通用私有文件元数据。业务表只关联 file_id，下载统一走鉴权 token。
CREATE TABLE IF NOT EXISTS private_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id),
  purpose TEXT NOT NULL,
  owner_type TEXT NOT NULL,
  owner_id INTEGER NOT NULL,
  storage_key TEXT UNIQUE NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  original_name TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practice_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES practice_submissions(id),
  owner_parent_id INTEGER NOT NULL REFERENCES users(id),
  file_id INTEGER UNIQUE NOT NULL REFERENCES private_files(id),
  sha256 TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, sha256)
);

CREATE TABLE IF NOT EXISTS practice_reviews (
  submission_id INTEGER NOT NULL REFERENCES practice_submissions(id),
  assignment_item_id INTEGER NOT NULL REFERENCES practice_assignment_items(id),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
  teacher_note TEXT,
  reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(submission_id, assignment_item_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_question_scope
  ON practice_questions(grade_band, subject, module, difficulty, is_active);
CREATE INDEX IF NOT EXISTS idx_practice_question_region
  ON practice_questions(source_region, is_active);
CREATE INDEX IF NOT EXISTS idx_practice_plan_class_dates
  ON practice_plans(class_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_practice_assignment_plan_date
  ON practice_assignments(plan_id, practice_date, status);
CREATE INDEX IF NOT EXISTS idx_practice_assignment_student_date
  ON practice_assignments(student_id, practice_date);
CREATE INDEX IF NOT EXISTS idx_practice_submission_status
  ON practice_submissions(status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_practice_attachment_submission
  ON practice_attachments(submission_id);
CREATE INDEX IF NOT EXISTS idx_private_file_owner
  ON private_files(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_private_file_student
  ON private_files(student_id, purpose);
CREATE INDEX IF NOT EXISTS idx_practice_review_item
  ON practice_reviews(assignment_item_id, is_correct);
