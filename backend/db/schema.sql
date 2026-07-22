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
  deleted_at DATETIME,
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

-- 学生转班只改变当前归属；历史业务数据保留原主键，并记录完整迁移轨迹。
CREATE TABLE IF NOT EXISTS student_class_transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  from_class_id INTEGER NOT NULL REFERENCES classes(id),
  to_class_id INTEGER NOT NULL REFERENCES classes(id),
  reason TEXT,
  transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  class_id INTEGER REFERENCES classes(id),
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
  topic_keys TEXT NOT NULL DEFAULT '[]',
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

-- 口算王挑战。题目与答案使用快照保存，保证题库更新后历史成绩仍可复核。
CREATE TABLE IF NOT EXISTS mental_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  battle TEXT NOT NULL CHECK(battle IN ('primary', 'junior')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
  questions_json TEXT NOT NULL,
  answer_detail TEXT,
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  elapsed_seconds INTEGER,
  correct_count INTEGER,
  total_questions INTEGER NOT NULL DEFAULT 20,
  speed_bonus INTEGER,
  score INTEGER,
  is_fishing INTEGER NOT NULL DEFAULT 0 CHECK(is_fishing IN (0, 1)),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 家长端学习闭环：服务端保存题目快照与判题结果，前端领取时永不返回答案。
CREATE TABLE IF NOT EXISTS learning_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  task_type TEXT NOT NULL,
  task_title TEXT NOT NULL,
  logical_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed')),
  battle TEXT NOT NULL CHECK(battle IN ('primary', 'junior')),
  grade_code TEXT NOT NULL DEFAULT 'g7' CHECK(grade_code IN ('g7','g8','g9')),
  subject_code TEXT NOT NULL DEFAULT 'math',
  questions_json TEXT NOT NULL,
  answer_detail TEXT,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  elapsed_seconds INTEGER,
  correct_count INTEGER,
  total_questions INTEGER NOT NULL,
  score INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, task_type, logical_date, grade_code, subject_code)
);

-- 错题来源可来自老师复核、作业批改、口算挑战和学习中心；连续答对两次后掌握。
CREATE TABLE IF NOT EXISTS wrong_item_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  grade_band TEXT NOT NULL,
  module TEXT,
  question_type TEXT,
  snapshot_stem TEXT,
  snapshot_answer TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'mastered')),
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  total_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at DATETIME,
  mastered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS achievement_awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  badge_code TEXT NOT NULL,
  awarded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, badge_code)
);

CREATE TABLE IF NOT EXISTS achievement_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  achievement_key TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('choice','mental','challenge')),
  metric_key TEXT NOT NULL,
  metric_value INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  scene_token TEXT NOT NULL UNIQUE,
  achieved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  seen_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, achievement_key)
);

CREATE TABLE IF NOT EXISTS student_learning_preferences (
  student_id INTEGER PRIMARY KEY REFERENCES students(id),
  grade_code TEXT NOT NULL DEFAULT 'g7' CHECK(grade_code IN ('g7','g8','g9')),
  subject_code TEXT NOT NULL DEFAULT 'math',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_key TEXT UNIQUE NOT NULL,
  grade_code TEXT NOT NULL DEFAULT 'g8',
  subject_code TEXT NOT NULL DEFAULT 'math',
  chapter_name TEXT NOT NULL,
  title TEXT NOT NULL,
  knowledge_card TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stable_code TEXT UNIQUE NOT NULL,
  topic_key TEXT NOT NULL REFERENCES knowledge_topics(topic_key),
  stem TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK(correct_option IN ('A','B','C','D')),
  explanation TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  topic_key TEXT NOT NULL REFERENCES knowledge_topics(topic_key),
  question_ids_json TEXT NOT NULL,
  answers_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
  correct_count INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  week_start DATE NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, week_start)
);

CREATE TABLE IF NOT EXISTS engagement_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER REFERENCES users(id),
  event_name TEXT NOT NULL,
  event_key TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, event_key)
);

-- 广州真题库。原卷可面向已绑定家长，答案资产始终仅教师可见。
CREATE TABLE IF NOT EXISTS exam_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_kind TEXT NOT NULL CHECK(asset_kind IN ('paper', 'answer', 'preview', 'question', 'answer_image')),
  storage_key TEXT UNIQUE NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_papers (
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
  exam_type TEXT NOT NULL CHECK(exam_type IN ('midterm', 'final', 'monthly', 'mock')),
  paper_asset_id INTEGER NOT NULL REFERENCES exam_assets(id),
  answer_asset_id INTEGER REFERENCES exam_assets(id),
  source_relative_path TEXT NOT NULL,
  license_status TEXT NOT NULL DEFAULT 'pending_review',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'hidden')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_download_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam_papers(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER REFERENCES students(id),
  teacher_id INTEGER REFERENCES users(id),
  asset_kind TEXT NOT NULL CHECK(asset_kind IN ('paper', 'answer')),
  status TEXT NOT NULL CHECK(status IN ('requested', 'download_succeeded', 'opened', 'failed')),
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_answer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam_papers(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'dismissed')),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_at DATETIME,
  UNIQUE(exam_id, parent_id, student_id)
);

