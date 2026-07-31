const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const review = read('pages/practice-review/index.vue');
const teacher = read('pages/practice-teacher/index.vue');
const parent = read('pages/practice-parent/index.vue');
const home = read('pages/index/index.vue') + read('components/home/ParentHomeView.vue');

test('手机批改台使用上下布局、横向滑选题卡并用单图原生手势缩放拖动', () => {
  assert.ok(review.indexOf('photo-pane') < review.indexOf('answer-pane'), '照片应排在答案前面');
  assert.match(review, /\.workbench\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/u);
  assert.match(review, /<scroll-view[\s\S]*?class="answer-scroll"[\s\S]*?scroll-x/u);
  assert.match(review, /class="answer-track"/);
  assert.match(review, /\.answer-track\s*\{[\s\S]*?display:\s*inline-flex;/u);
  assert.match(review, /\.answer-row\s*\{[\s\S]*?width:\s*316rpx;[\s\S]*?flex:\s*0 0 316rpx;/u);
  assert.match(review, /左右滑动题卡，点击整张题卡标记错题/);
  assert.match(review, /<movable-area[\s\S]*?<movable-view/u);
  assert.match(review, /:scale-min="1"/);
  assert.match(review, /:scale-max="4"/);
  assert.match(review, /direction="all"/);
  assert.match(review, /:inertia="false"/);
  assert.match(review, /:animation="false"/);
  assert.match(review, /:out-of-bounds="false"/);
  assert.doesNotMatch(review, /:x="activePhotoGesture\.x"/);
  assert.doesNotMatch(review, /:y="activePhotoGesture\.y"/);
  assert.doesNotMatch(review, /:scale-value="activePhotoGesture\.scale"/);
  assert.doesNotMatch(review, /@change="onPhotoMove"/);
  assert.doesNotMatch(review, /@scale="onPhotoScale"/);
  assert.match(review, /:key="activePhotoViewKey"/);
  assert.match(review, /双指缩放 1×–4×/);
  assert.doesNotMatch(review, /<swiper|<swiper-item/);
  assert.doesNotMatch(review, /_photoGestures/);
  assert.match(review, /class="photo-thumbs"/);
  assert.match(review, /点缩略图切换/);
  assert.match(review, /changePhotoBy/);
  assert.match(review, /_photoResetKeys/);
  assert.doesNotMatch(review, /function previewPhoto/);
  assert.doesNotMatch(review, /@tap="previewPhoto/);
});

test('批改台每次安全 onShow 都刷新队列，同时保护未保存批改', () => {
  assert.match(review, /const hasShown = ref\(false\)/);
  assert.match(review, /onShow\(\(\) => \{[\s\S]*?const firstShow = !hasShown\.value[\s\S]*?hasUnsavedChanges[\s\S]*?loadQueue\(\)/u);
  assert.match(review, /!firstShow && hasUnsavedChanges/);
  assert.doesNotMatch(review, /if \(hasShown\.value\) return/);
  assert.match(review, /currentSubmissionId/);
  assert.match(review, /current\?\._saved[\s\S]*?return/u);
  assert.match(review, /submission\._saved = true/);
  assert.match(review, /@tap="activeSubmission\._history \? goPracticeTeacher\(\) : nextAfterSave\(\)"/);
  assert.match(review, /activeSubmission\._history \? '返回计划' : '下一位'/);
  assert.match(review, /async function nextAfterSave\(\)[\s\S]*?submissions\.value\.splice/u);
});

test('已批改打卡可从计划历史重新进入并查看或补存私密海报', () => {
  assert.match(teacher, /status=reviewed&limit=50/);
  assert.match(teacher, /status=correction_required&limit=50/);
  assert.match(teacher, /@tap\.stop="openSavedReview\(record\)"/);
  assert.match(teacher, /查看 \/ 补存海报/);
  assert.match(teacher, /submission_id=\$\{submissionId\}&history=1/);
  assert.match(review, /status=all&limit=50&page=1&submission_id=\$\{submissionId\}/);
  assert.match(review, /prepareSubmission\(record, \{ history: true \}\)/);
  assert.match(review, /currentRoundAttachments/);
  assert.match(review, /const roundAttachments = Array\.isArray\(currentRound\?\.attachments\)/);
  assert.match(review, /return roundAttachments\.length \? roundAttachments : attachments/);
  assert.match(review, /const focusedItems = !isHistorical && isCorrection && focusSet\.size/);
  assert.match(review, /_correct: isHistorical \? reviewedItemCorrect\(item\) : true/);
  assert.match(review, /action-text="查看已批改记录"/);
});

test('批改台默认展示最近三份并允许展开、横滑、修改和重做海报', () => {
  assert.match(review, /\/practice\/reviews\/recent\?limit=20/);
  assert.match(review, /recentReviews\.value\.slice\(0,\s*3\)/);
  assert.match(review, /默认展示最近 3 份，可展开横向查看/);
  assert.match(review, /class="recent-scroll"[\s\S]*?scroll-x/u);
  assert.match(review, /查看 \/ 修改 \/ 海报/);
  assert.match(review, /beginReviewEdit/);
  assert.match(review, /确认修改批改结果/);
  assert.match(review, /api\.put\(`\/practice\/submissions\/\$\{submission\.id\}\/review\/revision`/);
  assert.match(review, /expected_round: submission\._correctionRound/);
  assert.match(review, /expected_revision: Number\(submission\._reviewVersion \|\| 0\)/);
  assert.match(review, /wrong_positions/);
  assert.match(review, /can_revise/);
  assert.match(review, /重新出现订正任务/);
  assert.match(review, /待订正任务会立即取消/);
  assert.match(review, /submission\._posterPath = ''/);
  assert.match(review, /修改会立即同步家长端/);
});

test('订正批改只展示上一轮错题并把轮次带入保存与海报', () => {
  for (const field of ['is_correction', 'correction_round', 'needs_correction', 'focus_item_ids']) {
    assert.match(review, new RegExp(field));
  }
  assert.match(review, /只看新照片 \/ 上一轮错题/);
  assert.match(review, /focusSet\.has\(String\(item\.id\)\)/);
  assert.match(review, /round_no: submission\._correctionRound/);
  assert.match(review, /submission\.status = result\.status/);
  assert.match(review, /保存并打回/);
  assert.match(review, /已打回 \$\{submissionWrongCount\} 题/);
  assert.match(review, /已保存通过/);
  assert.match(review, /isCorrection: submission\._isCorrection/);
  assert.match(review, /correctionRound: submission\._correctionRound/);
  assert.doesNotMatch(review, /hasUnknownCorrectionTotal/);
  assert.match(review, /totalCount:\s*submission\.items\.length/);
  assert.match(review, /correctCount:\s*submission\.items\.filter/);
});

test('保存区移除刻意隐私说明并支持相册拒权后前往设置恢复', () => {
  assert.match(review, /鼓励文案会随机更新，预览满意后保存/);
  assert.doesNotMatch(review, /含姓名和作业照片，仅供私下发给家长/);
  assert.doesNotMatch(review, /私密批改记录/);
  assert.match(review, /isAlbumPermissionError/);
  assert.match(review, /需要相册权限/);
  assert.match(review, /uni\.openSetting/);
  assert.match(review, /scope\.writePhotosAlbum/);
  assert.match(review, /返回后会自动继续保存/);
  assert.match(review, /await savePracticeReviewPoster\(submission\._posterPath\)/);
  assert.doesNotMatch(review, /open-type="share"|二维码/);
  assert.doesNotMatch(
    review,
    /\.queue-controls button,\s*\.photo-nav button,\s*\.footer-actions button\s*\{[\s\S]*?min-height:\s*112rpx/u,
  );
  assert.match(review, /\.photo-actions button\s*\{[\s\S]*?min-height:\s*88rpx/u);
  assert.match(review, /@media \(prefers-reduced-motion:\s*reduce\)/);
});

test('批改台保持浅蓝主视觉，计算打卡海报单独使用绿色主题', () => {
  const poster = read('utils/practice-review-poster.js');

  for (const color of ['#527CC9', '#315EA8', '#EAF2FF', '#F6FAFF', '#24324A', '#D66D62']) {
    assert.match(review, new RegExp(color, 'u'));
  }
  for (const color of ['#34B98A', '#187A5D', '#E8F8F1', '#F4FBF8', '#234039']) {
    assert.match(poster, new RegExp(color, 'u'));
  }
  assert.doesNotMatch(poster, /#527CC9|#315EA8|#EAF2FF|#F4C75B/iu);
});

test('批改和私密海报异步处理中锁住学生上下文并提供持久错误重试', () => {
  assert.match(review, /const queueError = ref\(''\)/);
  assert.match(review, /type="error" title="批改台加载失败"[\s\S]*?@action="loadQueue"/u);
  assert.match(review, /activeSubmission\._saving \|\| activeSubmission\._posterBusy \|\| activeSubmission\._posterSaving/);
  assert.match(review, /activeSubmission\._saved && !activeSubmission\._editing/);
  assert.match(review, /const submissionWrongCount = submission\.items\.filter/);
  assert.match(review, /async function ensurePoster\(submission = activeSubmission\.value\)/);
  assert.match(review, /submission\._posterBusy \|\| submission\._posterSaving\) return/);
  assert.match(review, /submission\._activePhoto = 0/);
  assert.match(review, /const hasUnsavedChanges = current\?\._editing/);
  assert.match(review, /当前已批改记录的修改尚未保存/);
  assert.match(review, /async function retryPhotos\(\)[\s\S]*?submission\._posterPath = ''/u);
  assert.match(review, /Number\(error\?\.statusCode\) === 409[\s\S]*?loadRequestedSubmission/u);
});

test('家长页明确待订正状态且照片数只取当前轮', () => {
  assert.match(parent, /老师已打回/);
  assert.match(parent, /待上传订正照片/);
  assert.match(parent, /待订正/);
  assert.match(parent, /本轮新增 \{\{ attachmentCount \}\} 张/);
  assert.match(parent, /submission\.value\.attachment_count/);
  assert.match(parent, /submission\.value\?\.upload_round/);
  assert.match(parent, /if \(!submission\.value\) return 0/);
  assert.doesNotMatch(parent, /if \(!submission\.value \|\| needsCorrection\.value\) return 0/);
  assert.match(parent, /上传订正照片/);
  assert.match(parent, /订正已提交/);
  assert.match(parent, /correction_required/);
  assert.match(parent, /upload\?upload_complete=0/);
  assert.match(parent, /\/upload\/complete/);
  assert.match(parent, /已传好，确认送达老师/);
  assert.match(parent, /function confirmSavedUpload/);
  assert.match(parent, /\{ timeout: 60000 \}/);
  assert.doesNotMatch(parent, /index === files\.length - 1 \? 1 : 0/);
  assert.match(parent, /const canConfirmUpload = computed/);
  assert.match(parent, /\['uploading', 'correction_required'\]\.includes\(submission\.value\?\.status\)/);
  assert.match(parent, /v-if="submission && canConfirmUpload && attachmentCount"/);
  assert.match(parent, /\['submitted', 'reviewed'\]\.includes\(submission\.value\?\.status\)/);
  assert.doesNotMatch(parent, /\['submitted', 'reviewed', 'correction_required'\]\.includes\(submission\.value\?\.status\)/);
  assert.match(parent, /尚未送达老师/);
  assert.match(parent, /result\.submission\?\.status !== 'submitted'/);
  assert.match(parent, /\['submitted', 'reviewed'\]\.includes/);
  assert.match(parent, /已送达老师批改台/);
  assert.match(parent, /v-if="deliveredToTeacher && attachmentCount"/);
  assert.match(home, /task\.status === 'correction_required'/);
  assert.match(home, /return '去订正'/);
});
