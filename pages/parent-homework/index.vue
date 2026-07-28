<template>
  <view class="page">
    <view class="hero hero-navy">
      <view class="eyebrow">作业批改</view>
      <view class="hero-title-row">
        <view class="title-icon tone-green"><pp-icon name="clipboard" :size="34" motion="pop" /></view>
        <view class="hero-title">{{ child ? child.name : '学习记录' }}</view>
      </view>
      <view class="hero-sub"><pp-icon name="trophy" :size="24" /><text>积分余额 {{ pointBalance }}</text></view>
    </view>

    <pp-state v-if="loading && batches.length===0" type="loading" title="正在读取批改记录" />
    <pp-state v-else-if="error && batches.length===0" type="error" title="暂时无法加载" :description="error" action-text="重新加载" @action="loadData" />
    <pp-state v-else-if="!loading && batches.length===0" title="还没有作业批改" description="老师发布后会显示在这里。" />

    <view v-for="item in batches" :key="item.id" class="card batch-card" @tap="openBatch(item.id)">
      <view class="batch-top">
        <view>
          <view class="batch-title"><pp-icon name="book" :size="28" /><text>{{ item.title }}</text></view>
          <text class="batch-meta">{{ item.assigned_date }} · {{ item.subject || '作业' }}</text>
        </view>
        <view class="score-pill"><pp-icon name="check" :size="22" /><text>{{ item.correct_count }}/{{ item.question_count }}</text></view>
      </view>
      <view class="batch-foot">
        <text>本次积分 {{ signed(item.points_delta) }}</text>
        <view class="detail-link"><text>查看逐题结果</text><pp-icon name="arrow" :size="24" /></view>
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
              <view :class="['answer-status',answer.is_correct?'correct':'wrong']"><pp-icon :name="answer.is_correct?'check':'pencil'" :size="22" /><text>{{ answer.is_correct ? '正确' : '需要订正' }}</text></view>
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
.page {
  --panpan-green: #527CC9;
  --panpan-green-strong: #315EA8;
  --panpan-sprout: #527CC9;
  --panpan-coral: #E98577;
  --panpan-leaf: #315EA8;
  --panpan-paper: #F6FAFF;
  --panpan-ink: #24324A;
  --panpan-muted: #5C6C84;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 18rpx 24rpx 54rpx;
  background: var(--panpan-paper);
}

.hero {
  margin-bottom: 18rpx;
  padding: 30rpx 28rpx;
  border: 1rpx solid #D9E5F3;
  border-top: 7rpx solid var(--panpan-sprout);
  border-radius: 16rpx;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(82, 124, 201, .05) 48rpx 49rpx),
    #FFFFFF;
  box-shadow: 0 9rpx 22rpx rgba(36, 50, 74, .06);
  animation: homework-enter var(--motion-slow) var(--ease-out) both;
}

.eyebrow { display: inline-flex; padding: 5rpx 12rpx; border-radius: 7rpx; background: #EAF2FF; color: var(--panpan-green-strong); font-size: 21rpx; font-weight: 700; letter-spacing: 0; }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #EAF2FF; }
.hero-title { color: var(--panpan-ink); font-size: 39rpx; font-weight: 770; }
.hero-sub { display: flex; align-items: center; gap: 7rpx; margin-top: 7rpx; color: #315EA8; font-size: 24rpx; font-weight: 650; }

.batch-card {
  margin-bottom: 14rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid #D9E5F3;
  border-left: 6rpx solid var(--panpan-green);
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(36, 50, 74, .06);
  animation: homework-card-enter var(--motion-slow) var(--ease-out) both;
  transition: transform var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}

.batch-card:active { transform: scale(var(--tap-scale)); box-shadow: none; }
.batch-top,
.batch-foot,
.answer-head,
.modal-head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.batch-title { display: flex; align-items: center; gap: 8rpx; color: var(--panpan-ink); font-size: 30rpx; font-weight: 720; }
.batch-meta { display: block; margin-top: 5rpx; color: var(--panpan-muted); font-size: 23rpx; }
.score-pill { display: flex; align-items: center; gap: 5rpx; flex: none; padding: 7rpx 14rpx; border: 1rpx solid rgba(82, 124, 201, .24); border-radius: 8rpx; background: #EAF2FF; color: #315EA8; font-weight: 720; }
.batch-foot { margin-top: 17rpx; padding-top: 15rpx; border-top: 1rpx solid #E9F0F8; color: var(--panpan-muted); font-size: 23rpx; }
.batch-foot text:first-child { color: #315EA8; font-weight: 650; }
.detail-link { display: flex; align-items: center; gap: 4rpx; color: var(--panpan-green-strong); font-weight: 680; }

.modal-mask { position: fixed; inset: 0; z-index: 99; display: flex; align-items: flex-end; background: rgba(36, 50, 74, .42); animation: homework-mask-in var(--motion-base) ease-out both; }
.modal { width: 100%; max-height: 90vh; box-sizing: border-box; padding: 26rpx 24rpx calc(22rpx + env(safe-area-inset-bottom)); border-radius: 16rpx 16rpx 0 0; background: #FFFFFF; box-shadow: 0 -12rpx 30rpx rgba(36, 50, 74, .1); animation: homework-sheet-in var(--motion-slow) var(--ease-out) both; }
.modal-head { align-items: flex-start; }
.modal-title { display: block; color: var(--panpan-ink); font-size: 31rpx; font-weight: 740; }
.modal-sub { display: block; margin-top: 5rpx; color: var(--panpan-muted); font-size: 22rpx; }
.close { min-height: 58rpx; display: flex; align-items: center; color: var(--panpan-green-strong); font-size: 24rpx; font-weight: 680; }
.detail-scroll { max-height: 72vh; margin-top: 19rpx; }
.summary { margin-bottom: 14rpx; padding: 17rpx; border: 1rpx solid rgba(82, 124, 201, .22); border-left: 6rpx solid var(--panpan-green); border-radius: 10rpx; background: #EAF2FF; color: #5C6C84; font-size: 25rpx; line-height: 1.66; }
.answer-card { margin-bottom: 0; padding: 19rpx 0; border-bottom: 1rpx solid #E9F0F8; border-radius: 0; background: transparent; }
.question-no { color: var(--panpan-ink); font-size: 27rpx; font-weight: 700; }
.answer-status { display: flex; align-items: center; gap: 5rpx; padding: 5rpx 11rpx; border-radius: 8rpx; font-size: 21rpx; font-weight: 680; }
.answer-status.correct { color: var(--panpan-green-strong); background: #EAF2FF; }
.answer-status.wrong { color: #D66D62; background: #FFF0ED; }
.question-image { width: 100%; margin-top: 14rpx; border: 1rpx solid #DDE7F2; border-radius: 10rpx; background: var(--panpan-paper); }
.answer-line { display: flex; gap: 14rpx; margin-top: 12rpx; color: #5C6C84; font-size: 24rpx; line-height: 1.58; }
.label { flex-shrink: 0; color: var(--panpan-muted); }
.comment { margin-top: 14rpx; padding: 14rpx; border-left: 5rpx solid var(--panpan-coral); border-radius: 9rpx; background: #FFF0ED; color: #D66D62; font-size: 24rpx; line-height: 1.58; }

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
