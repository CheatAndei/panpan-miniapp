<template>
  <view class="page">
    <view class="practice-hero">
      <text class="eyebrow">DAILY PRACTICE</text>
      <view class="hero-title-row">
        <view class="title-icon tone-green"><pp-icon name="calculator" :size="34" motion="pop" /></view>
        <text class="hero-title">每日初中计算打卡</text>
      </view>
      <view class="hero-sub"><pp-icon name="calendar" :size="24" /><text>{{ practiceDate || '今日' }} · 约 20 分钟</text></view>
    </view>

    <view v-if="loading && !assignment" class="state-card"><pp-state type="loading" title="正在准备今日练习" /></view>
    <view v-else-if="error && !assignment" class="state-card"><pp-state type="error" title="暂时无法加载" :description="error" action-text="重试" @action="loadData" /></view>
    <view v-else-if="!assignment" class="state-card"><pp-state title="今天没有打卡计划" description="老师发布假期计划后会显示在这里。" /></view>

    <template v-else>
      <view class="card plan-card">
        <view>
          <view class="plan-title"><pp-icon name="target" :size="28" /><text>{{ plan.title }}</text></view>
          <text class="plan-meta">{{ plan.module }} · {{ assignment.items.length }} 题 · {{ minuteText }}</text>
        </view>
        <view :class="['status-pill', statusClass]"><pp-icon :name="needsCorrection?'pencil':'check'" :size="22" /><text>{{ statusText }}</text></view>
      </view>

      <view v-if="needsCorrection" class="correction-card">
        <view class="correction-kicker"><pp-icon name="pencil" :size="24" /><text>老师已打回</text></view>
        <text class="correction-title">待上传订正照片</text>
        <text class="correction-copy">请订正老师标记的错题，只上传本轮新照片；提交后老师只复核上一轮错题。</text>
      </view>

      <view class="card question-card">
        <view class="section-head">
          <view class="section-title"><pp-icon name="book" :size="28" /><text>今日题目</text></view>
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
            <view class="section-title"><pp-icon name="pencil" :size="28" /><text>{{ needsCorrection || isCorrection ? '上传订正' : '拍照提交' }}</text></view>
            <text class="upload-help">
              {{ needsCorrection || isCorrection
                ? '只上传订正后的新照片；老师会仅复核上一轮错题，本轮最多 6 张'
                : '拍清题号和解题过程；照片会对应今天题单和标准答案供老师核对，最多 6 张' }}
            </text>
          </view>
          <text v-if="assignment.submission" class="photo-count">本轮新增 {{ attachmentCount }} 张</text>
        </view>
        <view v-if="localPhotos.length" class="photo-preview">
          <view class="photo-preview-head">
            <text class="photo-preview-title">已添加照片</text>
            <text class="photo-preview-tip">点击可放大预览</text>
          </view>
          <view class="photo-grid">
            <button
              v-for="(src, index) in localPhotos"
              :key="photoItems[index]?.id || src"
              class="photo-thumb"
              :aria-label="`预览第 ${index + 1} 张作业照片`"
              @tap="previewPhotos(index)"
            >
              <image :src="src" mode="aspectFill" />
              <text class="photo-index">{{ index + 1 }}</text>
            </button>
          </view>
        </view>
        <button class="primary-btn" :disabled="uploading || attachmentCount >= 6 || uploadLocked" aria-label="拍照上传打卡作业" @tap="chooseAndUpload">
          <pp-icon name="plus" :size="28" /><text>{{ uploadButtonText }}</text>
        </button>
        <button
          v-if="submission && canConfirmUpload && attachmentCount"
          class="confirm-btn"
          :disabled="uploading"
          aria-label="确认将已上传照片送达老师"
          @tap="confirmSavedUpload"
        >
          <pp-icon name="check" :size="28" /><text>已传好，确认送达老师</text>
        </button>
        <view v-if="assignment.submission" class="submit-note">
          <text>{{ submissionNote }}</text>
          <text v-if="isCorrection" class="round-note">当前为第 {{ correctionRound }} 轮订正</text>
          <text v-if="assignment.submission.teacher_note" class="teacher-note">{{ assignment.submission.teacher_note }}</text>
        </view>
      </view>

      <view v-if="deliveredToTeacher && attachmentCount" class="card share-card">
        <view class="share-mark"><pp-icon name="trophy" :size="34" motion="shine" /></view>
        <view class="share-copy">
          <text class="share-title">今日练习已完成</text>
          <text class="share-desc">分享到群里，邀请大家一起坚持每天多练一点</text>
          <text class="share-note">每天认真一点，进步就会看得见</text>
        </view>
        <button class="share-btn" open-type="share"><pp-icon name="message" :size="26" /><text>分享至群聊</text></button>
      </view>

      <view v-if="history.length" class="card history-card">
        <view class="section-title"><pp-icon name="history" :size="28" /><text>最近记录</text></view>
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
import { buildShareEntryPath } from '@/utils/welcome-entry';

