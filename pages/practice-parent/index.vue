<template>
  <view class="page">
    <view class="practice-hero">
      <text class="eyebrow">DAILY PRACTICE</text>
      <text class="hero-title">每日初中计算打卡</text>
      <text class="hero-sub">{{ practiceDate || '今日' }} · 约 20 分钟</text>
    </view>

    <view v-if="loading" class="state-card"><pp-state type="loading" title="正在准备今日练习" /></view>
    <view v-else-if="error" class="state-card"><pp-state type="error" title="暂时无法加载" :description="error" action-text="重试" @action="loadData" /></view>
    <view v-else-if="!assignment" class="state-card"><pp-state title="今天没有打卡计划" description="老师发布假期计划后会显示在这里。" /></view>

    <template v-else>
      <view class="card plan-card">
        <view>
          <text class="plan-title">{{ plan.title }}</text>
          <text class="plan-meta">{{ plan.module }} · {{ assignment.items.length }} 题 · {{ minuteText }}</text>
        </view>
        <text :class="['status-pill', statusClass]">{{ statusText }}</text>
      </view>

      <view v-if="needsCorrection" class="correction-card">
        <text class="correction-kicker">老师已打回</text>
        <text class="correction-title">待上传订正照片</text>
        <text class="correction-copy">请订正老师标记的错题，只上传本轮新照片；提交后老师只复核上一轮错题。</text>
      </view>

      <view class="card question-card">
        <view class="section-head">
          <text class="section-title">今日题目</text>
          <text class="section-note">建议写在纸上</text>
        </view>
        <view v-for="item in assignment.items" :key="item.id" class="question-row">
          <text class="question-no">{{ item.position }}</text>
          <view class="question-copy">
            <pp-math-text
              class="question-text"
              :value="item.stem"
              :blocks="item.render && item.render.blocks"
            />
            <text class="question-type">{{ item.question_type }}</text>
          </view>
        </view>
      </view>

      <view class="card upload-card">
        <view class="section-head">
          <view>
            <text class="section-title">{{ needsCorrection || isCorrection ? '上传订正' : '拍照提交' }}</text>
            <text class="upload-help">
              {{ needsCorrection || isCorrection
                ? '只上传订正后的新照片；老师会仅复核上一轮错题，本轮最多 6 张'
                : '拍清题号和解题过程；照片会对应今天题单和标准答案供老师核对，最多 6 张' }}
            </text>
          </view>
          <text v-if="assignment.submission" class="photo-count">本轮新增 {{ attachmentCount }} 张</text>
        </view>
        <button class="primary-btn" :disabled="uploading || attachmentCount >= 6 || uploadLocked" aria-label="拍照上传打卡作业" @tap="chooseAndUpload">
          {{ uploadButtonText }}
        </button>
        <view v-if="assignment.submission" class="submit-note">
          <text>{{ submissionNote }}</text>
          <text v-if="isCorrection" class="round-note">当前为第 {{ correctionRound }} 轮订正</text>
          <text v-if="assignment.submission.teacher_note" class="teacher-note">{{ assignment.submission.teacher_note }}</text>
        </view>
      </view>

      <view v-if="attachmentCount" class="card share-card">
        <view class="share-mark">✓</view>
        <view class="share-copy">
          <text class="share-title">今日练习已完成</text>
          <text class="share-desc">分享到群里，邀请大家一起坚持每天多练一点</text>
          <text class="share-privacy">仅分享打卡鼓励卡，不包含学生作业照片</text>
        </view>
        <button class="share-btn" open-type="share">分享至群聊</button>
      </view>

      <view v-if="history.length" class="card history-card">
        <text class="section-title">最近记录</text>
        <view v-for="item in history.slice(0, 7)" :key="item.id" class="history-row">
          <text>{{ item.practice_date }}</text>
          <text :class="['history-status', historyStatusClass(item)]">
            {{ historyStatusText(item) }}
          </text>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref('');
const loading = ref(false);
const uploading = ref(false);
const uploadProgress = ref('');
const error = ref('');
const practiceDate = ref('');
const plan = ref({});
const assignment = ref(null);
const history = ref([]);

