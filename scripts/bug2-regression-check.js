const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`);
  console.log(`PASS: ${name}`);
}

const feedbacks = read('backend/routes/feedbacks.js');
const schedules = read('backend/routes/schedules.js');
const notify = read('backend/routes/notify.js');
const teacherFeedback = read('pages/teacher-feedback/index.vue');
const teacherClasses = read('pages/teacher-classes/index.vue');
const envExample = read('backend/.env.example');
const readme = read('README-DOCKER.md');

assert('邀请码可复制', teacherClasses.includes('uni.setClipboardData') && teacherClasses.includes('copyInviteCode'));
assert('课表发布不清空全部反馈', !schedules.includes("DELETE FROM feedbacks WHERE teacher_id=?', [req.user.id]"));
assert('删除课表/课程实例会删对应反馈', schedules.includes('deleteFeedbackForSession') && schedules.includes('DELETE FROM feedbacks WHERE teacher_id=? AND class_id=? AND class_date=?'));
assert('学习小组总反馈不再引用未定义 students', !feedbacks.includes('students.length * 150') && feedbacks.includes('callAI(prompt, 900)'));
assert('学习笔记可单独发送并带备注', feedbacks.includes("router.post('/publish-notes'") && teacherFeedback.includes('publishNotes') && teacherFeedback.includes('note_remark'));
assert('签到签退通知使用微信实际字段 time3/phrase2', envExample.includes('TPL_FIELD_CHECKIN_TIME=time3') && envExample.includes('TPL_FIELD_CHECKIN_STATUS=phrase2') && readme.includes('time3') && readme.includes('phrase2'));
assert('通知时间字段兼容 time2/time3/time5 且值为 HH:mm', notify.includes('data.time2 = item') && notify.includes('data.time3 = item') && notify.includes('data.time5 = item') && notify.includes('function wxTime') && notify.includes('[fields.time, wxTime()]'));
