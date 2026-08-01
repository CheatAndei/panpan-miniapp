<template>
  <view class="page">
    <view class="hero">
      <view>
        <text class="eyebrow">REVIEW DESK</text>
        <text class="hero-title">批改台</text>
        <text class="hero-sub">只显示未批改打卡 · 点选错题即可</text>
      </view>
      <view class="pending-badge">
        <pp-icon name="bell" :size="28" :motion="todoCount > 0 ? 'ring' : 'none'" />
        <text class="pending-number">{{ todoCount }}</text>
        <text>待批</text>
      </view>
    </view>

    <view class="recent-review-card">
      <view class="recent-review-head">
        <view>
          <text class="recent-review-kicker">RECENTLY REVIEWED</text>
          <text class="recent-review-title">最近批改</text>
          <text class="recent-review-sub">默认展示最近 3 份，可展开横向查看</text>
        </view>
        <button
          v-if="recentReviews.length > 3"
          class="recent-toggle"
          @tap="recentExpanded = !recentExpanded"
        >
          {{ recentExpanded ? '收起' : `展开 ${recentReviews.length} 份` }}
        </button>
      </view>
      <view v-if="recentLoading" class="recent-state">正在整理最近批改…</view>
      <view v-else-if="recentError" class="recent-state error">
        <text>{{ recentError }}</text>
        <button @tap="loadRecentReviews">重试</button>
      </view>
      <view v-else-if="!recentReviews.length" class="recent-state">还没有已批改记录</view>
      <scroll-view
        v-else
        class="recent-scroll"
        scroll-x
        :show-scrollbar="false"
        :enable-flex="true"
      >
        <view class="recent-track">
          <button
            v-for="record in recentVisibleReviews"
            :key="record.id"
            class="recent-item"
            :disabled="activeSubmission?._saving || activeSubmission?._posterBusy || activeSubmission?._posterSaving"
            @tap="openRecentReview(record)"
          >
            <view class="recent-item-top">
              <text class="recent-name">{{ record.student_name }}</text>
              <text :class="['recent-status',{correction:record.status==='correction_required'}]">
                {{ record.status === 'correction_required' ? '待订正' : '已通过' }}
              </text>
            </view>
            <text class="recent-plan">{{ record.plan_title || record.title || '打卡计划' }}</text>
            <text class="recent-date">{{ record.practice_date || formatReviewedAt(record.reviewed_at) }}</text>
            <view :class="['recent-item-bottom',{correction:record.status==='correction_required'}]">
              <text>{{ recentReviewResult(record) }}</text>
              <text class="recent-link">查看 / 修改 / 海报</text>
            </view>
          </button>
        </view>
      </scroll-view>
    </view>

    <view v-if="loading && !activeSubmission" class="state-card"><pp-state type="loading" title="正在读取待批作业" /></view>
    <view v-else-if="queueError && !activeSubmission" class="state-card">
      <pp-state type="error" title="批改台加载失败" :description="queueError" action-text="重新加载" @action="loadQueue" />
    </view>
    <view v-else-if="!activeSubmission" class="state-card">
      <pp-state
        title="批改已清空"
        description="新的学生打卡提交后，会自动出现在这里。"
        action-text="查看已批改记录"
        @action="goPracticeTeacher"
      />
    </view>

    <template v-else>
      <view v-if="queueError" class="queue-error-strip" role="alert">
        <text>{{ queueError }}</text>
        <button :disabled="loading" @tap="loadQueue">{{ loading ? '重试中…' : '重新加载' }}</button>
      </view>
      <view class="queue-card">
        <view>
          <view class="queue-name-line">
            <text class="queue-name">{{ activeSubmission.student_name }}</text>
            <text v-if="activeSubmission._isCorrection" class="correction-badge">订正第 {{ activeSubmission._correctionRound }} 轮</text>
          </view>
          <text class="queue-meta">{{ activeSubmission.practice_date }} · 第 {{ activeSubmissionIndex + 1 }} / {{ submissions.length }} 份</text>
        </view>
        <view class="queue-controls">
          <button :disabled="activeSubmissionIndex<=0 || activeSubmission._saved || activeSubmission._saving || activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="goSubmission(-1)">上一位</button>
          <button :disabled="activeSubmissionIndex>=submissions.length-1 || activeSubmission._saved || activeSubmission._saving || activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="goSubmission(1)">下一位</button>
        </view>
      </view>

      <view class="review-card">
        <view :class="['review-tip',{correction:activeSubmission._isCorrection,editing:activeSubmission._editing}]">
          <text class="tip-title">
            {{ activeSubmission._editing
              ? '正在修改批改'
              : activeSubmission._history
                ? '历史批改记录'
                : activeSubmission._isCorrection ? '订正复核' : '只点错题' }}
          </text>
          <text class="tip-copy">
            {{ activeSubmission._editing
              ? '请重新核对当前轮全部题目；保存前会再次说明对家长订正状态的影响。'
              : activeSubmission._history
                ? '可预览、旋转并补存图片；最新有效轮次在未进入下一轮订正前允许修改。'
                : activeSubmission._isCorrection
              ? '只看新照片 / 上一轮错题；仍有错误的题再点为错题。'
              : '未点选的题默认正确；保存后再进入预览或保存相册。' }}
          </text>
        </view>

        <view class="workbench">
          <view class="photo-pane">
            <view class="pane-head">
              <view>
                <text class="pane-title">{{ activeSubmission._isCorrection ? '本轮新照片' : '学生照片' }}</text>
                <text class="pane-sub">双指缩放 1×–4×，放大后拖动，松手停在当前位置</text>
              </view>
              <text class="pane-count">
                {{ activeSubmission._photoPaths.length ? activeSubmission._activePhoto + 1 : 0 }} / {{ activeSubmission.attachments.length }}
              </text>
            </view>
            <view
              :class="['photo-stage',{empty:!activeSubmission._photoPaths.length}]"
              :style="photoStageStyle"
            >
              <view v-if="activeSubmission._photosLoading" class="pane-state">正在读取私有照片…</view>
              <view v-else-if="activeSubmission._photoPaths.length" class="photo-frame">
                <movable-area class="zoom-area" :scale-area="true">
                  <movable-view
                    :key="activePhotoViewKey"
                    class="zoom-view"
                    direction="all"
                    :inertia="false"
                    :animation="false"
                    :out-of-bounds="false"
                    :scale="true"
                    :scale-min="1"
                    :scale-max="4"
                  >
                    <image
                      :src="activeSubmission._photoPaths[activeSubmission._activePhoto]"
                      mode="aspectFit"
                      class="submission-photo"
                      :style="{transform:`rotate(${activeSubmission._rotations[activeSubmission._activePhoto]||0}deg)`}"
                    />
                  </movable-view>
                </movable-area>
              </view>
              <view v-else class="pane-state error">照片暂未读到，请重新读取</view>
            </view>
            <view v-if="activeSubmission._photoPaths.length > 1" class="photo-nav">
              <button :disabled="activeSubmission._activePhoto <= 0" @tap="changePhotoBy(-1)">上一张</button>
              <text>点缩略图切换 · {{ activeSubmission._activePhoto + 1 }} / {{ activeSubmission._photoPaths.length }}</text>
              <button :disabled="activeSubmission._activePhoto >= activeSubmission._photoPaths.length - 1" @tap="changePhotoBy(1)">下一张</button>
            </view>
            <scroll-view
              v-if="activeSubmission._photoPaths.length > 1"
              class="photo-thumbs"
              scroll-x
              :show-scrollbar="false"
              :enable-flex="true"
            >
              <view class="photo-thumb-track">
                <button
                  v-for="(photo,index) in activeSubmission._photoPaths"
                  :key="photo"
                  :class="['photo-thumb',{active:index===activeSubmission._activePhoto}]"
                  :aria-label="`查看第 ${index + 1} 张照片`"
                  @tap="selectPhoto(index)"
                >
                  <image :src="photo" mode="aspectFill" />
                  <text>{{ index + 1 }}</text>
                </button>
              </view>
            </scroll-view>
            <view class="photo-actions">
              <button :disabled="!activeSubmission._photoPaths.length || activeSubmission._saving || activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="resetCurrentPhoto">还原缩放</button>
              <button :disabled="!activeSubmission._photoPaths.length || activeSubmission._saving || activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="rotateCurrentPhoto">旋转 90°</button>
              <button v-if="activeSubmission._photoFailures" :disabled="activeSubmission._photosLoading || activeSubmission._saving || activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="retryPhotos">重读</button>
            </view>
            <text class="orientation-note">图片在当前页原地缩放，不会打开原图或刷新批改记录。</text>
          </view>

          <view class="answer-pane">
            <view class="pane-head answer-head">
              <view>
                <text class="pane-title">{{ activeSubmission._isCorrection ? '上一轮错题' : '标准答案' }}</text>
                <text class="pane-sub">{{ activeSubmission._isCorrection ? '默认已订正，只点仍然错误的题' : '左右滑动题卡，点击整张题卡标记错题' }}</text>
              </view>
              <text class="wrong-count">错 {{ wrongCount }} 题</text>
            </view>
            <scroll-view
              class="answer-scroll"
              scroll-x
              :show-scrollbar="false"
              :enable-flex="true"
            >
              <view class="answer-track">
                <button
                  v-for="item in activeSubmission.items"
                  :key="item.id"
                  :class="['answer-row',{wrong:item._correct===false}]"
                  :disabled="(activeSubmission._saved && !activeSubmission._editing) || activeSubmission._saving"
                  @tap="toggleWrong(item)"
                >
                  <view class="answer-top">
                    <text class="answer-no">{{ item.position }}</text>
                    <text class="answer-state">{{ item._correct===false?'错题':'默认正确' }}</text>
                  </view>
                  <pp-math-text
                    class="answer-value"
                    :value="item.answer"
                    :blocks="item.answer_render && item.answer_render.blocks"
                  />
                  <pp-math-text
                    class="answer-stem"
                    :value="item.stem"
                    :blocks="item.render && item.render.blocks"
                  />
                </button>
              </view>
            </scroll-view>
            <text v-if="activeSubmission.items.length > 1" class="answer-swipe-hint">← 左右滑动查看更多题目 →</text>
          </view>
        </view>
      </view>

      <view class="footer-actions">
        <template v-if="!activeSubmission._saved || activeSubmission._editing">
          <view v-if="activeSubmission._editing" class="edit-impact-note">
            <text class="edit-impact-title">修改会立即同步家长端</text>
            <text class="edit-impact-copy">{{ editImpactText }}</text>
          </view>
          <view :class="['review-save-actions',{editing:activeSubmission._editing}]">
            <button v-if="activeSubmission._editing" class="cancel-edit" :disabled="activeSubmission._saving" @tap="cancelReviewEdit">取消修改</button>
            <button
              class="save-only"
              :disabled="activeSubmission._saving || activeSubmission._photosLoading || (!activeSubmission._editing && !photosReady)"
              @tap="saveReview"
            >
              {{ activeSubmission._saving
                ? '保存中…'
                : activeSubmission._editing
                  ? '确认保存修改'
                  : wrongCount ? `保存并打回（${wrongCount} 题）` : '保存通过' }}
            </button>
          </view>
        </template>
        <template v-else>
          <view v-if="activeSubmission._history" class="revision-bar">
            <view class="revision-copy">
              <text class="revision-title">需要调整判题？</text>
              <text class="revision-sub">
                {{ activeSubmission._reviewEditable
                  ? '可修改最新有效轮，保存后重新生成海报。'
                  : activeSubmission._reviewLockReason || '家长已进入下一轮订正，当前记录已锁定。' }}
              </text>
            </view>
            <button
              v-if="activeSubmission._reviewEditable"
              class="revision-button"
              :disabled="activeSubmission._posterBusy || activeSubmission._posterSaving"
              @tap="beginReviewEdit"
            >
              修改批改
            </button>
            <text v-else class="revision-locked">已锁定</text>
          </view>
          <view class="poster-guide">
            <view class="poster-guide-heading">
              <pp-icon name="check" :size="28" motion="pop" />
              <text class="poster-guide-label">本次海报</text>
            </view>
            <text class="poster-guide-copy">鼓励文案会随机更新，预览满意后保存</text>
          </view>
          <view v-if="activeSubmission._posterError" class="poster-error-strip" role="alert">
            <text>{{ activeSubmission._posterError }}</text>
          </view>
          <view class="after-actions">
            <button class="after-btn preview" :disabled="activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="previewPoster">{{ activeSubmission._posterBusy ? '生成中…' : '预览' }}</button>
            <button class="after-btn album" :disabled="activeSubmission._posterBusy || activeSubmission._posterSaving" @tap="savePoster">{{ activeSubmission._posterSaving ? '保存中…' : '保存相册' }}</button>
            <button
              class="after-btn next"
              :disabled="activeSubmission._posterBusy || activeSubmission._posterSaving"
              @tap="activeSubmission._history ? goPracticeTeacher() : nextAfterSave()"
            >
              {{ activeSubmission._history ? '返回计划' : '下一位' }}
            </button>
          </view>
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
import { teacherDisplayName } from '@/utils/brand';
import { isAlbumPermissionError } from '@/utils/photo-album';
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
const queueError = ref('');
const recentReviews = ref([]);
const recentLoading = ref(false);
const recentError = ref('');
const recentExpanded = ref(false);
const requestedPlanId = ref(0);
const requestedSubmissionId = ref(0);
const hasShown = ref(false);
const storedUser = (() => {
  const value = uni.getStorageSync('user');
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || '{}'); } catch { return {}; }
})();
const posterTeacherName = computed(() => teacherDisplayName(storedUser.nickname));
const activeSubmission = computed(() => submissions.value[activeSubmissionIndex.value] || null);
const wrongCount = computed(() => activeSubmission.value?.items?.filter((item) => item._correct === false).length || 0);
const editImpactText = computed(() => {
  const submission = activeSubmission.value;
  if (!submission?._editing) return '';
  if (submission.status === 'reviewed' && wrongCount.value > 0) {
    return `将从“已通过”改为“错 ${wrongCount.value} 题”，家长端会立即重新出现订正任务。`;
  }
  if (submission.status === 'correction_required' && wrongCount.value === 0) {
    return '将从“待订正”改为“全部正确”，家长端现有待订正任务会立即取消。';
  }
  return wrongCount.value ? `保存后家长端将显示错 ${wrongCount.value} 题并保持待订正。` : '保存后家长端将显示本轮全部正确。';
});
const photosReady = computed(() => {
  const submission = activeSubmission.value;
  return Boolean(submission?.attachments?.length && submission._photoPaths.length === submission.attachments.length);
});
const recentVisibleReviews = computed(() => (
  recentExpanded.value ? recentReviews.value : recentReviews.value.slice(0, 3)
));
const activePhotoViewKey = computed(() => {
  const submission = activeSubmission.value;
  if (!submission?._photoPaths?.length) return 'photo-empty';
  const index = Number(submission._activePhoto || 0);
  return [
    submission.id,
    index,
    submission._photoPaths[index],
    submission._photoResetKeys[index] || 0,
    submission._rotations[index] || 0,
  ].join(':');
});
const photoStageStyle = computed(() => {
  const submission = activeSubmission.value;
  if (!submission?._photoPaths?.length) return {};
  const index = Number(submission._activePhoto || 0);
  const info = submission._photoInfos[index] || {};
  let width = Math.max(1, Number(info.width || 1));
  let height = Math.max(1, Number(info.height || 1));
  const rotation = Number(submission._rotations[index] || 0) + Number(info.exifRotation || 0);
  if (Math.abs(Math.round(rotation / 90)) % 2 === 1) {
    [width, height] = [height, width];
  }
  const fittedHeight = Math.round(640 * height / width);
  return { height: `${Math.max(480, Math.min(860, fittedHeight))}rpx` };
});

