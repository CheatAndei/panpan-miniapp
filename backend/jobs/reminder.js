const cron = require('node-cron');
const { getDB } = require('../db/init');

let job;

function start() {
  // 每分钟检查一次
  job = cron.schedule('* * * * *', async () => {
    try {
      const db = getDB();
      const minutes = parseInt(process.env.REMINDER_MINUTES || '30');

      const now = new Date();
      const today = now.getDay(); // 0=Sun
      const currentTime = now.toTimeString().slice(0, 5); // "HH:MM"

      // 计算目标时间：当前时间 + REMINDER_MINUTES
      const targetDate = new Date(now.getTime() + minutes * 60 * 1000);
      const targetTime = targetDate.toTimeString().slice(0, 5);

      // 查找今天、目标时间的课表
      const schedules = db.all(
        'SELECT s.*, c.name as class_name, c.id as class_id FROM schedules s LEFT JOIN classes c ON c.id=s.class_id WHERE s.day_of_week=? AND s.start_time=? AND s.is_active=1',
        [today, targetTime]);

      for (const schedule of schedules) {
        await notifyParents(db, schedule);
      }
    } catch (err) {
      console.error('Reminder cron error:', err.message);
    }
  });

  console.log('Reminder cron started');
}

async function notifyParents(db, schedule) {
  try {
    await require('../routes/notify').notifyReminder(schedule.class_id, {
      note: schedule.location || '',
      startTime: schedule.start_time || ''
    });
  } catch (e) {
    console.error('[REMINDER] notify failed:', e.message);
  }
}

function stop() {
  if (job) job.stop();
}

module.exports = { start, stop };
