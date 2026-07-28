<template>
  <view class="page">
    <view class="hero hero-navy">
      <view class="eyebrow">作业批改</view>
      <view class="hero-title">{{ child ? child.name : '学习记录' }}</view>
      <view class="hero-sub">积分余额 {{ pointBalance }}</view>
    </view>

    <pp-state v-if="loading && batches.length===0" type="loading" title="正在读取批改记录" />
    <pp-state v-else-if="error && batches.length===0" type="error" title="暂时无法加载" :description="error" action-text="重新加载" @action="loadData" />
    <pp-state v-else-if="!loading && batches.length===0" title="还没有作业批改" description="老师发布后会显示在这里。" />

    <view v-for="item in batches" :key="item.id" class="card batch-card" @tap="openBatch(item.id)">
      <view class="batch-top">
        <view>
          <text class="batch-title">{{ item.title }}</text>
          <text class="batch-meta">{{ item.assigned_date }} · {{ item.subject || '作业' }}</text>
        </view>
        <view class="score-pill">{{ item.correct_count }}/{{ item.question_count }}</view>
      </view>
      <view class="batch-foot">
        <text>本次积分 {{ signed(item.points_delta) }}</text>
        <text class="detail-link">查看逐题结果 ›</text>
      </view>
    </view>

    <view v-if="detail" class="modal-mask" @tap="detail=null">
      <view class="modal" @tap.stop>
        <view class="modal-head">
          <view>
            <text class="modal-title">{{ detail.title }}</text>
            <text class="modal-sub">{{ detail.assigned_date }} · 本次积分 {{ signed(detail.points_delta) }}</text>
          </view>
          <text class="close" @tap="detail=null">关闭</text>
        </view>
        <scroll-view scroll-y class="detail-scroll">
          <view v-if="detail.overall_comment" class="summary">{{ detail.overall_comment }}</view>
          <view v-for="answer in detail.answers" :key="answer.question_no" class="answer-card">
            <view class="answer-head">
              <text class="question-no">第 {{ answer.question_no }} 题</text>
              <text :class="['answer-status',answer.is_correct?'correct':'wrong']">{{ answer.is_correct ? '正确' : '需要订正' }}</text>
            </view>
            <image v-if="questionImageSource(answer)" :src="questionImageSource(answer)" mode="widthFix" class="question-image" @tap="preview(answer)" />
            <view class="answer-line"><text class="label">学生答案</text><text>{{ answer.student_answer || '未填写' }}</text></view>
            <view v-if="!answer.is_correct && answer.wrong_step" class="answer-line"><text class="label">错误步骤</text><text>{{ answer.wrong_step }}</text></view>
            <view v-if="!answer.is_correct && answer.error_type" class="answer-line"><text class="label">错误类型</text><text>{{ answer.error_type }}</text></view>
            <view v-if="answer.comment" class="comment">{{ answer.comment }}</view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const child = ref(null);
const batches = ref([]);
const pointBalance = ref(0);
const loading = ref(false);
const error = ref('');
const detail = ref(null);
const requestedBatchId = ref('');

function signed(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

async function loadData() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const kids = await api.get('/bind/students');
    const list = kids.students || [];
    const savedId = String(uni.getStorageSync('activeChildId') || '');
    child.value = list.find(item => String(item.id) === savedId) || list[0] || null;
    if (!child.value) {
      batches.value = [];
      return;
    }
    const result = await api.get('/homework/parent?student_id=' + child.value.id);
    batches.value = result.batches || [];
    pointBalance.value = Number(result.point_balance || 0);
    if (requestedBatchId.value) {
      await openBatch(requestedBatchId.value);
      requestedBatchId.value = '';
    }
  } catch (err) {
    logError('parentHomework.loadData', err);
    error.value = err?.error || '请检查网络后重试';
  } finally {
    loading.value = false;
  }
}

async function openBatch(batchId) {
  if (!child.value) return;
  try {
    const result = await api.get(`/homework/parent/${batchId}?student_id=${child.value.id}`);
    detail.value = result.submission || null;
    if (detail.value) {
      await Promise.all((detail.value.answers || []).map(async (answer) => {
        if (!isPrivateUrl(answer.question_image_url)) return;
        try { answer.local_image_path = await api.downloadPrivate(answer.question_image_url); }
        catch (err) { logError('parentHomework.downloadPrivate', err); }
      }));
    }
  } catch (err) {
    uni.showToast({ title: err?.error || '加载失败', icon: 'none' });
  }
}

function isPrivateUrl(url) {
  return /^\/api\/private-files\/[a-f0-9]{32}$/.test(String(url || ''));
}

function questionImageSource(answer) {
  if (!answer?.question_image_url) return '';
  if (isPrivateUrl(answer.question_image_url)) return answer.local_image_path || '';
  return api.assetUrl(answer.question_image_url);
}

function preview(answer) {
  const url = questionImageSource(answer);
  if (url) uni.previewImage({ current: url, urls: [url] });
}