onLoad((options) => {
  requestedPlanId.value = Number(options?.plan_id || 0);
  requestedSubmissionId.value = Number(options?.submission_id || 0);
});
onShow(() => {
  const firstShow = !hasShown.value;
  hasShown.value = true;
  const current = activeSubmission.value;
  const hasUnsavedChanges = Boolean(
    current?._editing
      || current?._saving
      || current?._posterBusy
      || current?._posterSaving
      || (!current?._saved && current?.items?.some((item) => item._correct === false)),
  );
  if (!firstShow && hasUnsavedChanges) {
    loadRecentReviews();
    return;
  }
  loadQueue();
  loadRecentReviews();
});
onPullDownRefresh(async () => {
  try { await Promise.all([loadQueue(), loadRecentReviews()]); }
  finally { uni.stopPullDownRefresh(); }
});

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

function reviewedItemCorrect(item) {
  const value = item.is_correct ?? item.isCorrect;
  if (value === null || value === undefined || value === '') return true;
  return booleanField(value);
}

function formatReviewedAt(value) {
  const text = String(value || '');
  return text ? text.replace('T', ' ').slice(0, 16) : '刚刚批改';
}

function recentReviewResult(record) {
  const wrongNumbers = Array.isArray(record.wrong_positions)
    ? record.wrong_positions
    : Array.isArray(record.wrong_numbers)
      ? record.wrong_numbers
    : (record.items || []).filter((item) => !reviewedItemCorrect(item)).map((item) => item.position);
  const wrongCount = Number(record.wrong_count ?? wrongNumbers.length ?? 0);
  if (!wrongCount) return '全部正确';
  if (wrongNumbers.length) return `错 ${wrongNumbers.slice(0, 4).join('、')}${wrongNumbers.length > 4 ? '…' : ''}`;
  return `错 ${wrongCount} 题`;
}

