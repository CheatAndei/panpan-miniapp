-- 教培小程序数据库 Schema
-- SQLite

-- 用户表（老师 + 家长）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT UNIQUE NOT NULL,
  nickname TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'parent',
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