onLoad((query) => {
  if (query?.student_id) uni.setStorageSync('activeChildId', query.student_id);
  requestedBatchId.value = String(query?.batch_id || '');
  loadData();
});

onPullDownRefresh(async () => {
  try { await loadData(); } finally { uni.stopPullDownRefresh(); }
});
</script>

<style scoped>
.page { min-height: 100vh; box-sizing: border-box; padding: 24rpx 24rpx 60rpx; background: var(--page-bg); }

.hero {
  position: relative;
  margin-bottom: 22rpx;
  padding: 40rpx 32rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  animation: homework-enter var(--motion-slow) var(--ease-out) both;
}

.hero::after {
  content: '';
  position: absolute;
  right: 28rpx;
  top: 28rpx;
  width: 50rpx;
  height: 66rpx;
  border: 4rpx solid rgba(82, 124, 201, .22);
  border-radius: 8rpx;
  box-shadow: -10rpx 10rpx 0 rgba(244, 199, 91, .25);
}

.eyebrow { color: var(--primary-strong); font-size: 23rpx; font-weight: 680; }
.hero-title { margin-top: 8rpx; color: var(--ink); font-size: 40rpx; font-weight: 760; }
.hero-sub { margin-top: 8rpx; color: var(--text-muted); font-size: 25rpx; }

.batch-card {
  padding: 26rpx;
  animation: homework-card-enter var(--motion-slow) var(--ease-out) both;
  transition: transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}

.batch-card:active { transform: scale(var(--tap-scale)); box-shadow: none; }
.batch-top,
.batch-foot,
.answer-head,
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.batch-title { display: block; color: var(--ink); font-size: 30rpx; font-weight: 720; }
.batch-meta { display: block; margin-top: 5rpx; color: var(--text-muted); font-size: 23rpx; }
.score-pill { flex: none; padding: 8rpx 16rpx; border-radius: var(--r-xs); background: var(--success-soft); color: var(--success); font-weight: 720; }
.batch-foot { margin-top: 20rpx; padding-top: 18rpx; border-top: 1rpx solid var(--hairline); color: var(--text-muted); font-size: 24rpx; }
.detail-link { color: var(--primary-strong); font-weight: 650; }

.modal-mask { position: fixed; inset: 0; z-index: 99; display: flex; align-items: flex-end; background: rgba(36, 50, 74, .44); animation: homework-mask-in var(--motion-base) ease-out both; }
.modal { width: 100%; max-height: 90vh; box-sizing: border-box; padding: 30rpx 26rpx calc(24rpx + env(safe-area-inset-bottom)); border-radius: 30rpx 30rpx 0 0; background: var(--surface); box-shadow: var(--shadow-lg); animation: homework-sheet-in var(--motion-slow) var(--ease-out) both; }
.modal-head { align-items: flex-start; }
.modal-title { display: block; color: var(--ink); font-size: 32rpx; font-weight: 740; }
.modal-sub { display: block; margin-top: 5rpx; color: var(--text-muted); font-size: 23rpx; }
.close { min-height: 64rpx; display: flex; align-items: center; color: var(--primary-strong); font-size: 25rpx; font-weight: 650; }
.detail-scroll { max-height: 72vh; margin-top: 22rpx; }
.summary { margin-bottom: 16rpx; padding: 20rpx; border-left: 6rpx solid var(--primary); border-radius: var(--r-sm); background: var(--primary-soft); color: var(--text-secondary); font-size: 26rpx; line-height: 1.7; }
.answer-card { margin-bottom: 16rpx; padding: 22rpx; border: 1rpx solid var(--hairline); border-radius: var(--r-sm); background: var(--surface); }
.question-no { color: var(--ink); font-size: 28rpx; font-weight: 700; }
.answer-status { padding: 5rpx 12rpx; border-radius: var(--r-xs); font-size: 22rpx; font-weight: 650; }
.answer-status.correct { color: var(--success); background: var(--success-soft); }
.answer-status.wrong { color: var(--danger); background: var(--danger-soft); }
.question-image { width: 100%; margin-top: 16rpx; border: 1rpx solid var(--hairline); border-radius: var(--r-sm); background: var(--surface-muted); }
.answer-line { display: flex; gap: 16rpx; margin-top: 14rpx; color: var(--text-secondary); font-size: 25rpx; line-height: 1.6; }
.label { flex-shrink: 0; color: var(--text-muted); }
.comment { margin-top: 16rpx; padding: 16rpx; border-radius: var(--r-sm); background: var(--warning-soft); color: var(--warning); font-size: 25rpx; line-height: 1.6; }

@keyframes homework-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes homework-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes homework-mask-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes homework-sheet-in {
  from { opacity: .4; transform: translateY(34rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .batch-card,
  .modal-mask,
  .modal { animation: none; }
  .batch-card { transition: none; }
}
</style>