-- 每周图片挑战使用独立发布与复核模型，不污染自动判题的 learning_attempts。
CREATE TABLE IF NOT EXISTS weekly_challenge_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT UNIQUE,
  exam_id INTEGER REFERENCES exam_papers(id),
  question_type TEXT NOT NULL CHECK(question_type IN ('choice', 'fill', 'subjective')),
  title TEXT NOT NULL,
  question_asset_id INTEGER NOT NULL REFERENCES exam_assets(id),
  answer_asset_id INTEGER REFERENCES exam_assets(id),
  answer_text TEXT,
  source_label TEXT,
  grade_code TEXT NOT NULL DEFAULT 'g7' CHECK(grade_code IN ('g7','g8','g9')),
  subject_code TEXT NOT NULL DEFAULT 'math',
  topic_key TEXT,
  difficulty INTEGER NOT NULL DEFAULT 3,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_challenge_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  question_id INTEGER NOT NULL REFERENCES weekly_challenge_questions(id),
  week_start DATE NOT NULL,
  question_type TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, week_start)
);

CREATE TABLE IF NOT EXISTS weekly_challenge_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER UNIQUE NOT NULL REFERENCES weekly_challenge_assignments(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'reviewed')),
  teacher_note TEXT,
  is_correct INTEGER CHECK(is_correct IN (0, 1)),
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at DATETIME
);

CREATE TABLE IF NOT EXISTS weekly_challenge_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES weekly_challenge_submissions(id),
  file_id INTEGER UNIQUE NOT NULL REFERENCES private_files(id),
  sha256 TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id, sha256)
);

-- 连续压轴挑战 V2：旧 weekly 表只保留历史兼容，新领取全部进入 V2。
CREATE TABLE IF NOT EXISTS challenge_progress_v2 (
  student_id INTEGER NOT NULL REFERENCES students(id),
  grade_code TEXT NOT NULL CHECK(grade_code IN ('g7','g8','g9')),
  subject_code TEXT NOT NULL DEFAULT 'math',
  question_type TEXT NOT NULL CHECK(question_type IN ('fill','subjective')),
  passed_count INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(student_id,grade_code,subject_code,question_type)
);

CREATE TABLE IF NOT EXISTS challenge_assignments_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  question_id INTEGER NOT NULL REFERENCES weekly_challenge_questions(id),
  grade_code TEXT NOT NULL CHECK(grade_code IN ('g7','g8','g9')),
  subject_code TEXT NOT NULL DEFAULT 'math',
  question_type TEXT NOT NULL CHECK(question_type IN ('fill','subjective')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','submitted','reviewed_wrong','passed','replaced','skipped')),
  assigned_on DATE NOT NULL,
  replaced_by_id INTEGER REFERENCES challenge_assignments_v2(id),
  legacy_assignment_id INTEGER UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS challenge_submissions_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assignment_id INTEGER NOT NULL REFERENCES challenge_assignments_v2(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  attempt_no INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','reviewed')),
  teacher_note TEXT,
  is_correct INTEGER CHECK(is_correct IN (0,1)),
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at DATETIME,
  legacy_submission_id INTEGER UNIQUE,
  UNIQUE(assignment_id,attempt_no)
);

CREATE TABLE IF NOT EXISTS challenge_attachments_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL REFERENCES challenge_submissions_v2(id),
  file_id INTEGER UNIQUE NOT NULL REFERENCES private_files(id),
  sha256 TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(submission_id,sha256)
);