async function loadRecentReviews() {
  if (recentLoading.value) return;
  recentLoading.value = true;
  recentError.value = '';
  try {
    const result = await api.get('/practice/reviews/recent?limit=20');
    recentReviews.value = result.reviews || result.submissions || [];
  } catch (error) {
    recentError.value = error?.error || error?.message || '最近批改读取失败';
  } finally {
    recentLoading.value = false;
  }
}

function confirmAction({ title, content, confirmText = '确认' }) {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false),
    });
  });
}

async function openRecentReview(record) {
  const planId = Number(record?.plan_id || 0);
  const submissionId = Number(record?.submission_id || record?.id || 0);
  if (!planId || !submissionId) {
    uni.showToast({ title: '这条记录暂时无法打开', icon: 'none' });
    return;
  }
  const current = activeSubmission.value;
  const hasUnsavedChanges = current?._editing
    || (current && !current._saved && current.items.some((item) => item._correct === false));
  if (hasUnsavedChanges) {
    const confirmed = await confirmAction({
      title: '切换到已批改记录？',
      content: current?._editing
        ? '当前已批改记录的修改尚未保存，切换后会丢失。'
        : '当前还未保存的错题标记会丢失。',
      confirmText: '继续切换',
    });
    if (!confirmed) return;
  }
  loading.value = true;
  queueError.value = '';
  try {
    const loaded = await loadRequestedSubmission(planId, submissionId);
    if (!loaded) throw new Error('记录已更新，请刷新后重试');
    if (typeof uni.pageScrollTo === 'function') uni.pageScrollTo({ scrollTop: 0, duration: 180 });
  } catch (error) {
    uni.showToast({ title: error?.error || error?.message || '批改记录打开失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function currentRoundAttachments(submission, correctionRound) {
  const attachments = Array.isArray(submission.attachments) ? submission.attachments : [];
  const currentRound = (submission.rounds || []).find((round) => Number(round.round_no) === correctionRound);
  const roundAttachments = Array.isArray(currentRound?.attachments) ? currentRound.attachments : [];
  return roundAttachments.length ? roundAttachments : attachments;
}

function prepareSubmission(submission, { history = false } = {}) {
  const correctionRound = Math.max(1, Number(submission.correction_round ?? submission.correctionRound ?? 1) || 1);
  const isCorrection = booleanField(submission.is_correction ?? submission.isCorrection) || correctionRound > 1;
  const isHistorical = history && ['reviewed', 'correction_required'].includes(submission.status);
  const attachments = currentRoundAttachments(submission, correctionRound);
  const focusIds = normalizeItemIds(submission.focus_item_ids ?? submission.focusItemIds);
  const focusSet = new Set(focusIds);
  const allItems = submission.items || [];
  const focusedItems = !isHistorical && isCorrection && focusSet.size
    ? allItems.filter((item) => focusSet.has(String(item.id)) || focusSet.has(String(item.position)))
    : allItems;
  const explicitReviewEditable = submission.review_editable
    ?? submission.reviewEditable
    ?? submission.editable
    ?? submission.can_revise;
  return {
    ...submission,
    attachments,
    _isCorrection: isCorrection,
    _correctionRound: correctionRound,
    _needsCorrection: booleanField(submission.needs_correction ?? submission.needsCorrection),
    _focusItemIds: focusIds,
    _history: isHistorical,
    _editing: false,
    _editSnapshot: [],
    _reviewEditable: isHistorical
      ? (explicitReviewEditable === undefined || explicitReviewEditable === null
        ? true
        : booleanField(explicitReviewEditable))
      : false,
    _reviewLockReason: submission.review_lock_reason
      || submission.reviewLockReason
      || submission.lock_reason
      || submission.revision_lock_reason
      || '',
    _reviewVersion: submission.review_revision
      ?? submission.review_version
      ?? submission.reviewVersion
      ?? null,
    _reviewedAt: submission.reviewed_at || '',
    _saving: false,
    _saved: isHistorical,
    _posterBusy: false,
    _posterSaving: false,
    _posterError: '',
    _posterPath: '',
    _photosLoading: false,
    _photoFailures: 0,
    _activePhoto: 0,
    _photoPaths: [],
    _photoInfos: [],
    _rotations: [],
    _photoResetKeys: [],
    items: focusedItems.map((item) => ({
      ...item,
      _correct: isHistorical ? reviewedItemCorrect(item) : true,
    })),
  };
}

async function loadQueue() {
  if (loading.value) return;
  const current = activeSubmission.value;
  const currentSubmissionId = Number(current?.id || 0);
  const currentPlanId = Number(current?.plan_id || 0);
  const routePlanId = requestedPlanId.value;
  const routeSubmissionId = requestedSubmissionId.value;
  loading.value = true;
  queueError.value = '';
  try {
    const pageSize = 50;
    let page = 1;
    let expectedCount = 0;
    const queued = [];
    do {
      const result = await api.get(`/practice/todos?limit=${pageSize}&page=${page}&include_review=1`);
      const batch = result.todos || [];
      expectedCount = Number(result.count || 0);
      queued.push(...batch);
      page += 1;
      if (batch.length < pageSize) break;
    } while (queued.length < expectedCount);
    todos.value = [...new Map(queued.map((item) => [Number(item.submission_id), item])).values()];
    todoCount.value = todos.value.length;
    if (current?._saved && !requestedSubmissionId.value && !requestedPlanId.value) return;
    const requestedTodo = todos.value.find((item) => Number(item.submission_id) === routeSubmissionId);
    if (routePlanId && routeSubmissionId && !requestedTodo) {
      const loaded = await loadRequestedSubmission(routePlanId, routeSubmissionId);
      requestedPlanId.value = 0;
      requestedSubmissionId.value = 0;
      if (loaded) return;
    }
    const prepared = todos.value.map(prepareSubmission);
    const requested = prepared.find((item) => Number(item.submission_id) === Number(requestedTodo?.submission_id))
      || prepared.find((item) => Number(item.plan_id) === routePlanId)
      || prepared.find((item) => Number(item.submission_id) === currentSubmissionId)
      || prepared.find((item) => Number(item.plan_id) === currentPlanId)
      || prepared[0];
    requestedPlanId.value = 0;
    requestedSubmissionId.value = 0;
    if (!requested) {
      submissions.value = [];
      return;
    }
    submissions.value = prepared;
    const preferredIndex = prepared.findIndex((item) => Number(item.submission_id) === Number(requested.submission_id));
    activeSubmissionIndex.value = preferredIndex >= 0 ? preferredIndex : 0;
    await ensurePhotos(activeSubmission.value);
  } catch (error) {
    queueError.value = error?.error || error?.message || '请检查网络后重试';
    if (activeSubmission.value) {
      uni.showToast({ title: '批改台刷新失败', icon: 'none' });
    }
  } finally {
    loading.value = false;
  }
}

async function loadRequestedSubmission(planId, submissionId) {
  const result = await api.get(`/practice/submissions?plan_id=${planId}&status=all&limit=50&page=1&submission_id=${submissionId}`);
  const record = (result.submissions || []).find((item) => Number(item.id) === Number(submissionId));
  if (!record) return false;
  if (record.status === 'submitted') {
    submissions.value = [prepareSubmission(record)];
    activeSubmissionIndex.value = 0;
    await ensurePhotos(activeSubmission.value);
    return true;
  }
  if (!['reviewed', 'correction_required'].includes(record.status)) return false;
  submissions.value = [prepareSubmission(record, { history: true })];
  activeSubmissionIndex.value = 0;
  await ensurePhotos(activeSubmission.value);
  return true;
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
    submission._activePhoto = 0;
    submission._rotations = submission._photoPaths.map(() => 0);
    submission._photoResetKeys = submission._photoPaths.map(() => 0);
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
  submission._activePhoto = 0;
  submission._posterPath = '';
  submission._posterError = '';
  await ensurePhotos(submission);
}

async function goSubmission(delta) {
  const current = activeSubmission.value;
  if (current?._saving || current?._posterBusy || current?._posterSaving) return;
  const target = activeSubmissionIndex.value + delta;
  if (target < 0 || target >= submissions.value.length) return;
  activeSubmissionIndex.value = target;
  await ensurePhotos(activeSubmission.value);
}

function selectPhoto(index) {
  const submission = activeSubmission.value;
  if (!submission) return;
  submission._activePhoto = Math.max(0, Math.min(submission._photoPaths.length - 1, Number(index || 0)));
}
function changePhotoBy(delta) {
  const submission = activeSubmission.value;
  if (!submission) return;
  const target = Math.max(0, Math.min(submission._photoPaths.length - 1, submission._activePhoto + delta));
  selectPhoto(target);
}
function resetCurrentPhoto() {
  const submission = activeSubmission.value;
  const index = submission?._activePhoto || 0;
  if (!submission) return;
  submission._photoResetKeys[index] = Number(submission._photoResetKeys[index] || 0) + 1;
}
function rotateCurrentPhoto() {
  const submission = activeSubmission.value;
  const index = submission?._activePhoto || 0;
  if (!submission) return;
  submission._rotations[index] = (Number(submission._rotations[index] || 0) + 90) % 360;
  submission._photoResetKeys[index] = Number(submission._photoResetKeys[index] || 0) + 1;
  submission._posterPath = '';
}
function toggleWrong(item) {
  if (
    activeSubmission.value?._saving
    || (activeSubmission.value?._saved && !activeSubmission.value?._editing)
  ) return;
  item._correct = item._correct === false;
}

function beginReviewEdit() {
  const submission = activeSubmission.value;
  if (!submission?._history || !submission._reviewEditable || submission._saving) return;
  submission._editSnapshot = submission.items.map((item) => ({
    id: item.id,
    correct: item._correct !== false,
  }));
  submission._editing = true;
}

function cancelReviewEdit({ restore = true, force = false } = {}) {
  const submission = activeSubmission.value;
  if (!submission?._editing || (submission._saving && !force)) return;
  if (restore) {
    const snapshot = new Map((submission._editSnapshot || []).map((item) => [String(item.id), item.correct]));
    submission.items.forEach((item) => {
      if (snapshot.has(String(item.id))) item._correct = snapshot.get(String(item.id));
    });
  }
  submission._editing = false;
  submission._editSnapshot = [];
}

async function saveReviewRevision(submission) {
  const confirmed = await confirmAction({
    title: '确认修改批改结果？',
    content: `${editImpactText.value} 此操作会留下修改记录。`,
    confirmText: '确认修改',
  });
  if (!confirmed) return;
  submission._saving = true;
  try {
    const result = await api.put(`/practice/submissions/${submission.id}/review/revision`, {
      results: submission.items.map((item) => ({
        item_id: item.id,
        is_correct: item._correct,
        note: item.review_note || item.teacher_note || '',
      })),
      round_no: submission._correctionRound,
      correction_round: submission._correctionRound,
      expected_round: submission._correctionRound,
      expected_revision: Number(submission._reviewVersion || 0),
    });
    submission.status = result.status || (wrongCount.value ? 'correction_required' : 'reviewed');
    submission._needsCorrection = booleanField(result.needs_correction ?? (submission.status === 'correction_required'));
    submission.needs_correction = submission._needsCorrection;
    submission._reviewedAt = result.reviewed_at || result.updated_at || submission._reviewedAt;
    submission._reviewVersion = result.review_revision
      ?? result.review_version
      ?? result.version
      ?? submission._reviewVersion;
    submission._reviewEditable = result.can_revise !== false && result.review_editable !== false;
    submission._reviewLockReason = result.revision_lock_reason || result.review_lock_reason || '';
    submission._posterPath = '';
    submission._posterError = '';
    submission._editing = false;
    submission._editSnapshot = [];
    submission._saved = true;
    await loadRecentReviews();
    uni.showToast({ title: '批改结果已更新', icon: 'success' });
  } catch (error) {
    const message = error?.error || error?.message || '修改失败';
    if (Number(error?.statusCode) === 409) {
      cancelReviewEdit({ force: true });
      try {
        await loadRequestedSubmission(Number(submission.plan_id || 0), Number(submission.id || 0));
        await loadRecentReviews();
      } catch {
        submission._reviewEditable = false;
        submission._reviewLockReason = message;
      }
    }
    uni.showToast({ title: message, icon: 'none' });
  } finally {
    submission._saving = false;
  }
}

async function saveReview() {
  const submission = activeSubmission.value;
  if (!submission || submission._saving || (!submission._editing && !photosReady.value)) return;
  if (submission._history && submission._editing) {
    await saveReviewRevision(submission);
    return;
  }
  const submissionWrongCount = submission.items.filter((item) => item._correct === false).length;
  submission._saving = true;
  try {
    const result = await api.put(`/practice/submissions/${submission.id}/review`, {
      teacher_note: '',
      results: submission.items.map((item) => ({ item_id: item.id, is_correct: item._correct })),
      round_no: submission._correctionRound,
      correction_round: submission._correctionRound,
    });
    submission.status = result.status || (submissionWrongCount ? 'correction_required' : 'reviewed');
    submission._correctionRound = Math.max(1, Number(result.correction_round || submission._correctionRound) || 1);
    submission._isCorrection = booleanField(result.is_correction ?? submission._isCorrection);
    submission._needsCorrection = booleanField(result.needs_correction ?? (submission.status === 'correction_required'));
    submission.needs_correction = submission._needsCorrection;
    submission._saved = true;
    todoCount.value = Math.max(0, todoCount.value - 1);
    uni.showToast({
      title: submissionWrongCount ? `已打回 ${submissionWrongCount} 题` : '已保存通过',
      icon: 'success',
    });
    loadRecentReviews();
  } catch (error) {
    uni.showToast({ title: error?.error || '保存失败', icon: 'none' });
  } finally {
    submission._saving = false;
  }
}

async function ensurePoster(submission = activeSubmission.value) {
  if (!submission) throw new Error('当前没有批改记录');
  if (submission._posterPath) return submission._posterPath;
  submission._posterBusy = true;
  submission._posterError = '';
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
      totalCount: submission.items.length,
      correctCount: submission.items.filter((item) => item._correct !== false).length,
      teacherName: posterTeacherName.value,
    });
    return submission._posterPath;
  } catch (error) {
    submission._posterError = error?.message || error?.errMsg || '海报生成失败，请重试';
    throw error;
  } finally {
    submission._posterBusy = false;
  }
}

