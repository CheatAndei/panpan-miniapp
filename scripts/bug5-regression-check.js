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
const teacherFeedback = read('pages/teacher-feedback/index.vue');
const teacherClasses = read('pages/teacher-classes/index.vue');
const bind = read('backend/routes/bind.js');

assert('特殊签退有长文案字段兜底', notify.includes('TPL_FIELD_CHECKOUT_NOTE') && notify.includes('checkoutData'));
assert('特殊签退 phrase 保持短状态', notify.includes("isSpecial ? '已离开' : '已下课离开'"));
assert('特殊签退 thing 字段可显示完整文案', notify.includes("isSpecial && /^thing\\d+$/.test(statusField) ? note"));
assert('JSON 上传大小足够', server.includes("express.json({ limit: '40mb' })"));
assert('图片和 PDF 支持 base64 上传', feedbacks.includes('saveBase64Upload') && feedbacks.includes("req.body?.base64"));
assert('前端上传绕开 uploadFile 域名限制', api.includes('uploadAsBase64') && api.includes('getFileSystemManager'));
assert('签到请假按钮横向排列', checkin.includes('.stu-right{display:flex') && checkin.includes('gap:12rpx'));
assert('教师头像有兜底', mine.includes('teacherAvatarBroken') && mine.includes('teacher-avatar-fallback'));
assert('反馈通知备注使用班级名', notify.includes("FIELDS.feedback.note, cls?.name || '学习小组'"));
assert('PDF 使用 request 写入本地后打开', api.includes('openPdfDocument') && api.includes("responseType: 'arraybuffer'"));
assert('PDF ArrayBuffer 写入不强设 binary 编码', !api.includes("encoding: 'binary'"));
assert('PDF 写入、打开或请求失败会回退下载', api.includes('downloadAndOpenPdf') && api.includes('fail: fallback'));
assert('个人反馈可切换简洁和温馨模式', teacherFeedback.includes("_feedbackStyle:'concise'") && teacherFeedback.includes("se._feedbackStyle='warm'"));
assert('反馈风格会传入单个和批量 AI 请求', teacherFeedback.includes('style:se._feedbackStyle'));
assert('温馨模式使用长反馈提示词', feedbacks.includes("style === 'warm'") && feedbacks.includes('每人约180字'));
assert('学生姓名不再省略显示', teacherClasses.includes('max-width:none') && teacherClasses.includes('white-space:normal'));
assert('性格选项会跨分类去重', teacherClasses.includes('displayCats') && teacherClasses.includes('const used=new Set()'));
assert('教师邀请码有生产环境兼容兜底', bind.includes('LEGACY_TEACHER_CODES') && bind.includes('teacherInviteCodes'));
assert('PANAAA 老师邀请码会和生产配置合并生效', bind.includes("'PANAAA'") && bind.includes('new Set([...LEGACY_TEACHER_CODES, ...configured])'));
assert('家长我的页展示老师联系方式', mine.includes('teacher-contact') && mine.includes('teacher_phone'));
