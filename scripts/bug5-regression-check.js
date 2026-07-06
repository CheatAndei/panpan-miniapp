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

const notify = read('backend/routes/notify.js');
const feedbacks = read('backend/routes/feedbacks.js');
const server = read('backend/server.js');
const api = read('utils/api.js');
const checkin = read('pages/teacher-checkin/index.vue');
const mine = read('pages/mine/index.vue');

assert('特殊签退有长文案字段兜底', notify.includes('TPL_FIELD_CHECKOUT_NOTE') && notify.includes('checkoutData'));
assert('特殊签退 phrase 保持短状态', notify.includes("isSpecial ? '已离开' : '已下课离开'"));
assert('特殊签退 thing 字段可显示完整文案', notify.includes("isSpecial && /^thing\\d+$/.test(statusField) ? note"));
assert('JSON 上传大小足够', server.includes("express.json({ limit: '40mb' })"));
assert('图片和 PDF 支持 base64 上传', feedbacks.includes('saveBase64Upload') && feedbacks.includes("req.body?.base64"));
assert('前端上传绕开 uploadFile 域名限制', api.includes('uploadAsBase64') && api.includes('getFileSystemManager'));
assert('签到请假按钮横向排列', checkin.includes('.stu-right{display:flex') && checkin.includes('gap:12rpx'));
assert('教师头像有兜底', mine.includes('teacherAvatarBroken') && mine.includes('teacher-avatar-fallback'));