async function previewPoster() {
  const submission = activeSubmission.value;
  if (!submission || submission._posterBusy || submission._posterSaving) return;
  try {
    const poster = await ensurePoster(submission);
    uni.previewImage({ current: poster, urls: [poster] });
  } catch (error) {
    uni.showToast({ title: error?.message || error?.errMsg || '海报生成失败', icon: 'none' });
  }
}

function requestAlbumPermissionRecovery() {
  return new Promise((resolve) => {
    uni.showModal({
      title: '需要相册权限',
      content: '请在设置中允许保存图片到相册，返回后会自动继续保存。',
      confirmText: '去设置',
      success: (result) => {
        if (!result.confirm || typeof uni.openSetting !== 'function') {
          resolve(false);
          return;
        }
        uni.openSetting({
          success: (settings) => resolve(Boolean(settings?.authSetting?.['scope.writePhotosAlbum'])),
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

async function savePoster() {
  const submission = activeSubmission.value;
  if (!submission || submission._posterBusy || submission._posterSaving) return;
  submission._posterSaving = true;
  submission._posterError = '';
  try {
    const poster = await ensurePoster(submission);
    await savePracticeReviewPoster(poster);
    uni.showToast({ title: '已保存到相册', icon: 'success' });
  } catch (error) {
    if (isAlbumPermissionError(error)) {
      const recovered = await requestAlbumPermissionRecovery();
      if (recovered) {
        try {
          await savePracticeReviewPoster(submission._posterPath);
          uni.showToast({ title: '已保存到相册', icon: 'success' });
        } catch (retryError) {
          submission._posterError = retryError?.message || retryError?.errMsg || '保存相册失败，请重试';
        }
      } else {
        submission._posterError = '相册权限未开启，请点击“保存相册”重试。';
      }
    } else {
      submission._posterError = error?.message || error?.errMsg || '保存相册失败，请重试';
    }
    if (submission._posterError) uni.showToast({ title: submission._posterError, icon: 'none' });
  } finally {
    submission._posterSaving = false;
  }
}

function goPracticeTeacher() {
  const submission = activeSubmission.value;
  if (submission && (submission._saving || submission._posterBusy || submission._posterSaving)) return;
  uni.redirectTo({ url: '/pages/practice-teacher/index' });
}

async function nextAfterSave() {
  const submission = activeSubmission.value;
  if (!submission?._saved || submission._posterBusy || submission._posterSaving) return;
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
.page {
  --review-green: #0B789A;
  --review-green-strong: #050505;
  --review-green-soft: #E5F8FE;
  --review-coral: #F79BC0;
  --review-coral-strong: #B53A52;
  --review-coral-soft: #FFF0F6;
  --review-paper: #F7FCFE;
  --review-ink: #050505;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20rpx 22rpx calc(270rpx + env(safe-area-inset-bottom));
  background-color: var(--review-paper);
  background-image: repeating-linear-gradient(
    180deg,
    transparent 0,
    transparent 55rpx,
    rgba(153, 222, 244, .055) 56rpx
  );
}

.hero {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  margin-bottom: 18rpx;
  padding: 30rpx 30rpx 28rpx 36rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-left: 8rpx solid var(--review-green);
  border-radius: 16rpx;
  background:
    repeating-linear-gradient(0deg, transparent 0 42rpx, rgba(153, 222, 244, .06) 43rpx 44rpx),
    #FFFFFF;
  color: var(--review-ink);
  box-shadow: 0 6rpx 18rpx rgba(5, 5, 5, .06);
}

.hero::after {
  content: '';
  position: absolute;
  top: 20rpx;
  right: -20rpx;
  width: 116rpx;
  height: 22rpx;
  border-radius: 4rpx;
  background: var(--review-green);
  opacity: .68;
  transform: rotate(2deg);
}

.eyebrow {
  display: block;
  color: var(--review-green-strong);
  font-size: 18rpx;
  font-weight: 750;
  letter-spacing: 0;
}

.hero-title {
  display: block;
  margin-top: 7rpx;
  color: var(--ink, #050505);
  font-size: 42rpx;
  font-weight: 800;
}

.hero-sub {
  display: block;
  margin-top: 4rpx;
  color: var(--text-secondary, #50545B);
  font-size: 22rpx;
}

.pending-badge {
  position: relative;
  z-index: 1;
  min-width: 118rpx;
  height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  flex: none;
  padding: 0 10rpx;
  border: 1rpx solid #F2C8D5;
  border-radius: 14rpx;
  background: var(--review-coral-soft);
  color: var(--review-coral-strong);
  font-size: 18rpx;
}

.pending-number {
  font-size: 30rpx;
  font-weight: 800;
  line-height: 1.1;
}

.recent-review-card {
  margin-bottom: 18rpx;
  padding: 22rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--review-green);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.recent-review-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
}

.recent-review-kicker {
  display: block;
  color: var(--review-green-strong);
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 0;
}

.recent-review-title {
  display: block;
  margin-top: 2rpx;
  color: var(--ink, #050505);
  font-size: 29rpx;
  font-weight: 780;
}

.recent-review-sub {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted, #50545B);
  font-size: 19rpx;
}

.recent-toggle {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin: 0;
  padding: 0 17rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 11rpx;
  background: var(--review-green-soft);
  color: var(--review-green-strong);
  font-size: 20rpx;
  font-weight: 720;
}

.recent-toggle::after,
.recent-item::after,
.recent-state button::after {
  border: 0;
}

.recent-state {
  min-height: 94rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
  margin-top: 14rpx;
  border-radius: 12rpx;
  background: var(--surface-muted, #F8FCFD);
  color: var(--text-muted, #50545B);
  font-size: 21rpx;
}

.recent-state.error {
  background: var(--danger-soft, #FFF0F6);
  color: var(--danger, #B53A52);
}

.recent-state button {
  min-height: 72rpx;
  margin: 0;
  padding: 0 16rpx;
  border: 1rpx solid #F2C8D5;
  border-radius: 10rpx;
  background: #FFFFFF;
  color: #B53A52;
  font-size: 20rpx;
}

.recent-scroll {
  width: 100%;
  margin-top: 16rpx;
  white-space: nowrap;
}

.recent-track {
  display: inline-flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 2rpx;
}

.recent-item {
  width: 316rpx;
  height: auto;
  min-height: 0;
  flex: 0 0 316rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  padding: 18rpx;
  border: 1rpx solid #DCE9ED;
  border-radius: 14rpx;
  background: #FFFFFF;
  color: var(--ink, #050505);
  text-align: left;
  white-space: normal;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.recent-item:active {
  transform: scale(var(--tap-scale, .975));
  opacity: .9;
}

.recent-item-top,
.recent-item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.recent-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ink, #050505);
  font-size: 25rpx;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-status {
  flex: none;
  padding: 4rpx 9rpx;
  border-radius: 7rpx;
  background: var(--review-green-soft);
  color: var(--review-green-strong);
  font-size: 17rpx;
  font-weight: 720;
}

.recent-status.correction {
  background: var(--review-coral-soft);
  color: var(--review-coral-strong);
}

.recent-plan,
.recent-date {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-plan {
  margin-top: 11rpx;
  color: var(--text-secondary, #50545B);
  font-size: 21rpx;
  font-weight: 650;
}

.recent-date {
  margin-top: 3rpx;
  color: var(--text-muted, #50545B);
  font-size: 18rpx;
}

.recent-item-bottom {
  width: 100%;
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid var(--hairline, #EDF3F5);
  color: var(--review-green-strong);
  font-size: 19rpx;
  font-weight: 680;
}

.recent-item-bottom.correction {
  color: var(--review-coral-strong);
}

.recent-link {
  color: var(--review-green-strong);
  font-size: 17rpx;
}

.state-card {
  margin-top: 40rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--review-green);
  border-radius: 16rpx;
  background: #FFFFFF;
}

.queue-error-strip {
  min-height: 112rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 16rpx 20rpx;
  border: 1rpx solid #F2C8D5;
  border-radius: 14rpx;
  background: var(--danger-soft, #FFF0F6);
  color: #B53A52;
  font-size: 21rpx;
}

.queue-error-strip button {
  min-height: 88rpx;
  flex: none;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid #F2C8D5;
  border-radius: 11rpx;
  background: #FFFFFF;
  color: #B53A52;
  font-size: 21rpx;
  font-weight: 720;
}

.queue-error-strip button::after { border: 0; }

.queue-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-width: 0;
  margin-bottom: 16rpx;
  padding: 20rpx 22rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #DCE9ED);
  border-top: 5rpx solid var(--review-coral);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.queue-card > view:first-child {
  min-width: 0;
  flex: 1;
}

.queue-name-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.queue-name {
  display: block;
  color: var(--ink, #050505);
  font-size: 31rpx;
  font-weight: 780;
}

.correction-badge {
  padding: 7rpx 11rpx;
  border: 1rpx solid #F2C8D5;
  border-radius: 9rpx;
  background: var(--review-coral-soft);
  color: var(--review-coral-strong);
  font-size: 18rpx;
  font-weight: 740;
}

.queue-meta {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted, #50545B);
  font-size: 21rpx;
}

.queue-controls {
  width: 250rpx;
  max-width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: center;
  gap: 10rpx;
  flex: 0 1 250rpx;
  overflow: hidden;
}

.footer-actions button {
  min-height: 88rpx;
  margin: 0;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.queue-controls button {
  width: 100%;
  max-width: 100%;
  min-height: 88rpx;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 15rpx;
  overflow: hidden;
  border: 1rpx solid var(--review-green);
  border-radius: 12rpx;
  background: #FFFFFF;
  color: var(--review-green-strong);
  font-size: 21rpx;
  font-weight: 700;
}

.queue-controls button::after,
.photo-nav button::after,
.photo-actions button::after,
.footer-actions button::after {
  border: 0;
}

.queue-controls button:active,
.photo-nav button:active,
.photo-actions button:active,
.footer-actions button:active {
  transform: scale(var(--tap-scale, .975));
  opacity: .9;
}

.review-card {
  padding: 20rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm, 0 5rpx 16rpx rgba(5, 5, 5, .055));
}

.review-tip {
  display: flex;
  align-items: center;
  gap: 13rpx;
  padding: 17rpx 18rpx;
  border-left: 5rpx solid var(--review-green);
  border-radius: 12rpx;
  background: var(--review-green-soft);
}

.review-tip.correction {
  border-left-color: var(--review-coral);
  background: var(--review-coral-soft);
}

.review-tip.correction .tip-title { color: var(--review-coral-strong); }
.review-tip.editing {
  border-left-color: var(--review-green);
  background: var(--review-green-soft);
}
.review-tip.editing .tip-title { color: var(--review-green-strong); }

.tip-title {
  flex: none;
  color: var(--review-green-strong);
  font-size: 25rpx;
  font-weight: 760;
}

.tip-copy {
  color: var(--text-secondary, #50545B);
  font-size: 20rpx;
  line-height: 1.5;
}

.workbench {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 16rpx;
}

.photo-pane,
.answer-pane {
  box-sizing: border-box;
  min-width: 0;
  padding: 16rpx;
  border: 1rpx solid var(--border, #DCE9ED);
  border-radius: 16rpx;
  background: var(--surface-muted, #F8FCFD);
}

.photo-pane { border-top: 5rpx solid var(--review-green-strong); }
.answer-pane { border-top: 5rpx solid var(--review-green); }

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  min-height: 66rpx;
}

.pane-title {
  display: block;
  color: var(--ink, #050505);
  font-size: 25rpx;
  font-weight: 750;
}

.pane-sub {
  display: block;
  margin-top: 3rpx;
  color: var(--text-muted, #50545B);
  font-size: 18rpx;
  line-height: 1.4;
}

.pane-count {
  flex: none;
  padding: 6rpx 10rpx;
  border-radius: 8rpx;
  background: var(--review-green-soft);
  color: var(--review-green-strong);
  font-size: 21rpx;
  font-weight: 700;
}

.photo-stage {
  height: 720rpx;
  box-sizing: border-box;
  margin-top: 12rpx;
  padding: 0;
  overflow: hidden;
  border: 1rpx solid #DCE9ED;
  border-radius: 14rpx;
  background: #F8FCFD;
}

.photo-stage.empty {
  height: 280rpx;
  min-height: 0;
}

.photo-frame,
.zoom-area,
.zoom-view {
  width: 100%;
  height: 100%;
}

.photo-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.zoom-area { overflow: hidden; }

.zoom-view {
  display: flex;
  align-items: center;
  justify-content: center;
}

.submission-photo {
  width: 100%;
  height: 100%;
  transition: transform var(--motion-base, 180ms) var(--ease-out, ease-out);
}

.pane-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  box-sizing: border-box;
  color: var(--text-muted, #50545B);
  font-size: 21rpx;
  text-align: center;
}

.pane-state.error { color: var(--danger, #F79BC0); }

.photo-nav {
  display: grid;
  grid-template-columns: 116rpx 1fr 116rpx;
  align-items: center;
  gap: 9rpx;
  margin-top: 12rpx;
}

.photo-nav text {
  color: var(--text-muted, #50545B);
  font-size: 19rpx;
  text-align: center;
}

.photo-nav button,
.photo-actions button {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 11rpx;
  background: #FFFFFF;
  color: var(--review-green-strong);
  font-size: 20rpx;
  font-weight: 700;
}

.photo-thumbs {
  width: 100%;
  margin-top: 10rpx;
  white-space: nowrap;
}

.photo-thumb-track {
  display: inline-flex;
  gap: 10rpx;
  padding: 2rpx;
}

.photo-thumb {
  position: relative;
  width: 104rpx;
  height: 104rpx;
  min-height: 104rpx;
  flex: 0 0 104rpx;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 3rpx solid transparent;
  border-radius: 11rpx;
  background: #FFFFFF;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), border-color var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.photo-thumb::after { border: 0; }
.photo-thumb:active { transform: scale(var(--tap-scale, .975)); }

.photo-thumb.active {
  border-color: var(--review-green);
  box-shadow: 0 0 0 3rpx rgba(153, 222, 244, .16);
}

.photo-thumb image {
  width: 100%;
  height: 100%;
}

.photo-thumb text {
  position: absolute;
  right: 5rpx;
  bottom: 5rpx;
  min-width: 28rpx;
  height: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4rpx;
  border-radius: 7rpx;
  background: rgba(5, 5, 5, .78);
  color: #FFFFFF;
  font-size: 17rpx;
  line-height: 1;
  box-sizing: border-box;
}

.photo-actions {
  display: flex;
  align-items: flex-start;
  gap: 10rpx;
  margin-top: 10rpx;
}

.photo-actions button {
  min-height: 88rpx;
  min-width: 0;
  flex: 1;
  margin: 0;
  padding: 0 12rpx;
  box-sizing: border-box;
  line-height: 1.2;
  white-space: nowrap;
}

.orientation-note {
  display: block;
  margin-top: 10rpx;
  color: var(--text-muted, #50545B);
  font-size: 18rpx;
  line-height: 1.45;
  text-align: center;
}

.answer-head { padding: 2rpx 0 12rpx; }

.answer-scroll {
  width: 100%;
  white-space: nowrap;
}

.answer-track {
  display: inline-flex;
  align-items: flex-start;
  gap: 12rpx;
  padding: 2rpx 4rpx 4rpx;
}

.answer-swipe-hint {
  display: block;
  margin-top: 10rpx;
  color: var(--text-muted, #50545B);
  font-size: 18rpx;
  text-align: center;
}

.wrong-count {
  flex: none;
  padding: 6rpx 10rpx;
  border-radius: 8rpx;
  background: var(--danger-soft, #FFF0F6);
  color: var(--danger, #B53A52);
  font-size: 20rpx;
  font-weight: 730;
}

.answer-row {
  box-sizing: border-box;
  width: 316rpx;
  height: auto !important;
  min-height: 0 !important;
  flex: 0 0 316rpx;
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin: 0;
  padding: 14rpx 16rpx !important;
  border: 2rpx solid var(--border, #DCE9ED);
  border-radius: 13rpx;
  background: #FFFFFF;
  text-align: left;
  white-space: normal;
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.answer-row::after { border: 0; }
.answer-row:active { transform: scale(var(--tap-scale, .975)); opacity: .92; }

.answer-row.wrong {
  border-color: var(--danger, #F79BC0);
  background: var(--danger-soft, #FFF0F6);
}

.answer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7rpx;
}

.answer-no {
  width: 42rpx;
  height: 42rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9rpx;
  background: var(--review-green-soft);
  color: var(--review-green-strong);
  font-size: 21rpx;
  font-weight: 760;
}

.answer-row.wrong .answer-no {
  background: var(--review-coral);
  color: #FFFFFF;
}

.answer-state {
  color: var(--review-green-strong);
  font-size: 18rpx;
  font-weight: 700;
}

.answer-row.wrong .answer-state { color: #B53A52; }

.answer-value {
  display: flex;
  margin-top: 8rpx;
  color: var(--ink, #050505);
  font-size: 28rpx;
  font-weight: 780;
}

.answer-stem {
  display: flex;
  margin-top: 6rpx;
  color: var(--text-muted, #50545B);
  font-size: 19rpx;
  line-height: 1.45;
}

.footer-actions {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 8;
  padding: 14rpx 22rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid var(--border, #DCE9ED);
  background: rgba(255, 255, 255, .98);
  box-shadow: 0 -10rpx 24rpx rgba(5, 5, 5, .08);
}

.footer-actions button {
  border-radius: 14rpx;
  font-size: 24rpx;
  font-weight: 750;
}

.save-only {
  width: 100%;
  background: var(--review-green-strong);
  color: #FFFFFF;
}

.edit-impact-note {
  margin-bottom: 10rpx;
  padding: 12rpx 15rpx;
  border-left: 5rpx solid var(--review-coral);
  border-radius: 10rpx;
  background: var(--review-coral-soft);
}

.edit-impact-title,
.edit-impact-copy {
  display: block;
}

.edit-impact-title {
  color: var(--review-coral-strong);
  font-size: 20rpx;
  font-weight: 760;
}

.edit-impact-copy {
  margin-top: 2rpx;
  color: #50545B;
  font-size: 18rpx;
  line-height: 1.45;
}

.review-save-actions.editing {
  display: grid;
  grid-template-columns: minmax(0, .8fr) minmax(0, 1.35fr);
  gap: 10rpx;
}

.cancel-edit {
  border: 1rpx solid #DCE9ED;
  background: #FFFFFF;
  color: var(--text-secondary, #50545B);
}

.revision-bar {
  min-height: 82rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 10rpx;
  padding: 10rpx 13rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 11rpx;
  background: var(--review-green-soft);
  box-sizing: border-box;
}

.revision-copy {
  min-width: 0;
  flex: 1;
}

.revision-title,
.revision-sub {
  display: block;
}

.revision-title {
  color: var(--review-green-strong);
  font-size: 20rpx;
  font-weight: 760;
}

.revision-sub {
  margin-top: 2rpx;
  color: var(--text-secondary, #50545B);
  font-size: 17rpx;
  line-height: 1.4;
}

.revision-button {
  min-height: 88rpx !important;
  flex: none;
  padding: 0 18rpx;
  border: 0;
  border-radius: 10rpx;
  background: var(--review-green-strong);
  color: #FFFFFF;
  font-size: 20rpx !important;
}

.revision-locked {
  flex: none;
  padding: 6rpx 10rpx;
  border-radius: 8rpx;
  background: #FFFFFF;
  color: var(--text-muted, #50545B);
  font-size: 18rpx;
  font-weight: 700;
}

.poster-guide {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  min-height: 54rpx;
  margin-bottom: 10rpx;
  padding: 0 4rpx;
}

.poster-guide-heading {
  display: flex;
  align-items: center;
  gap: 7rpx;
}

.poster-guide-label {
  flex: none;
  padding: 5rpx 9rpx;
  border: 1rpx solid #C7DDE4;
  border-radius: 7rpx;
  background: var(--review-green-soft);
  color: var(--review-green-strong);
  font-size: 18rpx;
  font-weight: 750;
}

.poster-guide-copy {
  color: var(--text-muted, #50545B);
  font-size: 19rpx;
  line-height: 1.4;
  text-align: right;
}

.poster-error-strip {
  min-height: 54rpx;
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;
  padding: 9rpx 14rpx;
  border: 1rpx solid #F2C8D5;
  border-radius: 10rpx;
  background: var(--danger-soft, #FFF0F6);
  color: #B53A52;
  font-size: 19rpx;
  line-height: 1.45;
}

.after-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
}

.after-btn.preview {
  border: 1rpx solid #C7DDE4;
  background: #FFFFFF;
  color: var(--review-green-strong);
}

.after-btn.album {
  border: 1rpx solid #C7DDE4;
  background: var(--review-green-soft);
  color: var(--review-green-strong);
}

.after-btn.next {
  background: var(--review-green-strong);
  color: #FFFFFF;
}

.footer-actions button[disabled],
.queue-error-strip button[disabled] {
  opacity: .48;
}

.poster-canvas {
  position: fixed;
  left: -10000px;
  top: 0;
  pointer-events: none;
}

@media (max-width: 380px) {
  .page { padding-left: 18rpx; padding-right: 18rpx; }
  .hero { padding-left: 28rpx; padding-right: 24rpx; }
  .queue-card { align-items: flex-start; flex-direction: column; }
  .queue-controls { width: 100%; max-width: 100%; flex-basis: auto; }
  .photo-pane,
  .answer-pane { padding: 12rpx; }
  .photo-stage { height: 620rpx; }
  .photo-nav { grid-template-columns: 108rpx 1fr 108rpx; }
  .answer-value { font-size: 26rpx; }
  .poster-guide { align-items: flex-start; flex-direction: column; gap: 6rpx; }
  .poster-guide-copy { text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  .submission-photo,
  .recent-item,
  .recent-toggle,
  .queue-controls button,
  .photo-nav button,
  .photo-thumb,
  .photo-actions button,
  .footer-actions button,
  .answer-row {
    transition: none;
  }

  .queue-controls button:active,
  .recent-item:active,
  .photo-nav button:active,
  .photo-thumb:active,
  .photo-actions button:active,
  .footer-actions button:active,
  .answer-row:active {
    transform: none;
    opacity: 1;
  }
}
</style>
