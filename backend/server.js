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
const homeworkRoutes = require('./routes/homework');
const practiceRoutes = require('./routes/practice');
const mentalArenaRoutes = require('./routes/mental-arena');
const privateFileRoutes = require('./routes/private-files');
const learningRoutes = require('./routes/learning');
const growthRoutes = require('./routes/growth');
const examRoutes = require('./routes/exams');
const weeklyChallengeRoutes = require('./routes/weekly-challenge');

const app = express();
const PORT = Number(process.env.PORT || 3000);
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
app.use('/api/homework', homeworkRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/mental-arena', mentalArenaRoutes);
app.use('/api/private-files', privateFileRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/weekly-challenge', weeklyChallengeRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), build: 'panpan-v1.5.0' });
});

// 所有未捕获的路由错误统一返回 JSON，避免小程序收到 HTML 错误页后再次解析失败。
app.use((err, req, res, next) => {
  console.error('[route-error]', req.method, req.originalUrl, err);
  if (res.headersSent) return next(err);
  const message = process.env.NODE_ENV === 'production' ? '服务暂时不可用' : (err?.message || '服务暂时不可用');
  return res.status(500).json({ error: message });
});

// 初始化数据库并启动
async function start() {
  await initDB();
  console.log('Database ready');

  // 启动定时提醒
  if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_REMINDER !== 'true') {
    try {
      require('./jobs/reminder').start();
      require('./jobs/practice-generator').start();
    } catch (e) {
      console.log('Reminder cron skipped');
    }
  }

  return app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