function booleanField(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function recordNeedsCorrection(record) {
  const status = record?.status ?? record?.submission_status;
  return booleanField(record?.needs_correction ?? record?.needsCorrection)
    || status === 'correction_required'
    || status === 'needs_correction'
    || status === 'returned';
}

const submission = computed(() => assignment.value?.submission || null);
const correctionRound = computed(() => Math.max(1, Number(submission.value?.correction_round ?? submission.value?.correctionRound ?? 1) || 1));
const isCorrection = computed(() => booleanField(submission.value?.is_correction ?? submission.value?.isCorrection) || correctionRound.value > 1);
const needsCorrection = computed(() => recordNeedsCorrection(submission.value));
const attachmentCount = computed(() => {
  if (!submission.value || needsCorrection.value) return 0;
  const explicit = submission.value.attachment_count
    ?? submission.value.current_round_attachment_count
    ?? submission.value.new_attachment_count;
  if (explicit !== undefined && explicit !== null) return Math.max(0, Number(explicit) || 0);
  return submission.value.attachments?.length || 0;
});
const uploadLocked = computed(() => submission.value?.status === 'reviewed' && !needsCorrection.value);
const minuteText = computed(() => `${Math.max(1, Math.round(Number(assignment.value?.estimated_seconds || 1200) / 60))} 分钟`);
const statusText = computed(() => {
  const status = submission.value?.status;
  if (needsCorrection.value) return '待订正';
  if (status === 'reviewed') return isCorrection.value ? '订正完成' : '已复核';
  if (status === 'submitted') return isCorrection.value ? '订正已提交' : '已提交';
  return status ? '已提交' : '待完成';
});
const statusClass = computed(() => needsCorrection.value ? 'correction-required' : (submission.value?.status || 'ready'));
const uploadButtonText = computed(() => {
  if (uploading.value) return `正在上传 ${uploadProgress.value}`;
  if (uploadLocked.value) return '本轮练习已完成';
  if (needsCorrection.value) return '上传订正照片';
  if (isCorrection.value) return attachmentCount.value ? '继续补充订正照片' : '上传订正照片';
  return attachmentCount.value ? '继续补充照片' : '拍照或选择图片';
});
const submissionNote = computed(() => {
  if (needsCorrection.value) return '老师已打回，等待上传新的订正照片';
  if (submission.value?.status === 'reviewed') return isCorrection.value ? '本轮订正已通过复核' : '老师已对照答案复核';
  return isCorrection.value ? '订正提交成功，等待老师复核上一轮错题' : '提交成功，等待老师对照答案复核';
});

onLoad((options) => { studentId.value = String(options?.student_id || ''); });
onShow(() => loadData());
onShareAppMessage(() => ({
  title: '今日练习已打卡，一起坚持每天多练一点！',
  path: '/pages/index/index?from=practice-share',
}));

async function resolveStudent() {
  if (studentId.value) return studentId.value;
  const kids = await api.get('/bind/students');
  const list = kids.students || [];
  const activeId = String(uni.getStorageSync('activeChildId') || '');
  const child = list.find((item) => String(item.id) === activeId) || list[0];
  studentId.value = child ? String(child.id) : '';
  return studentId.value;
}

async function loadData() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const id = await resolveStudent();
    if (!id) throw { error: '请先绑定孩子' };
    const [today, recent] = await Promise.all([
      api.get(`/practice/today?student_id=${id}`),
      api.get(`/practice/history?student_id=${id}`),
    ]);
    practiceDate.value = today.practice_date;
    plan.value = today.plan || {};
    assignment.value = today.assignment || null;
    history.value = recent.assignments || [];
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('practiceParent.loadData', err);
  } finally {
    loading.value = false;
  }
}

function chooseImages() {
  const count = Math.max(1, 6 - attachmentCount.value);
  return new Promise((resolve, reject) => {
    if (uni.chooseMedia) {
      uni.chooseMedia({ count, mediaType: ['image'], sourceType: ['camera', 'album'],
        success: (res) => resolve((res.tempFiles || []).map((file) => file.tempFilePath)), fail: reject });
    } else {
      uni.chooseImage({ count, sourceType: ['camera', 'album'], success: (res) => resolve(res.tempFilePaths || []), fail: reject });
    }
  });
}

