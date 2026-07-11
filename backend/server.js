require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDB } = require('./db/init');

const authRoutes = require('./routes/auth');
const classRoutes = require('./routes/classes');
const studentRoutes = require('./routes/students');
const scheduleRoutes = require('./routes/schedules');
const checkinRoutes = require('./routes/checkins');
const feedbackRoutes = require('./routes/feedbacks');
const leaveRoutes = require('./routes/leaves');
const bindRoutes = require('./routes/bind');
const profileRoutes = require('./routes/profiles');
const notifyRoutes = require('./routes/notify');

const app = express();
const PORT = process.env.PORT || 3000;
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 中间件
app.use(cors({ origin: corsOrigins.length > 0 ? corsOrigins : false }));
app.use(express.json({ limit: '40mb' }));
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求格式错误' });
  }
  next(err);
});

// 静态文件（上传的图片/PDF）
app.use('/uploads', express.static(UPLOAD_DIR, {
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/bind', bindRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/notify', notifyRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), build: 'bug5-pdf-note-v1' });
});

// 初始化数据库并启动
async function start() {
  await initDB();
  console.log('Database ready');

  // 启动定时提醒
  try {
    require('./jobs/reminder').start();
  } catch (e) {
    console.log('Reminder cron skipped');
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