-- 教师可为学生设置真实冲榜目标，但目标不会生成或篡改挑战成绩。
CREATE TABLE IF NOT EXISTS mental_rank_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  battle TEXT NOT NULL CHECK(battle IN ('primary', 'junior')),
  target_rank INTEGER NOT NULL,
  target_score INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'expired')),
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- 选择刷题王。正确选项只保存在服务端，题目领取接口不得返回 correct_option / explanation。
CREATE TABLE IF NOT EXISTS choice_king_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stable_code TEXT UNIQUE NOT NULL,
  exam_id INTEGER REFERENCES exam_papers(id),
  question_asset_id INTEGER REFERENCES exam_assets(id),
  question_image_url TEXT,
  stem TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT,
  source_label TEXT,
  source_year INTEGER,
  source_period TEXT CHECK(source_period IN ('recent', 'older') OR source_period IS NULL),
  original_question_no TEXT,
  grade_code TEXT NOT NULL DEFAULT 'g7' CHECK(grade_code IN ('g7','g8','g9')),
  subject_code TEXT NOT NULL DEFAULT 'math',
  topic_key TEXT,
  difficulty INTEGER NOT NULL DEFAULT 2,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  stopped_by INTEGER REFERENCES users(id),
  stopped_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- client_request_id 在学生范围内唯一；response_json 保存完整判题响应，支持安全重试。
CREATE TABLE IF NOT EXISTS choice_king_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  question_id INTEGER NOT NULL REFERENCES choice_king_questions(id),
  selected_option TEXT NOT NULL CHECK(selected_option IN ('A', 'B', 'C', 'D')),
  is_correct INTEGER NOT NULL CHECK(is_correct IN (0, 1)),
  is_review INTEGER NOT NULL DEFAULT 0 CHECK(is_review IN (0, 1)),
  client_request_id TEXT NOT NULL,
  response_json TEXT,
  answered_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, client_request_id)
);

-- next 下发的服务端凭证。每名学生同时只有一道活动题，提交成功后与答题记录原子绑定并关闭。
CREATE TABLE IF NOT EXISTS choice_king_issuances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  question_id INTEGER NOT NULL REFERENCES choice_king_questions(id),
  issue_type TEXT NOT NULL CHECK(issue_type IN ('normal', 'review')),
  issued_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  closed_at DATETIME,
  close_reason TEXT CHECK(close_reason IN ('answered', 'expired', 'question_stopped') OR close_reason IS NULL),
  attempt_id INTEGER REFERENCES choice_king_attempts(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 错题始终关联原题。首次 1 天后重现，之后按 3/7 天推进；连续两次复习正确后掌握。
CREATE TABLE IF NOT EXISTS choice_king_wrong_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  question_id INTEGER NOT NULL REFERENCES choice_king_questions(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'mastered')),
  consecutive_correct INTEGER NOT NULL DEFAULT 0,
  review_stage INTEGER NOT NULL DEFAULT 0,
  review_attempts INTEGER NOT NULL DEFAULT 0,
  new_questions_since_review INTEGER NOT NULL DEFAULT 0,
  next_due_at DATETIME,
  last_wrong_at DATETIME,
  last_review_at DATETIME,
  mastered_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, question_id)
);

CREATE TABLE IF NOT EXISTS choice_king_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES choice_king_questions(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  detail TEXT,
  selected_answer TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
  teacher_note TEXT,
  handled_by INTEGER REFERENCES users(id),
  handled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 口算王与学习中心计算题报错。题干和答案使用提交时快照，历史任务不会因题库更新丢失。
CREATE TABLE IF NOT EXISTS calculation_question_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK(source_type IN ('mental_challenge', 'learning_attempt')),
  source_id INTEGER NOT NULL,
  source_label TEXT NOT NULL,
  source_question_id TEXT NOT NULL,
  bank_type TEXT NOT NULL CHECK(bank_type IN ('mental', 'practice')),
  bank_scope TEXT,
  bank_question_id TEXT NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id),
  parent_id INTEGER NOT NULL REFERENCES users(id),
  question_position INTEGER NOT NULL,
  question_type TEXT,
  snapshot_stem TEXT NOT NULL,
  snapshot_answer TEXT,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'dismissed')),
  teacher_note TEXT,
  handled_by INTEGER REFERENCES users(id),
  handled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 口算题库是代码生成资源，用独立控制表停题，避免改写历史挑战快照。
CREATE TABLE IF NOT EXISTS mental_question_controls (
  battle TEXT NOT NULL CHECK(battle IN ('primary', 'junior')),
  question_id TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK(is_active IN (0, 1)),
  reason TEXT,
  stopped_by INTEGER REFERENCES users(id),
  stopped_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(battle, question_id)
);

-- 停题只生成成绩复核记录，不自动改分；老师后续可按原始快照人工确认。
CREATE TABLE IF NOT EXISTS calculation_score_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_report_id INTEGER REFERENCES calculation_question_reports(id),
  bank_type TEXT NOT NULL CHECK(bank_type IN ('mental', 'practice')),
  bank_scope TEXT,
  bank_question_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('mental_challenge', 'learning_attempt')),
  source_id INTEGER NOT NULL,
  source_question_id TEXT NOT NULL,
  student_id INTEGER NOT NULL REFERENCES students(id),
  score_before INTEGER,
  correct_count_before INTEGER,
  answer_was_correct INTEGER CHECK(answer_was_correct IN (0, 1) OR answer_was_correct IS NULL),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'no_change', 'adjusted')),
  review_note TEXT,
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bank_type, bank_scope, bank_question_id, source_type, source_id, source_question_id)
);