async function chooseAndUpload() {
  if (uploading.value || uploadLocked.value || !assignment.value) return;
  try {
    const files = await chooseImages();
    if (!files.length) return;
    uploading.value = true;
    for (let index = 0; index < files.length; index++) {
      uploadProgress.value = `${index + 1}/${files.length}`;
      const uploadComplete = index === files.length - 1 ? 1 : 0;
      await api.upload(
        `/practice/assignments/${assignment.value.id}/upload?upload_complete=${uploadComplete}`,
        files[index],
        'image',
      );
    }
    uni.showToast({ title: '打卡照片已提交', icon: 'success' });
    await loadData();
  } catch (err) {
    if (!/cancel/i.test(err?.errMsg || '')) uni.showToast({ title: err?.error || '上传失败，请重试', icon: 'none' });
  } finally {
    uploading.value = false;
    uploadProgress.value = '';
  }
}

function historyStatusText(item) {
  if (recordNeedsCorrection(item)) return '待订正';
  if (item.submission_status === 'reviewed') {
    return booleanField(item.is_correction) || Number(item.correction_round || 1) > 1 ? '订正完成' : '已复核';
  }
  if (item.submission_id) {
    return booleanField(item.is_correction) || Number(item.correction_round || 1) > 1 ? '订正已提交' : '已提交';
  }
  return '待完成';
}