const studentId = ref('');
const loading = ref(false);
const uploading = ref(false);
const uploadProgress = ref('');
const error = ref('');
const practiceDate = ref('');
const plan = ref({});
const assignment = ref(null);
const history = ref([]);
const photoItems = ref([]);
let selectingImages = false;

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
const localPhotos = computed(() => photoItems.value.map((item) => item.path).filter(Boolean));
const correctionRound = computed(() => Math.max(1, Number(
  submission.value?.upload_round
    ?? submission.value?.correction_round
    ?? submission.value?.correctionRound
    ?? 1,
) || 1));
const isCorrection = computed(() => (
  booleanField(submission.value?.is_correction ?? submission.value?.isCorrection)
  || submission.value?.status === 'correction_required'
  || correctionRound.value > 1
));
const needsCorrection = computed(() => recordNeedsCorrection(submission.value));
const deliveredToTeacher = computed(() => (
  ['submitted', 'reviewed'].includes(submission.value?.status)
));
const canConfirmUpload = computed(() => (
  ['uploading', 'correction_required'].includes(submission.value?.status)
));
const attachmentCount = computed(() => {
  if (!submission.value) return 0;
  const explicit = submission.value.attachment_count
    ?? submission.value.current_round_attachment_count
    ?? submission.value.new_attachment_count;
  if (explicit !== undefined && explicit !== null) return Math.max(0, Number(explicit) || 0);
  return submission.value.attachments?.length || 0;
});
const uploadLocked = computed(() => (
  ['submitted', 'reviewed'].includes(submission.value?.status) && !needsCorrection.value
));
const minuteText = computed(() => `${Math.max(1, Math.round(Number(assignment.value?.estimated_seconds || 1200) / 60))} 分钟`);
const statusText = computed(() => {
  const status = submission.value?.status;
  if (needsCorrection.value) return '待订正';
  if (status === 'reviewed') return isCorrection.value ? '订正完成' : '已复核';
  if (status === 'submitted') return isCorrection.value ? '订正已提交' : '已提交';
  if (status === 'uploading') return '上传未完成';
  return '待完成';
});
const statusClass = computed(() => needsCorrection.value ? 'correction-required' : (submission.value?.status || 'ready'));
const uploadButtonText = computed(() => {
  if (uploading.value) return `正在上传 ${uploadProgress.value}`;
  if (submission.value?.status === 'reviewed') return '本轮练习已完成';
  if (submission.value?.status === 'submitted') return '已送达老师，等待批改';
  if (needsCorrection.value) return attachmentCount.value ? '继续补充订正照片' : '上传订正照片';
  if (isCorrection.value) return attachmentCount.value ? '继续补充订正照片' : '上传订正照片';
  if (submission.value?.status === 'uploading') return '继续补充照片';
  return attachmentCount.value ? '继续补充照片' : '拍照或选择图片';
});
const submissionNote = computed(() => {
  if (canConfirmUpload.value && attachmentCount.value) {
    return `已暂存 ${attachmentCount.value} 张，尚未送达老师；可继续添加，确认无误后点击下方按钮提交`;
  }
  if (needsCorrection.value) return '老师已打回，等待上传新的订正照片';
  if (submission.value?.status === 'reviewed') return isCorrection.value ? '本轮订正已通过复核' : '老师已对照答案复核';
  if (submission.value?.status === 'uploading') {
    return `已暂存 ${attachmentCount.value} 张，尚未送达老师；可继续添加，确认无误后点击下方按钮提交`;
  }
  return isCorrection.value ? '订正提交成功，等待老师复核上一轮错题' : '提交成功，等待老师对照答案复核';
});

