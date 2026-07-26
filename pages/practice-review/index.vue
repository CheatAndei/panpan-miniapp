<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="eyebrow">REVIEW DESK</text>
        <text class="hero-title">批改台</text>
        <text class="hero-sub">只显示未批改打卡 · 点选错题即可</text>
      </view>
      <view class="pending-badge"><text class="pending-number">{{ todoCount }}</text><text>待批</text></view>
    </view>

    <view v-if="loading && !activeSubmission" class="state-card"><pp-state type="loading" title="正在读取待批作业" /></view>
    <view v-else-if="!activeSubmission" class="state-card">
      <pp-state title="批改已清空" description="新的学生打卡提交后，会自动出现在这里。" />
    </view>

    <template v-else>
      <view class="queue-card">
        <view>
          <view class="queue-name-line">
            <text class="queue-name">{{ activeSubmission.student_name }}</text>
            <text v-if="activeSubmission._isCorrection" class="correction-badge">订正第 {{ activeSubmission._correctionRound }} 轮</text>
          </view>
          <text class="queue-meta">{{ activeSubmission.practice_date }} · 第 {{ activeSubmissionIndex + 1 }} / {{ submissions.length }} 份</text>
        </view>
        <view class="queue-controls">
          <button :disabled="activeSubmissionIndex<=0 || activeSubmission._saved" @tap="goSubmission(-1)">上一位</button>
          <button :disabled="activeSubmissionIndex>=submissions.length-1 || activeSubmission._saved" @tap="goSubmission(1)">下一位</button>
        </view>
      </view>

      <view class="review-card">
        <view :class="['review-tip',{correction:activeSubmission._isCorrection}]">
          <text class="tip-title">{{ activeSubmission._isCorrection ? '订正复核' : '只点错题' }}</text>
          <text class="tip-copy">
            {{ activeSubmission._isCorrection
              ? '只看新照片 / 上一轮错题；仍有错误的题再点为错题。'
              : '未点选的题默认正确；保存后再进入预览或保存相册。' }}
          </text>
        </view>

        <view class="workbench">
          <view class="photo-pane">
            <view class="pane-head">
              <view>
                <text class="pane-title">{{ activeSubmission._isCorrection ? '本轮新照片' : '学生照片' }}</text>
                <text class="pane-sub">双指缩放 1×–4×，放大后可拖动</text>
              </view>
              <text class="pane-count">
                {{ activeSubmission._photoPaths.length ? activeSubmission._activePhoto + 1 : 0 }} / {{ activeSubmission.attachments.length }}
              </text>
            </view>
            <view class="photo-stage">
              <view v-if="activeSubmission._photosLoading" class="pane-state">正在读取私有照片…</view>
              <swiper
                v-else-if="activeSubmission._photoPaths.length"
                class="photo-swiper"
                :current="activeSubmission._activePhoto"
                :indicator-dots="activeSubmission._photoPaths.length>1"
                indicator-color="#B7C8C3"
                indicator-active-color="#2F7D6B"
                @change="changePhoto"
              >
                <swiper-item v-for="(photo,index) in activeSubmission._photoPaths" :key="photo">
                  <view class="photo-frame">
                    <movable-area class="zoom-area" :scale-area="true">
                      <movable-view
                        class="zoom-view"
                        :direction="(activeSubmission._photoScales[index] || 1) > 1 ? 'all' : 'none'"
                        :inertia="true"
                        :out-of-bounds="false"
                        :scale="true"
                        :scale-min="1"
                        :scale-max="4"
                        :scale-value="activeSubmission._photoScales[index] || 1"
                        :x="activeSubmission._photoOffsets[index]?.x || 0"
                        :y="activeSubmission._photoOffsets[index]?.y || 0"
                        @change="changePhotoPosition(index,$event)"
                        @scale="changePhotoScale(index,$event)"
                      >
                        <image
                          :src="photo"
                          mode="aspectFit"
                          class="submission-photo"
                          :style="{transform:`rotate(${activeSubmission._rotations[index]||0}deg)`}"
                        />
                      </movable-view>
                    </movable-area>
                  </view>
                </swiper-item>
              </swiper>
              <view v-else class="pane-state error">照片暂未读到，请重新读取</view>
            </view>
            <view v-if="activeSubmission._photoPaths.length > 1" class="photo-nav">
              <button :disabled="activeSubmission._activePhoto <= 0" @tap="changePhotoBy(-1)">上一张</button>
              <text>左右滑动切换 · {{ activeSubmission._activePhoto + 1 }} / {{ activeSubmission._photoPaths.length }}</text>
              <button :disabled="activeSubmission._activePhoto >= activeSubmission._photoPaths.length - 1" @tap="changePhotoBy(1)">下一张</button>
            </view>
            <view class="photo-actions">
              <button :disabled="!activeSubmission._photoPaths.length" @tap="resetCurrentPhoto">还原缩放</button>
              <button :disabled="!activeSubmission._photoPaths.length || activeSubmission._saved" @tap="rotateCurrentPhoto">旋转 90°</button>
              <button v-if="activeSubmission._photoFailures" :disabled="activeSubmission._photosLoading" @tap="retryPhotos">重读</button>
            </view>
            <text class="orientation-note">图片在当前页原地缩放，不会打开原图或刷新批改记录。</text>
          </view>

          <view class="answer-pane">
            <view class="pane-head answer-head">
              <view>
                <text class="pane-title">{{ activeSubmission._isCorrection ? '上一轮错题' : '标准答案' }}</text>
                <text v-if="activeSubmission._isCorrection" class="pane-sub">默认已订正，只点仍然错误的题</text>
              </view>
              <text class="wrong-count">错 {{ wrongCount }} 题</text>
            </view>
            <button
              v-for="item in activeSubmission.items"
              :key="item.id"
              :class="['answer-row',{wrong:item._correct===false}]"
              :disabled="activeSubmission._saved"
              @tap="toggleWrong(item)"
            >
              <view class="answer-top">
                <text class="answer-no">{{ item.position }}</text>
                <text class="answer-state">{{ item._correct===false?'错题':'默认正确' }}</text>
              </view>
              <pp-math-text class="answer-value" :value="item.answer" />
              <pp-math-text class="answer-stem" :value="item.stem" />
            </button>
          </view>
        </view>
      </view>

      <view class="footer-actions">
        <template v-if="!activeSubmission._saved">
          <button class="save-only" :disabled="activeSubmission._saving || activeSubmission._photosLoading || !photosReady" @tap="saveReview">
            {{ activeSubmission._saving ? '保存中…' : wrongCount ? `保存并打回（${wrongCount} 题）` : '保存通过' }}
          </button>
        </template>
        <template v-else>
          <button class="after-btn preview" :disabled="activeSubmission._posterBusy" @tap="previewPoster">{{ activeSubmission._posterBusy?'生成中…':'预览' }}</button>
          <button class="after-btn album" :disabled="activeSubmission._posterBusy" @tap="savePoster">保存相册</button>
          <button class="after-btn next" @tap="nextAfterSave">下一位</button>
        </template>
      </view>
    </template>

    <canvas
      canvas-id="practiceReviewPosterCanvas"
      id="practiceReviewPosterCanvas"
      class="poster-canvas"
      :style="{width:'750px',height:'1000px'}"
    />
  </view>