function historyStatusClass(item) {
  if (recordNeedsCorrection(item)) return 'correction-required';
  return item.submission_status === 'reviewed' ? 'reviewed' : '';
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(48rpx + env(safe-area-inset-bottom));background:var(--page-bg)}
.practice-hero{margin:0 -24rpx 24rpx;padding:52rpx 36rpx 46rpx;background:linear-gradient(145deg,#FFFFFF,#EDF5FF);color:var(--ink);border-radius:0 0 34rpx 34rpx}
.eyebrow{display:block;font-size:20rpx;letter-spacing:4rpx;color:#BEE2D8;font-weight:700}
.hero-title{display:block;margin-top:12rpx;font-size:42rpx;line-height:1.3;font-weight:760}
.hero-sub{display:block;margin-top:10rpx;font-size:25rpx;color:#D9EFE9}
.card,.state-card{margin:0 0 20rpx;padding:28rpx;background:#fff;border:1rpx solid var(--border);border-radius:22rpx;box-shadow:var(--shadow-sm)}
.plan-card{display:flex;align-items:center;justify-content:space-between;gap:20rpx}
.plan-title,.section-title{display:block;color:var(--ink);font-size:30rpx;font-weight:720}
.plan-meta,.upload-help{display:block;margin-top:7rpx;color:var(--text-muted);font-size:23rpx;line-height:1.5}
.status-pill{flex:none;padding:10rpx 18rpx;border-radius:999rpx;background:var(--warning-soft);color:var(--warning);font-size:22rpx;font-weight:700}
.status-pill.submitted{background:var(--accent-soft);color:var(--accent-strong)}.status-pill.reviewed{background:#E8F4F0;color:#236856}.status-pill.correction-required{background:#FFF0CF;color:#805A12}
.correction-card{margin:0 0 20rpx;padding:24rpx 26rpx;border:1rpx solid #E7C46F;border-radius:20rpx;background:#FFF8E7}.correction-kicker,.correction-title,.correction-copy{display:block}.correction-kicker{color:#9A6F18;font-size:20rpx;font-weight:760;letter-spacing:2rpx}.correction-title{margin-top:5rpx;color:#583E0C;font-size:31rpx;font-weight:780}.correction-copy{margin-top:8rpx;color:#765E2B;font-size:23rpx;line-height:1.55}
.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx;margin-bottom:18rpx}
.section-note,.photo-count{color:var(--accent-strong);font-size:22rpx}
.question-row{display:flex;gap:18rpx;padding:22rpx 0;border-bottom:1rpx solid var(--hairline)}.question-row:last-child{border-bottom:0}
.question-no{display:flex;align-items:center;justify-content:center;flex:none;width:48rpx;height:48rpx;border-radius:14rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:24rpx;font-weight:750}
.question-copy{flex:1;min-width:0}.question-text{display:block;color:var(--ink);font-size:29rpx;line-height:1.65}.question-type{display:block;margin-top:6rpx;color:var(--text-muted);font-size:21rpx}
.primary-btn{min-height:92rpx;display:flex;align-items:center;justify-content:center;margin:0;background:var(--primary);color:#fff;border-radius:16rpx;font-size:28rpx;font-weight:700}.primary-btn::after{border:0}.primary-btn[disabled]{opacity:.45}
.submit-note{margin-top:18rpx;padding:18rpx 20rpx;border-radius:14rpx;background:var(--surface-muted);color:var(--accent-strong);font-size:24rpx}.round-note{display:block;margin-top:6rpx;color:var(--text-muted);font-size:21rpx}.teacher-note{display:block;margin-top:8rpx;color:var(--ink);line-height:1.55}
.history-row{min-height:76rpx;display:flex;align-items:center;justify-content:space-between;border-bottom:1rpx solid var(--hairline);color:var(--ink);font-size:25rpx}.history-row:last-child{border-bottom:0}
.history-status{color:var(--warning)}.history-status.reviewed{color:var(--success)}.history-status.correction-required{color:#95680C;font-weight:700}
.share-card{display:flex;align-items:center;gap:18rpx;border-color:#E8C879;background:linear-gradient(135deg,#FFFBED,#FFFFFF)}.share-mark{width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:20rpx;background:#F5B83D;color:#493000;font-size:35rpx;font-weight:900}.share-copy{flex:1;min-width:0}.share-title{display:block;color:var(--ink);font-size:28rpx;font-weight:760}.share-desc{display:block;margin-top:4rpx;color:#6C572F;font-size:22rpx;line-height:1.45}.share-privacy{display:block;margin-top:5rpx;color:var(--text-muted);font-size:20rpx}.share-btn{flex:none;min-height:84rpx;display:flex;align-items:center;justify-content:center;margin:0;padding:0 18rpx;border-radius:14rpx;background:var(--primary-strong);color:#fff;font-size:23rpx;font-weight:750}.share-btn::after{border:0}
@media (max-width:380px){.share-card{align-items:flex-start;flex-wrap:wrap}.share-copy{min-width:calc(100% - 90rpx)}.share-btn{width:100%}}
.question-text{display:flex}
</style>

<style scoped>
.page {
  background:
    radial-gradient(circle at 0 12%, rgba(101, 191, 168, .12), transparent 23%),
    linear-gradient(180deg, #F7FBFF, var(--page-bg, #F6FAFF));
}

.practice-hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid #CADBF1;
  border-radius: 0 0 24rpx 24rpx;
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 50rpx,
      rgba(82, 124, 201, .07) 51rpx,
      rgba(82, 124, 201, .07) 52rpx
    ),
    linear-gradient(145deg, #FFFFFF, #EDF5FF);
  color: var(--ink);
  animation: parent-practice-enter var(--motion-slow) var(--ease-out) both;
}

.practice-hero::after {
  content: '';
  position: absolute;
  right: 34rpx;
  top: 34rpx;
  width: 116rpx;
  height: 22rpx;
  border-radius: 5rpx;
  background: rgba(244, 199, 91, .7);
  transform: rotate(3deg);
}

.eyebrow { color: var(--accent-strong); }
.hero-title { color: var(--ink); }
.hero-sub { color: var(--text-secondary); }

.card,
.state-card,
.correction-card {
  border-radius: 18rpx;
  animation: parent-practice-enter var(--motion-slow) var(--ease-out) both;
}

.plan-card { border-left: 7rpx solid var(--primary); }
.question-card { border-top: 5rpx solid var(--accent); }
.upload-card { border-top: 5rpx solid var(--gold); }
.history-card { border-top: 5rpx solid var(--primary); }
.share-card { border-radius: 16rpx 26rpx 16rpx 26rpx; }
.share-btn { background: var(--primary-strong); }

.primary-btn,
.share-btn {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.primary-btn:active,
.share-btn:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

@keyframes parent-practice-enter {
  from { opacity: 0; transform: translateY(10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .practice-hero,
  .card,
  .state-card,
  .correction-card,
  .primary-btn,
  .share-btn {
    animation: none !important;
    transition: none !important;
  }

  .primary-btn:active,
  .share-btn:active {
    transform: none;
  }
}
</style>