CREATE TABLE IF NOT EXISTS teacher_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  alert_type TEXT NOT NULL,
  alert_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  read_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
CREATE INDEX IF NOT EXISTS idx_student_class_transfers_student
  ON student_class_transfers(student_id, transferred_at);
CREATE INDEX IF NOT EXISTS idx_practice_review_item
  ON practice_reviews(assignment_item_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_mental_challenge_student
  ON mental_challenges(student_id, battle, status, completed_at);
CREATE INDEX IF NOT EXISTS idx_mental_challenge_ranking
  ON mental_challenges(battle, status, score, completed_at);
CREATE INDEX IF NOT EXISTS idx_learning_attempt_student_date
  ON learning_attempts(student_id, logical_date, status);
CREATE INDEX IF NOT EXISTS idx_learning_attempt_week
  ON learning_attempts(student_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_question_topic
  ON knowledge_questions(topic_key,is_active,difficulty,id);
CREATE INDEX IF NOT EXISTS idx_knowledge_attempt_student
  ON knowledge_attempts(student_id,topic_key,status,started_at);
CREATE INDEX IF NOT EXISTS idx_wrong_progress_student_status
  ON wrong_item_progress(student_id, status, last_attempt_at);
CREATE INDEX IF NOT EXISTS idx_weekly_report_student_week
  ON weekly_reports(student_id, week_start);
CREATE INDEX IF NOT EXISTS idx_exam_papers_filters
  ON exam_papers(grade_code, subject_code, status, exam_type, exam_year);
CREATE INDEX IF NOT EXISTS idx_weekly_challenge_catalog
  ON weekly_challenge_questions(grade_code, subject_code, question_type, is_active);
CREATE INDEX IF NOT EXISTS idx_exam_download_teacher
  ON exam_download_events(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_weekly_challenge_teacher_queue
  ON weekly_challenge_submissions(status, submitted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_v2_one_current
  ON challenge_assignments_v2(student_id,grade_code,subject_code,question_type)
  WHERE status IN ('active','submitted','reviewed_wrong');
CREATE INDEX IF NOT EXISTS idx_challenge_v2_teacher_queue
  ON challenge_submissions_v2(status,submitted_at);
CREATE INDEX IF NOT EXISTS idx_challenge_v2_history
  ON challenge_assignments_v2(student_id,grade_code,subject_code,question_type,status,created_at);
CREATE INDEX IF NOT EXISTS idx_achievement_records_student
  ON achievement_records(student_id,achieved_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_mental_rank_goals_student
  ON mental_rank_goals(student_id, battle, status);
CREATE INDEX IF NOT EXISTS idx_choice_king_question_active
  ON choice_king_questions(grade_code, subject_code, is_active, source_period, id);
CREATE INDEX IF NOT EXISTS idx_choice_king_attempt_student_question
  ON choice_king_attempts(student_id, question_id, is_review, answered_at);
CREATE INDEX IF NOT EXISTS idx_choice_king_attempt_first_correct
  ON choice_king_attempts(question_id, student_id, is_correct, is_review, answered_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_choice_king_one_active_issuance
  ON choice_king_issuances(student_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_choice_king_issuance_question
  ON choice_king_issuances(question_id, closed_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_choice_king_wrong_due
  ON choice_king_wrong_progress(student_id, status, next_due_at, new_questions_since_review);
CREATE INDEX IF NOT EXISTS idx_choice_king_report_status
  ON choice_king_reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_calculation_report_teacher_queue
  ON calculation_question_reports(source_type, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calculation_report_open_unique
  ON calculation_question_reports(student_id, source_type, source_id, source_question_id)
  WHERE status='open';
CREATE INDEX IF NOT EXISTS idx_calculation_report_bank_question
  ON calculation_question_reports(bank_type, bank_scope, bank_question_id, status);
CREATE INDEX IF NOT EXISTS idx_mental_question_control_active
  ON mental_question_controls(battle, is_active, question_id);
CREATE INDEX IF NOT EXISTS idx_calculation_score_review_queue
  ON calculation_score_reviews(status, created_at, student_id);
CREATE INDEX IF NOT EXISTS idx_teacher_alert_unread
  ON teacher_alerts(teacher_id, read_at, created_at);