</template>

<script setup>
import { computed, getCurrentInstance, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import {
  inspectPracticePhoto,
  renderPracticeReviewPoster,
  savePracticeReviewPoster,
} from '@/utils/practice-review-poster';

const pageInstance = getCurrentInstance()?.proxy;
const todos = ref([]);
const todoCount = ref(0);
const submissions = ref([]);
const activeSubmissionIndex = ref(0);
const loading = ref(false);
const requestedPlanId = ref(0);
const requestedSubmissionId = ref(0);
const hasShown = ref(false);
const activeSubmission = computed(() => submissions.value[activeSubmissionIndex.value] || null);
const wrongCount = computed(() => activeSubmission.value?.items?.filter((item) => item._correct === false).length || 0);
const photosReady = computed(() => {
  const submission = activeSubmission.value;
  return Boolean(submission?.attachments?.length && submission._photoPaths.length === submission.attachments.length);
});

onLoad((options) => {
  requestedPlanId.value = Number(options?.plan_id || 0);
  requestedSubmissionId.value = Number(options?.submission_id || 0);
});
onShow(() => {
  if (hasShown.value) return;
  hasShown.value = true;
  loadQueue();
});
onPullDownRefresh(async () => { try { await loadQueue(); } finally { uni.stopPullDownRefresh(); } });

function booleanField(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeItemIds(value) {
  if (Array.isArray(value)) return value.map((item) => String(item?.id ?? item));
  if (typeof value === 'string') {
    try { return normalizeItemIds(JSON.parse(value)); }
    catch { return value.split(',').map((item) => item.trim()).filter(Boolean); }
  }
  return [];
}

function prepareSubmission(submission) {
  const correctionRound = Math.max(1, Number(submission.correction_round ?? submission.correctionRound ?? 1) || 1);
  const isCorrection = booleanField(submission.is_correction ?? submission.isCorrection) || correctionRound > 1;
  const focusIds = normalizeItemIds(submission.focus_item_ids ?? submission.focusItemIds);
  const focusSet = new Set(focusIds);
  const allItems = submission.items || [];
  const focusedItems = isCorrection && focusSet.size
    ? allItems.filter((item) => focusSet.has(String(item.id)) || focusSet.has(String(item.position)))
    : allItems;
  return {
    ...submission,
    _isCorrection: isCorrection,
    _correctionRound: correctionRound,
    _needsCorrection: booleanField(submission.needs_correction ?? submission.needsCorrection),
    _focusItemIds: focusIds,
    _saving: false,
    _saved: false,
    _posterBusy: false,
    _posterPath: '',
    _photosLoading: false,
    _photoFailures: 0,
    _activePhoto: 0,
    _photoPaths: [],
    _photoInfos: [],
    _rotations: [],
    _photoScales: [],
    _photoOffsets: [],
    items: focusedItems.map((item) => ({ ...item, _correct: true })),
  };
}

async function loadQueue() {
  if (loading.value) return;
  const current = activeSubmission.value;
  const currentSubmissionId = Number(current?.id || 0);
  const currentPlanId = Number(current?.plan_id || 0);
  loading.value = true;
  try {
    const result = await api.get('/practice/todos?limit=50');
    todos.value = result.todos || [];
    todoCount.value = Number(result.count || 0);
    if (current?._saved && !requestedSubmissionId.value && !requestedPlanId.value) return;
    const requested = todos.value.find((item) => Number(item.submission_id) === requestedSubmissionId.value)
      || todos.value.find((item) => Number(item.plan_id) === requestedPlanId.value)
      || todos.value.find((item) => Number(item.submission_id) === currentSubmissionId)
      || todos.value.find((item) => Number(item.plan_id) === currentPlanId)
      || todos.value[0];
    requestedPlanId.value = 0;
    requestedSubmissionId.value = 0;
    if (!requested) {
      submissions.value = [];
      return;
    }
    await loadPlanSubmissions(requested.plan_id, requested.submission_id);
  } catch (error) {
    uni.showToast({ title: error?.error || '批改台加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function loadPlanSubmissions(planId, preferredId = 0) {
  const result = await api.get(`/practice/submissions?plan_id=${planId}&status=submitted&limit=50&page=1&submission_id=${preferredId || ''}`);
  submissions.value = (result.submissions || []).map(prepareSubmission);
  const preferredIndex = submissions.value.findIndex((item) => Number(item.id) === Number(preferredId));
  activeSubmissionIndex.value = preferredIndex >= 0 ? preferredIndex : 0;
  await ensurePhotos(activeSubmission.value);
}

async function ensurePhotos(submission) {
  if (!submission || submission._photosLoading || submission._photoPaths.length) return;
  submission._photosLoading = true;
  try {
    const results = await Promise.allSettled((submission.attachments || []).map((file) => api.downloadPrivate(file.url)));
    submission._photoPaths = results.filter((item) => item.status === 'fulfilled').map((item) => item.value);
    submission._photoFailures = results.filter((item) => item.status === 'rejected').length;
    const infoResults = await Promise.allSettled(submission._photoPaths.map(inspectPracticePhoto));
    submission._photoInfos = infoResults.map((item, index) => item.status === 'fulfilled'
      ? item.value : { path: submission._photoPaths[index], width: 1, height: 1, exifRotation: 0 });
    submission._rotations = submission._photoPaths.map(() => 0);
    submission._photoScales = submission._photoPaths.map(() => 1);
    submission._photoOffsets = submission._photoPaths.map(() => ({ x: 0, y: 0 }));
    if (submission._photoFailures) uni.showToast({ title: '部分照片未读到，可点击重读', icon: 'none' });
  } finally {
    submission._photosLoading = false;
  }
}

async function retryPhotos() {
  const submission = activeSubmission.value;
  if (!submission) return;
  submission._photoPaths = [];
  submission._photoInfos = [];
  submission._photoFailures = 0;
  await ensurePhotos(submission);
}

async function goSubmission(delta) {
  const target = activeSubmissionIndex.value + delta;
  if (target < 0 || target >= submissions.value.length) return;
  activeSubmissionIndex.value = target;
  await ensurePhotos(activeSubmission.value);
}

function changePhoto(event) { if (activeSubmission.value) activeSubmission.value._activePhoto = Number(event.detail?.current || 0); }
function changePhotoBy(delta) {
  const submission = activeSubmission.value;
  if (!submission) return;
  const target = Math.max(0, Math.min(submission._photoPaths.length - 1, submission._activePhoto + delta));
  submission._activePhoto = target;
}
function changePhotoPosition(index, event) {
  const submission = activeSubmission.value;
  if (!submission) return;
  submission._photoOffsets[index] = {
    x: Number(event.detail?.x || 0),
    y: Number(event.detail?.y || 0),
  };
}
function changePhotoScale(index, event) {
  const submission = activeSubmission.value;
  if (!submission) return;
  submission._photoScales[index] = Math.max(1, Math.min(4, Number(event.detail?.scale || 1)));
  changePhotoPosition(index, event);
}
function resetCurrentPhoto() {
  const submission = activeSubmission.value;
  const index = submission?._activePhoto || 0;
  if (!submission) return;
  submission._photoScales[index] = 1;
  submission._photoOffsets[index] = { x: 0, y: 0 };
}
function rotateCurrentPhoto() {
  const submission = activeSubmission.value;
  const index = submission?._activePhoto || 0;
  if (!submission) return;
  submission._rotations[index] = (Number(submission._rotations[index] || 0) + 90) % 360;
  submission._posterPath = '';
}
function toggleWrong(item) { item._correct = item._correct === false; }

async function saveReview() {
  const submission = activeSubmission.value;
  if (!submission || !photosReady.value || submission._saving) return;
  submission._saving = true;
  try {
    const result = await api.put(`/practice/submissions/${submission.id}/review`, {
      teacher_note: '',
      results: submission.items.map((item) => ({ item_id: item.id, is_correct: item._correct })),
      round_no: submission._correctionRound,
      correction_round: submission._correctionRound,
    });
    submission.status = result.status || (wrongCount.value ? 'correction_required' : 'reviewed');
    submission._correctionRound = Math.max(1, Number(result.correction_round || submission._correctionRound) || 1);
    submission._isCorrection = booleanField(result.is_correction ?? submission._isCorrection);
    submission._needsCorrection = booleanField(result.needs_correction ?? (submission.status === 'correction_required'));
    submission.needs_correction = submission._needsCorrection;
    submission._saved = true;
    todoCount.value = Math.max(0, todoCount.value - 1);
    uni.showToast({
      title: wrongCount.value ? `已打回 ${wrongCount.value} 题` : '已保存通过',
      icon: 'success',
    });
  } catch (error) {
    uni.showToast({ title: error?.error || '保存失败', icon: 'none' });
  } finally {
    submission._saving = false;
  }
}

async function ensurePoster() {
  const submission = activeSubmission.value;
  if (!submission) throw new Error('当前没有批改记录');
  if (submission._posterPath) return submission._posterPath;
  submission._posterBusy = true;
  try {
    submission._posterPath = await renderPracticeReviewPoster({
      page: pageInstance,
      studentName: submission.student_name,
      practiceDate: submission.practice_date,
      wrongNumbers: submission.items.filter((item) => item._correct === false).map((item) => item.position),
      photoPaths: submission._photoPaths,
      rotations: submission._rotations,
      isCorrection: submission._isCorrection,
      correctionRound: submission._correctionRound,
    });
    return submission._posterPath;
  } finally {
    submission._posterBusy = false;
  }
}

async function previewPoster() {
  try {
    const poster = await ensurePoster();
    uni.previewImage({ current: poster, urls: [poster] });
  } catch (error) {
    uni.showToast({ title: error?.message || error?.errMsg || '海报生成失败', icon: 'none' });
  }
}

async function savePoster() {
  try {
    const poster = await ensurePoster();
    await savePracticeReviewPoster(poster);
    uni.showToast({ title: '已保存到相册', icon: 'success' });
  } catch (error) {
    uni.showToast({ title: error?.message || error?.errMsg || '保存相册失败', icon: 'none' });
  }
}

async function nextAfterSave() {
  const submission = activeSubmission.value;
  if (!submission?._saved) return;
  const currentIndex = activeSubmissionIndex.value;
  submissions.value.splice(currentIndex, 1);
  if (submissions.value.length) {
    activeSubmissionIndex.value = Math.min(currentIndex, submissions.value.length - 1);
    await ensurePhotos(activeSubmission.value);
    return;
  }
  await loadQueue();
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 22rpx calc(150rpx + env(safe-area-inset-bottom));background:var(--bg)}
.hero{display:flex;align-items:center;justify-content:space-between;gap:22rpx;margin:0 -22rpx 20rpx;padding:44rpx 34rpx 36rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff}
.eyebrow{display:block;color:#BBD9D1;font-size:18rpx;font-weight:750;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:42rpx;font-weight:780}.hero-sub{display:block;margin-top:5rpx;color:#D6E7E3;font-size:22rpx}
.pending-badge{width:96rpx;height:96rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none;border:1rpx solid rgba(255,255,255,.22);border-radius:28rpx;background:rgba(255,255,255,.1);font-size:18rpx}.pending-number{font-size:34rpx;font-weight:800;line-height:1.1}
.state-card{margin-top:40rpx;border:1rpx solid var(--border);border-radius:22rpx;background:#fff}
.queue-card{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-bottom:16rpx;padding:20rpx 22rpx;border:1rpx solid var(--border);border-radius:18rpx;background:#fff}.queue-name-line{display:flex;align-items:center;flex-wrap:wrap;gap:10rpx}.queue-name{display:block;color:var(--ink);font-size:31rpx;font-weight:760}.correction-badge{padding:6rpx 11rpx;border-radius:999rpx;background:#FFF0CF;color:#805A12;font-size:18rpx;font-weight:740}.queue-meta{display:block;margin-top:3rpx;color:var(--text-muted);font-size:21rpx}.queue-controls{display:flex;gap:8rpx}.queue-controls button{min-height:66rpx;margin:0;padding:0 15rpx;border-radius:11rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:21rpx}.queue-controls button::after{border:0}
.review-card{padding:20rpx;border:1rpx solid var(--border);border-radius:22rpx;background:#fff;box-shadow:var(--shadow-sm)}.review-tip{display:flex;align-items:center;gap:13rpx;padding:15rpx 17rpx;border-radius:14rpx;background:var(--accent-soft)}.review-tip.correction{background:#FFF6DF}.review-tip.correction .tip-title{color:#805A12}.tip-title{flex:none;color:var(--accent-strong);font-size:25rpx;font-weight:760}.tip-copy{color:var(--text-secondary);font-size:20rpx;line-height:1.45}
.workbench{display:flex;flex-direction:column;gap:16rpx;margin-top:16rpx}.photo-pane,.answer-pane{box-sizing:border-box;min-width:0;border:1rpx solid var(--border);border-radius:16rpx;background:var(--surface-muted)}.photo-pane,.answer-pane{padding:16rpx}.pane-head{display:flex;align-items:center;justify-content:space-between;gap:12rpx;min-height:54rpx}.pane-title{display:block;color:var(--ink);font-size:25rpx;font-weight:730}.pane-sub{display:block;margin-top:3rpx;color:var(--text-muted);font-size:18rpx;line-height:1.4}.pane-count{flex:none;color:var(--text-muted);font-size:21rpx;font-weight:680}
.photo-stage{height:720rpx;margin-top:12rpx;overflow:hidden;border-radius:14rpx;background:#E5ECE9}.photo-swiper,.photo-frame,.zoom-area,.zoom-view{width:100%;height:100%}.photo-frame{display:flex;align-items:center;justify-content:center;overflow:hidden}.zoom-area{overflow:hidden}.zoom-view{display:flex;align-items:center;justify-content:center}.submission-photo{width:100%;height:100%;transition:transform .2s ease}.pane-state{height:100%;display:flex;align-items:center;justify-content:center;padding:20rpx;box-sizing:border-box;color:var(--text-muted);font-size:21rpx;text-align:center}.pane-state.error{color:var(--danger)}
.photo-nav{display:grid;grid-template-columns:116rpx 1fr 116rpx;align-items:center;gap:9rpx;margin-top:11rpx}.photo-nav text{color:var(--text-muted);font-size:19rpx;text-align:center}.photo-nav button,.photo-actions button{min-height:68rpx;margin:0;padding:0 8rpx;border-radius:11rpx;background:#fff;color:var(--accent-strong);font-size:20rpx}.photo-nav button::after,.photo-actions button::after{border:0}.photo-actions{display:flex;gap:8rpx;margin-top:10rpx}.photo-actions button{flex:1}.orientation-note{display:block;margin-top:9rpx;color:var(--text-muted);font-size:18rpx;line-height:1.45;text-align:center}
.answer-head{padding:2rpx 0 12rpx}.wrong-count{flex:none;color:var(--danger);font-size:20rpx;font-weight:720}.answer-row{box-sizing:border-box;width:100%;min-height:126rpx;margin:0 0 10rpx;padding:15rpx;border:2rpx solid var(--border);border-radius:13rpx;background:#fff;text-align:left}.answer-row:last-child{margin-bottom:0}.answer-row::after{border:0}.answer-row.wrong{border-color:var(--danger);background:var(--danger-soft)}.answer-top{display:flex;align-items:center;justify-content:space-between;gap:7rpx}.answer-no{width:40rpx;height:40rpx;display:flex;align-items:center;justify-content:center;border-radius:9rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:21rpx;font-weight:760}.answer-row.wrong .answer-no{background:var(--danger);color:#fff}.answer-state{color:var(--accent-strong);font-size:18rpx;font-weight:700}.answer-row.wrong .answer-state{color:var(--danger)}.answer-value{display:flex;margin-top:8rpx;color:var(--ink);font-size:28rpx;font-weight:780}.answer-stem{display:flex;margin-top:6rpx;color:var(--text-muted);font-size:19rpx;line-height:1.45}
.footer-actions{position:fixed;left:0;right:0;bottom:0;z-index:8;display:grid;grid-template-columns:repeat(3,1fr);gap:10rpx;padding:14rpx 22rpx calc(14rpx + env(safe-area-inset-bottom));border-top:1rpx solid var(--border);background:rgba(255,255,255,.97);box-shadow:0 -12rpx 30rpx rgba(24,58,54,.1)}.footer-actions button{min-height:86rpx;margin:0;border-radius:14rpx;font-size:24rpx;font-weight:750}.footer-actions button::after{border:0}.save-only{grid-column:1/-1;background:var(--primary);color:#fff}.after-btn.preview{background:var(--accent-soft);color:var(--accent-strong)}.after-btn.album{background:#F7EBD6;color:#7B5824}.after-btn.next{background:var(--primary);color:#fff}
.poster-canvas{position:fixed;left:-10000px;top:0;pointer-events:none}
@media (max-width:380px){.queue-card{align-items:flex-start;flex-direction:column}.queue-controls{width:100%}.queue-controls button{flex:1}.photo-pane,.answer-pane{padding:12rpx}.photo-stage{height:620rpx}.photo-nav{grid-template-columns:100rpx 1fr 100rpx}.answer-value{font-size:26rpx}}
</style>