onLoad((options) => { studentId.value = String(options?.student_id || ''); });
onShow(() => {
  if (!selectingImages) loadData();
});
// 分享入口只发送打卡鼓励卡，不包含学生作业照片。
onShareAppMessage(() => ({
  title: '今日练习已打卡，一起坚持每天多练一点！',
  path: buildShareEntryPath('home', { from: 'practice-share' }),
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

function attachmentKey(attachment, index = 0) {
  return String(attachment?.id ?? attachment?.url ?? `attachment-${index}`);
}

async function syncSubmissionPhotos(nextSubmission, localAttachment = null) {
  const existing = new Map(photoItems.value.map((item) => [String(item.id), item.path]));
  if (localAttachment?.attachment) {
    existing.set(attachmentKey(localAttachment.attachment), localAttachment.path);
  }
  const attachments = nextSubmission?.attachments || [];
  const resolved = await Promise.all(attachments.map(async (attachment, index) => {
    const id = attachmentKey(attachment, index);
    if (existing.has(id)) return { id, path: existing.get(id) };
    try {
      return { id, path: await api.downloadPrivate(attachment.url) };
    } catch (err) {
      logError('practiceParent.loadPhoto', err);
      return null;
    }
  }));
  photoItems.value = resolved.filter((item) => item?.path);
}

async function applySubmission(nextSubmission, localAttachment = null) {
  if (!nextSubmission || !assignment.value) return;
  assignment.value = { ...assignment.value, submission: nextSubmission };
  await syncSubmissionPhotos(nextSubmission, localAttachment);
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
    await syncSubmissionPhotos(assignment.value?.submission || null);
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('practiceParent.loadData', err);
  } finally {
    loading.value = false;
  }
}

function chooseImages() {
  const count = Math.max(1, 6 - attachmentCount.value);
  selectingImages = true;
  return new Promise((resolve, reject) => {
    if (uni.chooseMedia) {
      uni.chooseMedia({ count, mediaType: ['image'], sourceType: ['camera', 'album'],
        success: (res) => resolve((res.tempFiles || []).map((file) => file.tempFilePath)),
        fail: reject,
        complete: () => { selectingImages = false; } });
    } else {
      uni.chooseImage({
        count,
        sourceType: ['camera', 'album'],
        success: (res) => resolve(res.tempFilePaths || []),
        fail: reject,
        complete: () => { selectingImages = false; },
      });
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
      const result = await api.upload(
        `/practice/assignments/${assignment.value.id}/upload?upload_complete=0`,
        files[index],
        'image',
      );
      await applySubmission(result.submission, {
        attachment: result.attachment,
        path: files[index],
      });
    }
    uni.showToast({ title: '图片已暂存，可继续添加', icon: 'success' });
  } catch (err) {
    await loadData();
    if (!/cancel/i.test(err?.errMsg || '')) {
      uni.showToast({ title: err?.error || '上传未完成，已成功的图片会保留', icon: 'none' });
    }
  } finally {
    uploading.value = false;
    uploadProgress.value = '';
  }
}

async function completePracticeUpload() {
  const result = await api.post(
    `/practice/assignments/${assignment.value.id}/upload/complete`,
    {},
    { timeout: 60000 },
  );
  if (result.submission?.status !== 'submitted') {
    throw { error: '照片已暂存，但尚未送达老师，请重试确认' };
  }
  return result.submission;
}

async function confirmSavedUpload() {
  if (uploading.value || !assignment.value || !attachmentCount.value) return;
  uploading.value = true;
  uploadProgress.value = '确认中';
  try {
    const nextSubmission = await completePracticeUpload();
    await applySubmission(nextSubmission);
    uni.showToast({ title: '已送达老师批改台', icon: 'success' });
  } catch (err) {
    await loadData();
    if (deliveredToTeacher.value) {
      uni.showToast({ title: '已送达老师批改台', icon: 'success' });
    } else {
      uni.showToast({ title: err?.error || '确认失败，请重试', icon: 'none' });
    }
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
  if (item.submission_status === 'uploading') return '上传未完成';
  if (item.submission_id) {
    return booleanField(item.is_correction) || Number(item.correction_round || 1) > 1 ? '订正已提交' : '已提交';
  }
  return '待完成';
}

function historyStatusClass(item) {
  if (recordNeedsCorrection(item)) return 'correction-required';
  return item.submission_status === 'reviewed' ? 'reviewed' : '';
}

function previewPhotos(index) {
  uni.previewImage({
    urls: localPhotos.value,
    current: localPhotos.value[index],
  });
}
</script>

<style scoped>
.page {
  --panpan-green: #0B789A;
  --panpan-green-strong: #050505;
  --panpan-sprout: #0B789A;
  --panpan-coral: #F79BC0;
  --panpan-leaf: #050505;
  --panpan-paper: #F7FCFE;
  --panpan-ink: #050505;
  --panpan-muted: #50545B;
  min-height: 100vh;
  padding: 0 24rpx calc(48rpx + env(safe-area-inset-bottom));
  background-color: var(--panpan-paper);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(153, 222, 244, .045) 64rpx 65rpx
  );
}

.practice-hero {
  margin: 0 -24rpx 17rpx;
  padding: 40rpx 32rpx 32rpx;
  border-bottom: 1rpx solid #DCE9ED;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(153, 222, 244, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E5F8FE 100%);
  color: var(--panpan-ink);
  animation: parent-practice-enter var(--motion-slow) var(--ease-out) both;
}

.eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #E5F8FE; color: var(--panpan-green-strong); font-size: 19rpx; font-weight: 760; letter-spacing: 0; }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #E5F8FE; }
.hero-title { color: var(--panpan-ink); font-size: 40rpx; font-weight: 790; line-height: 1.3; }
.hero-title-row::after { content: ''; width: 54rpx; height: 7rpx; flex: none; border-radius: 4rpx; background: var(--panpan-coral); }
.hero-sub { display: flex; align-items: center; gap: 7rpx; margin-top: 10rpx; color: var(--panpan-muted); font-size: 23rpx; }

.card,
.state-card,
.correction-card {
  margin: 0 0 15rpx;
  padding: 23rpx 24rpx;
  border: 1rpx solid #D9E5F3;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(5, 5, 5, .06);
  animation: parent-practice-enter var(--motion-slow) var(--ease-out) both;
}

.plan-card { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; border-left: 7rpx solid var(--panpan-green); }
.plan-title,
.section-title { display: flex; align-items: center; gap: 8rpx; color: var(--panpan-ink); font-size: 29rpx; font-weight: 730; }
.plan-meta,
.upload-help { display: block; margin-top: 6rpx; color: var(--panpan-muted); font-size: 22rpx; line-height: 1.48; }
.status-pill { display: flex; align-items: center; gap: 5rpx; flex: none; padding: 6rpx 12rpx; border-radius: 8rpx; background: #E5F8FE; color: #050505; font-size: 21rpx; font-weight: 700; }
.status-pill.submitted { background: #E5F8FE; color: #050505; }
.status-pill.reviewed { background: #E5F8FE; color: var(--panpan-green-strong); }
.status-pill.correction-required { background: #FFF0F6; color: #B53A52; }

.correction-card { border-color: rgba(247, 155, 192, .3); border-left: 6rpx solid var(--panpan-coral); background: #FFF0F6; }
.correction-kicker,
.correction-title,
.correction-copy { display: block; }
.correction-kicker { display: flex; align-items: center; gap: 6rpx; color: #B53A52; font-size: 19rpx; font-weight: 760; letter-spacing: 0; }
.correction-title { margin-top: 5rpx; color: var(--panpan-ink); font-size: 29rpx; font-weight: 780; }
.correction-copy { margin-top: 7rpx; color: #50545B; font-size: 22rpx; line-height: 1.52; }

.question-card { border-top: 6rpx solid var(--panpan-leaf); }
.upload-card { border-top: 6rpx solid var(--panpan-sprout); }
.history-card { border-top: 6rpx solid var(--panpan-green); }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14rpx; margin-bottom: 15rpx; }
.section-note,
.photo-count { color: #050505; font-size: 21rpx; }
.photo-preview { margin-bottom: 15rpx; padding: 15rpx; border: 1rpx solid #DCE9ED; border-radius: 12rpx; background: #F8FCFD; }
.photo-preview-head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; margin-bottom: 11rpx; }
.photo-preview-title { color: var(--panpan-ink); font-size: 23rpx; font-weight: 720; }
.photo-preview-tip { color: var(--panpan-muted); font-size: 19rpx; }
.photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10rpx; }
.photo-thumb { position: relative; width: 100%; height: 170rpx; margin: 0; padding: 0; overflow: hidden; border-radius: 10rpx; background: #E5F8FE; line-height: 1; }
.photo-thumb::after { border: 0; }
.photo-thumb image { width: 100%; height: 100%; }
.photo-index { position: absolute; right: 7rpx; bottom: 7rpx; min-width: 30rpx; height: 30rpx; display: flex; align-items: center; justify-content: center; border-radius: 15rpx; background: rgba(5, 5, 5, .78); color: #FFFFFF; font-size: 17rpx; }
.question-row { display: flex; gap: 15rpx; padding: 18rpx 0; border-bottom: 1rpx solid #EDF3F5; }
.question-row:last-child { border-bottom: 0; }
.question-no { width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; background: #E5F8FE; color: #050505; font-size: 22rpx; font-weight: 760; }
.question-copy { flex: 1; min-width: 0; }
.question-text { display: flex; color: var(--panpan-ink); font-size: 28rpx; line-height: 1.62; }
.question-type { display: block; margin-top: 5rpx; color: var(--panpan-muted); font-size: 20rpx; }

.primary-btn,
.confirm-btn,
.share-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-left: 0;
  margin-right: 0;
  border-radius: 11rpx;
  font-weight: 720;
}
.primary-btn { min-height: 86rpx; margin-top: 0; background: var(--panpan-green-strong); color: #FFFFFF; font-size: 27rpx; box-shadow: 0 8rpx 18rpx rgba(5, 5, 5, .18); }
.confirm-btn { min-height: 78rpx; margin-top: 12rpx; border: 2rpx solid var(--panpan-green); background: #FFFFFF; color: var(--panpan-green-strong); font-size: 24rpx; }
.primary-btn::after,
.confirm-btn::after,
.share-btn::after { border: 0; }
.primary-btn[disabled],
.confirm-btn[disabled] { background: #CDE8F0; border-color: #CDE8F0; color: #FFFFFF; opacity: .72; box-shadow: none; }

.submit-note { margin-top: 15rpx; padding: 14rpx 16rpx; border-left: 5rpx solid var(--panpan-leaf); border-radius: 8rpx; background: #E5F8FE; color: #050505; font-size: 23rpx; }
.round-note { display: block; margin-top: 5rpx; color: var(--panpan-muted); font-size: 20rpx; }
.teacher-note { display: block; margin-top: 7rpx; color: var(--panpan-ink); line-height: 1.52; }
.history-row { min-height: 70rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1rpx solid #EDF3F5; color: var(--panpan-ink); font-size: 24rpx; }
.history-row:last-child { border-bottom: 0; }
.history-status { color: #050505; }
.history-status.reviewed { color: var(--panpan-green-strong); }
.history-status.correction-required { color: #B53A52; font-weight: 700; }

.share-card { display: flex; align-items: center; gap: 15rpx; border-color: rgba(153, 222, 244, .5); border-top: 6rpx solid var(--panpan-sprout); background: #F7FCFE; }
.share-mark { width: 58rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 12rpx; background: var(--panpan-sprout); }
.share-copy { flex: 1; min-width: 0; }
.share-title { display: block; color: var(--panpan-ink); font-size: 27rpx; font-weight: 760; }
.share-desc { display: block; margin-top: 4rpx; color: #50545B; font-size: 21rpx; line-height: 1.42; }
.share-note { display: block; margin-top: 4rpx; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 650; }
.share-btn { min-height: 78rpx; flex: none; margin: 0; padding: 0 16rpx; background: var(--panpan-green-strong); color: #FFFFFF; font-size: 22rpx; }

.primary-btn,
.share-btn {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.primary-btn:active,
.share-btn:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

@media (max-width: 380px) {
  .share-card { align-items: flex-start; flex-wrap: wrap; }
  .share-copy { min-width: calc(100% - 82rpx); }
  .share-btn { width: 100%; }
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
