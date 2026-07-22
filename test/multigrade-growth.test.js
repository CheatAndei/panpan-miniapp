const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');

test('学习中心提供七年级、八年级、冲刺中考三入口并保存偏好',()=>{
  const source=read('pages/learning-center/index.vue');
  assert.match(source,/七年级/);assert.match(source,/八年级/);assert.match(source,/冲刺中考/);
  assert.match(source,/\/learning\/preferences/);assert.match(source,/knowledge-challenge/);assert.match(source,/exam-library/);
});

test('游客为已登录未绑定状态，体验隔离且不开放试卷',()=>{
  const home=read('pages/index/index.vue');const demo=read('pages/guest-experience/index.vue');const pages=read('pages.json');const brand=read('utils/brand.js');
  assert.match(pages,/pages\/guest-experience\/index/);assert.match(home,/尚未绑定学生/);assert.match(home,/TEACHER_WECHAT/);assert.match(brand,/sysu0011203/);
  assert.match(brand,/customer_service/);
  assert.match(demo,/体验成绩只保存在当前页面/);assert.match(demo,/不限次数/);assert.match(demo,/不能打开或下载/);
  assert.doesNotMatch(demo,/api\.post\([^)]*(choice|mental|challenge)/i);
  assert.match(demo,/setClipboardData/);assert.doesNotMatch(demo,/手机号|phone|mobile/i);
});

test('三类成就共用匿名海报，小程序码与保存相册链路完整',()=>{
  const page=read('pages/achievements/index.vue');const poster=read('utils/achievement-poster.js');const pages=read('pages.json');
  assert.match(pages,/pages\/achievements\/index/);assert.match(page,/选择刷题王/);assert.match(page,/口算王/);assert.match(page,/压轴挑战/);
  assert.match(page,/api\.downloadPrivate/);assert.match(page,/\/code\?student_id=/);assert.match(page,/saveAchievementPoster/);
  assert.match(page,/不展示学校和班级/);assert.match(poster,/真实学习数据/);assert.match(poster,/扫码免费体验/);
  assert.match(poster,/canvasToTempFilePath/);assert.match(poster,/saveImageToPhotosAlbum/);
});

test('连续压轴挑战已去掉每周限制并使用 V2 接口',()=>{
  const parent=read('pages/weekly-challenge/index.vue');const teacher=read('pages/weekly-review/index.vue');
  assert.match(parent,/连续闯关/);assert.match(parent,/\/weekly-challenge\/v2\/current/);assert.match(parent,/手动领取下一题/);
  assert.match(teacher,/\/weekly-challenge\/v2\/teacher\/submissions/);assert.match(teacher,/异常题跳过/);
  assert.doesNotMatch(parent,/本周只能|每周一次/);
});
