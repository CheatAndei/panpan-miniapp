const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('周末攻坚战学生页与教师批阅页均已注册', () => {
  const pages = JSON.parse(read('pages.json')).pages;
  const mastery = pages.find((item) => item.path === 'pages/weekend-mastery/index');
  const review = pages.find((item) => item.path === 'pages/weekend-mastery-review/index');

  assert.equal(mastery?.style?.navigationBarTitleText, '周末攻坚战');
  assert.equal(mastery?.style?.enablePullDownRefresh, true);
  assert.equal(review?.style?.navigationBarTitleText, '攻坚战批阅');
  assert.equal(review?.style?.enablePullDownRefresh, true);
});

test('家长首页与七年级学习中心均可直达周末攻坚战', () => {
  const parentHome = read('components/home/ParentHomeView.vue');
  const learningCenter = read('pages/learning-center/index.vue');

  assert.match(parentHome, /周末攻坚战/);
  assert.match(parentHome, /navigate\('\/pages\/weekend-mastery\/index\?student_id=' \+ child\.id\)/);
  assert.match(parentHome, /v-if="isGradeSevenChild"/);
  assert.match(parentHome, /return \/g7\|七\|7\|初一\//);
  assert.match(learningCenter, /item\.route === 'weekend_mastery'/);
  assert.match(learningCenter, /`\/pages\/weekend-mastery\/index\?student_id=\$\{studentId\.value\}`/);
});

test('家长首页攻坚战入口使用明亮糖果色，不出现黑块和粗黑边', () => {
  const parentHome = read('components/home/ParentHomeView.vue');

  assert.match(parentHome, /\.learning-shortcut\.featured-mastery\s*\{[^}]*border:\s*1rpx solid #CDE8F0/);
  assert.match(parentHome, /\.learning-shortcut\.featured-mastery \.shortcut-icon\s*\{[^}]*background:\s*#FFF48A/);
  assert.match(parentHome, /\.learning-shortcut\.featured-mastery \.shortcut-icon\s*\{[^}]*box-shadow:\s*5rpx 5rpx 0 #E5F8FE/);
  assert.doesNotMatch(parentHome, /\.learning-shortcut\.featured-mastery\s*\{[^}]*border:\s*2rpx solid #050505/);
  assert.doesNotMatch(parentHome, /\.learning-shortcut\.featured-mastery \.shortcut-icon\s*\{[^}]*background:\s*#050505/);
});

test('非七年级不会被误导，新客户端门禁能力与旧正式版安全隔离', () => {
  const page = read('pages/weekend-mastery/index.vue');
  const api = read('utils/api.js');
  const terminalRoutes = read('backend/routes/weekly-challenge.js');

  assert.match(page, /campaign && !campaign\.eligible/);
  assert.match(page, /当前仅七年级开放/);
  assert.match(api, /'X-Panpan-Client-Capabilities': 'weekend-mastery-v1'/);
  assert.match(terminalRoutes, /supportsWeekendMasteryGate/);
  assert.match(terminalRoutes, /WEEKEND_MASTERY_GATE_LEGACY_CLIENTS/);
  assert.match(terminalRoutes, /if \(!supportsWeekendMasteryGate\(req\)\) return false/);
});

test('教师首页展示攻坚战待办并进入独立批阅台', () => {
  const indexPage = read('pages/index/index.vue');
  const teacherHome = read('components/home/TeacherHomeView.vue');
  const review = read('pages/weekend-mastery-review/index.vue');

  assert.match(indexPage, /:pending-mastery-count="pendingMasteryCount"/);
  assert.match(indexPage, /:pending-mastery-todos="pendingMasteryTodos"/);
  assert.match(indexPage, /\/weekend-mastery\/teacher\/submissions\?status=submitted&limit=3/);
  assert.match(teacherHome, /pendingMasteryCount/);
  assert.match(teacherHome, /pendingMasteryTodos/);
  assert.match(teacherHome, /周末攻坚战/);
  assert.match(teacherHome, /\/pages\/weekend-mastery-review\/index/);

  assert.match(review, /MASTERY REVIEW DESK/);
  assert.match(review, /攻坚战批阅/);
  assert.match(review, /requestedStatus === 'all' \? visibleLimit\.value : 30/);
  assert.match(review, /\/weekend-mastery\/teacher\/submissions\?status=\$\{requestedStatus\}&limit=\$\{requestedLimit\}/);
  assert.match(review, /\/weekend-mastery\/teacher\/submissions\/\$\{item\.submission\.id\}\/review/);
  assert.match(review, /展开标准解法/);
  assert.match(review, /需要订正/);
  assert.match(review, /通过并解锁升级/);
});

test('攻坚战全部记录默认最新三份并每次增量展开十五份', () => {
  const review = read('pages/weekend-mastery-review/index.vue');
  const service = read('backend/services/weekend-mastery.js');

  assert.match(review, /visibleLimit\.value = value === 'all' \? 3 : 30/);
  assert.match(review, /visibleLimit\.value \+= 15/);
  assert.match(review, /再展开 \$\{Math\.min\(15, totalCount - items\.length\)\} 份/);
  assert.match(review, /status === 'all' && totalCount > items\.length/);
  assert.match(service, /normalizedStatus === 'all'[\s\S]*?COALESCE\(sub\.reviewed_at,sub\.submitted_at,sub\.created_at\) DESC,sub\.id DESC/u);
});

test('学生流程明确分成方法熟练与难度升级两关', () => {
  const page = read('pages/weekend-mastery/index.vue');

  assert.match(page, /class="stage-map"/);
  assert.match(page, /方法熟练/);
  assert.match(page, /进阶攻坚/);
  assert.match(page, /const stageOne = computed/);
  assert.match(page, /const stageTwo = computed/);
  assert.match(page, /stageOne\.value\?\.status === 'passed' && !stageTwo\.value/);
  assert.match(page, /@tap="advanceCampaign"/);
  assert.match(page, /'难度升级'/);
  assert.match(page, /\/weekend-mastery\/assignments\/\$\{stageOne\.value\.id\}\/advance/);
  assert.match(page, /Number\(currentAssignment\.stage\) === 2 \? '偏难' : '适中'/);
});

test('订正状态使用醒目的浅红底与深红文字', () => {
  const page = read('pages/weekend-mastery/index.vue');

  assert.match(page, /currentAssignment\.status === 'reviewed_wrong'/);
  assert.match(page, /class="correction-alert" role="alert"/);
  assert.match(page, /这关还要订正/);
  assert.match(page, /\.correction-alert\{[^}]*background:#FFF0F3/);
  assert.match(page, /\.correction-title\{[^}]*color:#B53A52/);
  assert.match(page, /teacher_note/);
});

test('题面由结构化组件显示，上下分数与右上角乘方均有专门渲染', () => {
  const page = read('pages/weekend-mastery/index.vue');
  const review = read('pages/weekend-mastery-review/index.vue');
  const problemSheet = read('components/pp-problem-sheet/pp-problem-sheet.vue');
  const mathText = read('components/pp-math-text/pp-math-text.vue');
  const mathDisplay = read('utils/math-display.js');

  assert.match(page, /<pp-problem-sheet :render="questionRender" \/>/);
  assert.match(review, /<pp-problem-sheet[^>]+:render="item\.question\?\.render \|\| item\.render"/);
  for (const section of ['paragraph', 'formula', 'list', 'table', 'number_line', 'note']) {
    assert.match(problemSheet, new RegExp(`section\\.type === '${section}'`), section);
  }
  assert.match(problemSheet, /<pp-math-text/);

  assert.match(mathText, /block\.type === 'fraction'/);
  assert.match(mathText, /normalizeMathPowers\(block\.numerator\)/);
  assert.match(mathText, /normalizeMathPowers\(block\.denominator\)/);
  assert.match(mathText, /class="math-numerator"/);
  assert.match(mathText, /class="math-denominator"/);
  assert.match(mathText, /border-bottom:2rpx solid currentColor/);
  assert.match(mathDisplay, /SUPERSCRIPT_DIGITS/);
  assert.match(mathDisplay, /'2': '²'/);
  assert.match(mathDisplay, /export function normalizeMathPowers/);
});

test('攻坚战不再用整题截图，图片仅用于学生作答与海报预览', () => {
  const page = read('pages/weekend-mastery/index.vue');
  const review = read('pages/weekend-mastery-review/index.vue');
  const problemSheet = read('components/pp-problem-sheet/pp-problem-sheet.vue');

  assert.doesNotMatch(page, /pp-question-reader|questionImage|question_image_url|question_url|题图/);
  assert.doesNotMatch(review, /pp-question-reader|questionImage|question_image_url|question_url|题图/);
  assert.doesNotMatch(problemSheet, /<image|questionImage|question_image_url/);
  assert.match(page, /class="photo-grid"/);
  assert.match(page, /class="poster-preview"/);
});

test('攻坚战批阅仅默认展开第一位学生的大图，其他学生按需单独展开', () => {
  const review = read('pages/weekend-mastery-review/index.vue');

  assert.match(review, /photoExpanded:index===0/);
  assert.match(review, /v-if="!item\.photoExpanded"/);
  assert.match(review, /async function expandPhotos\(item\)/);
  assert.match(review, /entry\.photoExpanded=entry===item/);
  assert.match(review, /class="student-photo-main"/);
  assert.match(review, /class="student-photo-thumbs"/);
  assert.match(review, /\.student-photo-main\{[^}]*height:620rpx/);
  assert.doesNotMatch(review, /<scroll-view scroll-x class="photos">/);
});

test('通关海报使用学生完整姓名与黑金攻坚战战报', () => {
  const page = read('pages/weekend-mastery/index.vue');
  const poster = read('utils/weekend-mastery-poster.js');

  assert.match(page, /studentName: campaign\.value\.student_name/);
  assert.match(page, /海报使用学生完整姓名/);
  assert.match(poster, /if \(!fullName\) throw new Error\('缺少学生完整姓名'\)/);
  assert.match(poster, /周末攻坚战/);
  assert.match(poster, /#070707/);
  assert.match(poster, /#F6C445/);
  assert.match(poster, /PANPAN \/\/ WEEKEND MASTERY/);
  assert.match(poster, /双关制霸/);
  assert.match(poster, /WEEKEND VICTORY REPORT/);
  assert.doesNotMatch(poster, /压轴挑战|BREAKTHROUGH REPORT|VERIFIED|questionImage|drawImage/);
});

test('双关通过后学生端只展示一次全屏通关动效', () => {
  const page = read('pages/weekend-mastery/index.vue');

  assert.match(page, /v-if="celebrationVisible" class="victory-overlay"/);
  assert.match(page, /\{\{ campaign\.student_name \}\}/);
  assert.match(page, /双关制霸/);
  assert.match(page, /panpan:weekend-mastery-cleared:/);
  assert.match(page, /if \(uni\.getStorageSync\(key\)\) return/);
  assert.match(page, /uni\.setStorageSync\(key, '1'\)/);
  assert.match(page, /setTimeout\(closeCelebration, 2000\)/);
  assert.match(page, /prefers-reduced-motion:reduce/);
});

test('登录首页播放全名全服捷报并在播放后按账号记已读', () => {
  const indexPage = read('pages/index/index.vue');
  const ticker = read('components/home/MasteryBroadcastTicker.vue');
  const routes = read('backend/routes/weekend-mastery.js');
  const service = read('backend/services/weekend-mastery.js');
  const schema = read('backend/db/schema.sql');

  assert.match(indexPage, /<MasteryBroadcastTicker/);
  assert.match(indexPage, /\/weekend-mastery\/broadcasts\?limit=10/);
  assert.match(indexPage, /\/weekend-mastery\/broadcasts\/\$\{assignmentId\}\/read/);
  assert.match(indexPage, /requestedUserId === Number\(user\.value\.id \|\| 0\)/);
  assert.match(indexPage, /function resetMasteryBroadcasts\(\)/);
  assert.match(indexPage, /masteryBroadcastRequest \+= 1/);
  assert.match(ticker, /全服捷报/);
  assert.match(ticker, /\{\{ broadcast\.message \}\}/);
  assert.match(ticker, /mastery-marquee 5\.2s linear/);
  assert.match(ticker, /prefers-reduced-motion: reduce/);
  assert.match(routes, /router\.get\('\/broadcasts', auth/);
  assert.match(routes, /router\.post\('\/broadcasts\/:assignmentId\/read', auth/);
  assert.match(service, /\$\{row\.student_name\}同学双关制霸/);
  assert.match(service, /24 \* 60 \* 60 \* 1000/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS weekend_mastery_broadcast_reads/);
  assert.match(schema, /PRIMARY KEY\(assignment_id,user_id\)/);
});

test('压轴挑战识别 423 门禁并引导跳转周末攻坚战', () => {
  const terminal = read('pages/weekly-challenge/index.vue');

  assert.match(terminal, /Number\(requestError\?\.statusCode\)!==423/);
  assert.match(terminal, /requestError\?\.code!=='WEEKEND_MASTERY_REQUIRED'/);
  assert.match(terminal, /gateBlocked\.value=true/);
  assert.match(terminal, /title:'先完成周末攻坚战'/);
  assert.match(terminal, /confirmText:'去完成'/);
  assert.match(terminal, /if\(result\.confirm\)openWeekendMastery\(\)/);
  assert.match(terminal, /uni\.redirectTo\(\{url:`\/pages\/weekend-mastery\/index\?student_id=\$\{studentId\.value\}`\}\)/);
});
