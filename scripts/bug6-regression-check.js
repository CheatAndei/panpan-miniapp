const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function assert(name, ok) {
  if (!ok) {
    console.error('FAIL ' + name);
    process.exitCode = 1;
  } else {
    console.log('OK ' + name);
  }
}

const classes = read('pages/teacher-classes/index.vue');
const checkin = read('pages/teacher-checkin/index.vue');
const bind = read('pages/bind/bind.vue');
const api = read('utils/api.js');
const checkinRoutes = read('backend/routes/checkins.js');
const notify = read('backend/routes/notify.js');

assert('邀请码固定在学生行右上角', classes.includes('.s-code {') && classes.includes('position:absolute') && classes.includes('right:28rpx'));
assert('复制分享删除按钮保持同一行', classes.includes('.stu-actions {') && classes.includes('flex-wrap:nowrap') && !classes.includes('.stu-actions { width:100%'));
assert('签到页提供未到达提醒按钮', checkin.includes('remindArrival(se,s)') && checkin.includes('提醒'));
assert('提醒接口校验老师所属学生', checkinRoutes.includes("router.post('/remind-arrival'") && checkinRoutes.includes('teacherOwnsStudent'));
assert('打卡提醒复用签到模板并发送仍未到达', notify.includes('notifyArrivalReminder') && notify.includes("[FIELDS.checkin.status, '仍未到达']"));
assert('绑定邀请码前刷新微信登录 token', bind.includes('doLogin') && bind.includes('await doLogin();') && bind.includes('await this.submitBinding();'));
assert('绑定请求可禁止全局登录过期跳转', api.includes('const { handleUnauthorized = true } = options;') && api.includes('res.statusCode === 401 && handleUnauthorized'));
assert('绑定遇到 401 会静默刷新并仅重试一次', bind.includes("handleUnauthorized:false") && bind.includes('e?.statusCode!==401') && bind.includes('async submitBinding()'));
