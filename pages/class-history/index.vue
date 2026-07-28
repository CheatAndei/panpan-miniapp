<template>
  <view class="page page-bottom-safe">
    <view class="archive-hero">
      <view class="hero-meta">
        <text class="eyebrow">CLASS ARCHIVE</text>
        <text v-if="data" class="record-chip num">{{ data.pagination.total }} 条记录</text>
      </view>
      <view class="hero-title-line">
        <pp-icon name="history" :size="36" motion="pop" />
        <text class="hero-title">{{ data?.class?.name || '学习小组历史' }}</text>
      </view>
      <text class="hero-sub">已发布的课程、反馈、清单、作业和打卡计划都保留在这里</text>
      <view class="hero-rule" aria-hidden="true"></view>
    </view>

    <view v-if="loading && !data" class="state-shell"><pp-state type="loading" title="正在整理历史记录" /></view>
    <view v-else-if="error && !data" class="state-shell">
      <pp-state type="error" title="历史记录加载失败" :description="error" action-text="重新加载" @action="loadHistory(true)" />
    </view>

    <template v-if="data">
      <view class="summary-block">
        <view class="block-heading">
          <view><text class="section-kicker">小组概览</text><text class="section-heading">记录一眼看清</text></view>
          <text class="section-caption">数据随发布自动归档</text>
        </view>
        <view class="summary-grid">
          <view class="summary-cell tone-neutral"><text class="summary-number num">{{ data.summary.student_count }}</text><text>当前学生</text></view>
          <view class="summary-cell tone-mint"><text class="summary-number num">{{ data.summary.feedback_count }}</text><text>课后反馈</text></view>
          <view class="summary-cell tone-practice"><text class="summary-number num">{{ data.summary.homework_count + data.summary.practice_count }}</text><text>练习任务</text></view>
        </view>
      </view>

      <view v-if="error" class="inline-error" role="alert">
        <view><text class="inline-error-title">部分记录刷新失败</text><text class="inline-error-copy">{{ error }}</text></view>
        <button :disabled="loading" @tap="loadHistory(true)">{{ loading ? '重试中…' : '重新加载' }}</button>
      </view>

      <view class="card student-card">
        <view class="student-heading">
          <view><text class="section-kicker">当前成员</text><text class="student-title">学习小组学生</text></view>
          <text class="section-note num">{{ data.students.length }} 人</text>
        </view>
        <view v-if="data.students.length" class="student-chips">
          <text v-for="student in data.students" :key="student.id" class="student-chip">{{ student.name }}</text>
        </view>
        <text v-else class="empty-copy">当前没有学生，历史记录仍会保留。</text>
      </view>

      <view class="history-head">
        <view><text class="history-kicker">按时间倒序</text><text class="history-title">已发布内容</text></view>
        <text class="history-total num">共 {{ data.pagination.total }} 条</text>
      </view>

      <view v-if="!items.length" class="state-shell compact">
        <pp-state title="还没有历史内容" description="发布课程、反馈或练习后会自动收录。" />
      </view>
      <view v-else class="history-stream">
        <view v-for="item in items" :key="item.id" class="history-item">
          <view :class="['history-mark',`type-${item.type}`]"><pp-icon :name="iconFor(item.type)" :size="32" /></view>
          <view class="history-copy">
            <view class="history-row"><text class="item-title">{{ item.title }}</text><text class="item-date num">{{ item.date }}</text></view>
            <text v-if="item.summary" class="item-summary">{{ item.summary }}</text>
            <view v-if="item.homework" class="homework-box"><text class="homework-label">专属清单</text><text>{{ item.homework }}</text></view>
            <button v-if="item.attachment_url" class="attachment-btn" @tap="openAttachment(item.attachment_url)">打开学习笔记 PDF</button>
          </view>
        </view>
      </view>

      <button v-if="data.pagination.page < data.pagination.pages" class="load-more" :disabled="loading" @tap="loadHistory(false)">
        {{ loading ? '加载中…' : '加载更多历史' }}
      </button>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const classId = ref(0);
const data = ref(null);
const items = ref([]);
const loading = ref(false);
const error = ref('');

onLoad((query) => { classId.value = Number(query.id || 0); loadHistory(true); });
onPullDownRefresh(async () => { try { await loadHistory(true); } finally { uni.stopPullDownRefresh(); } });

async function loadHistory(reset) {
  if (!classId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  const page = reset ? 1 : Number(data.value?.pagination?.page || 1) + 1;
  try {
    const result = await api.get(`/classes/${classId.value}/history?page=${page}&limit=30`);
    data.value = result;
    items.value = reset ? (result.timeline || []) : [...items.value, ...(result.timeline || [])];
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('classHistory.load', err);
  } finally { loading.value = false; }
}

function iconFor(type) {
  if (type === 'feedback') return 'message';
  if (type === 'session') return 'calendar';
  if (type === 'transfer') return 'users';
  return 'clipboard';
}

async function openAttachment(url) {
  try { await api.openPdf(url); }
  catch { uni.showToast({ title: 'PDF 打开失败', icon: 'none' }); }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  overflow-x: hidden;
  background: var(--page-bg, #F8FCF9);
}

.archive-hero {
  position: relative;
  margin: 24rpx 24rpx 0;
  padding: 34rpx 32rpx 30rpx;
  overflow: hidden;
  border: 1rpx solid #D7E7DE;
  border-left: 7rpx solid var(--primary, #20B486);
  border-radius: 16rpx;
  background:
    linear-gradient(rgba(32, 180, 134, .045) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(32, 180, 134, .045) 1rpx, transparent 1rpx),
    #FFFFFF;
  background-size: 38rpx 38rpx, 38rpx 38rpx, auto;
  box-shadow: var(--shadow-sm);
  animation: archive-enter var(--motion-slow, 240ms) var(--ease-out, ease-out) both;
}

.archive-hero::after {
  content: '';
  position: absolute;
  top: 18rpx;
  right: -18rpx;
  width: 116rpx;
  height: 20rpx;
  border-radius: 4rpx;
  background: var(--gold, #20B486);
  opacity: .7;
  transform: rotate(2deg);
}

.hero-meta,
.block-heading,
.student-heading,
.history-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
}

.eyebrow,
.section-kicker,
.history-kicker {
  display: block;
  color: var(--primary-strong, #15946D);
  font-size: 19rpx;
  font-weight: 760;
  letter-spacing: 0;
}

.record-chip {
  position: relative;
  z-index: 1;
  padding: 6rpx 12rpx;
  border: 1rpx solid #B8DDCD;
  border-radius: 8rpx;
  background: var(--warning-soft, #E7F8F1);
  color: #15946D;
  font-size: 18rpx;
  font-weight: 700;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  color: var(--ink, #26352F);
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1.28;
}

.hero-sub {
  display: block;
  max-width: 590rpx;
  margin-top: 9rpx;
  color: var(--text-secondary, #5A6A62);
  font-size: 23rpx;
  line-height: 1.55;
}

.hero-rule {
  width: 58rpx;
  height: 5rpx;
  margin-top: 22rpx;
  border-radius: 3rpx;
  background: var(--gold, #20B486);
}

.summary-block {
  margin: 30rpx 24rpx 0;
  animation: archive-enter var(--motion-slow, 240ms) 45ms var(--ease-out, ease-out) both;
}

.section-heading,
.student-title,
.history-title {
  display: block;
  margin-top: 4rpx;
  color: var(--ink, #26352F);
  font-size: 30rpx;
  font-weight: 780;
  line-height: 1.35;
}

.section-caption,
.section-note,
.history-total {
  flex: none;
  color: var(--text-muted, #5A6A62);
  font-size: 20rpx;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 15rpx;
}

.summary-cell {
  min-height: 118rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 15rpx 17rpx;
  border: 1rpx solid var(--border, #D7E7DE);
  border-top: 5rpx solid var(--primary, #20B486);
  border-radius: 14rpx;
  background: #FFFFFF;
  color: var(--text-muted, #5A6A62);
  font-size: 19rpx;
  box-sizing: border-box;
}

.summary-cell.tone-mint { border-top-color: var(--accent, #20B486); }
.summary-cell.tone-yellow { border-top-color: var(--gold, #20B486); }

.summary-number {
  display: block;
  margin-bottom: 2rpx;
  color: var(--ink, #26352F);
  font-size: 37rpx;
  font-weight: 820;
  line-height: 1.2;
}

.student-card {
  margin-top: 20rpx;
  padding: 25rpx 26rpx;
  border-radius: 16rpx;
  animation: archive-enter var(--motion-slow, 240ms) 80ms var(--ease-out, ease-out) both;
}

.student-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 17rpx;
}

.student-chip {
  padding: 9rpx 15rpx;
  border: 1rpx solid #B8DDCD;
  border-radius: 9rpx;
  background: var(--accent-soft, #E7F8F1);
  color: var(--accent-strong, #15946D);
  font-size: 22rpx;
  font-weight: 680;
}

.empty-copy {
  display: block;
  margin-top: 15rpx;
  color: var(--text-muted, #5A6A62);
  font-size: 22rpx;
}

.history-head {
  margin: 34rpx 28rpx 15rpx;
}

.history-stream {
  position: relative;
  padding-bottom: 2rpx;
}

.history-stream::before {
  content: '';
  position: absolute;
  top: 32rpx;
  bottom: 34rpx;
  left: 56rpx;
  width: 2rpx;
  background: repeating-linear-gradient(180deg, #D7E7DE 0 10rpx, transparent 10rpx 17rpx);
}

.history-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 15rpx;
  margin: 0 24rpx 14rpx;
  animation: history-enter var(--motion-slow, 240ms) var(--ease-out, ease-out) both;
}

.history-item:nth-child(2) { animation-delay: 35ms; }
.history-item:nth-child(3) { animation-delay: 70ms; }
.history-item:nth-child(n+4) { animation: none; }

.history-mark {
  z-index: 1;
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 5rpx solid var(--page-bg, #F8FCF9);
  border-radius: 16rpx;
  background: var(--primary-soft, #E7F8F1);
  color: var(--primary-strong, #15946D);
  box-sizing: border-box;
}

.history-mark.type-feedback {
  background: var(--accent-soft, #E7F8F1);
  color: var(--accent-strong, #15946D);
}

.history-mark.type-transfer {
  background: var(--warning-soft, #E7F8F1);
  color: #15946D;
}

.history-copy {
  min-width: 0;
  flex: 1;
  padding: 21rpx 22rpx;
  border: 1rpx solid var(--border, #D7E7DE);
  border-radius: 15rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.history-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14rpx;
}

.item-title {
  min-width: 0;
  color: var(--ink, #26352F);
  font-size: 26rpx;
  font-weight: 740;
  line-height: 1.4;
}

.item-date {
  flex: none;
  color: var(--text-muted, #5A6A62);
  font-size: 19rpx;
}

.item-summary {
  display: block;
  margin-top: 7rpx;
  color: var(--text-secondary, #5A6A62);
  font-size: 22rpx;
  line-height: 1.62;
  white-space: pre-wrap;
}

.homework-box {
  margin-top: 13rpx;
  padding: 14rpx 16rpx;
  border-left: 5rpx solid var(--gold, #20B486);
  border-radius: 9rpx;
  background: var(--warning-soft, #E7F8F1);
  color: #5A6A62;
  font-size: 22rpx;
  line-height: 1.6;
}

.homework-label {
  display: block;
  margin-bottom: 2rpx;
  color: #15946D;
  font-size: 18rpx;
  font-weight: 760;
}

.attachment-btn,
.load-more,
.inline-error button {
  transition: transform var(--motion-fast, 120ms) var(--ease-out, ease-out), opacity var(--motion-fast, 120ms) var(--ease-out, ease-out);
}

.attachment-btn {
  min-height: 88rpx;
  margin: 15rpx 0 0;
  padding: 0 22rpx;
  border-radius: 12rpx;
  background: var(--primary, #20B486);
  color: #FFFFFF;
  font-size: 22rpx;
  font-weight: 720;
}

.load-more {
  min-height: 88rpx;
  margin: 20rpx 24rpx 0;
  border: 1rpx solid #D7E7DE;
  border-radius: 13rpx;
  background: #FFFFFF;
  color: var(--primary-strong, #15946D);
  font-size: 24rpx;
  font-weight: 720;
}

.attachment-btn:active,
.load-more:active,
.inline-error button:active {
  transform: scale(var(--tap-scale, .975));
  opacity: .9;
}

.state-shell {
  margin: 24rpx;
  overflow: hidden;
  border: 1rpx solid var(--border, #D7E7DE);
  border-top: 5rpx solid var(--primary, #20B486);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}

.state-shell.compact { border-top-color: var(--accent, #20B486); }

.inline-error {
  min-height: 106rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin: 20rpx 24rpx 0;
  padding: 15rpx 18rpx;
  border: 1rpx solid #F2C4C0;
  border-left: 5rpx solid var(--danger, #D94B45);
  border-radius: 13rpx;
  background: var(--danger-soft, #FFF0EE);
  box-sizing: border-box;
}

.inline-error-title {
  display: block;
  color: #D94B45;
  font-size: 22rpx;
  font-weight: 740;
}

.inline-error-copy {
  display: block;
  margin-top: 2rpx;
  color: var(--text-secondary, #5A6A62);
  font-size: 19rpx;
}

.inline-error button {
  min-width: 128rpx;
  min-height: 88rpx;
  flex: none;
  margin: 0;
  border: 1rpx solid #F2C4C0;
  border-radius: 10rpx;
  background: #FFFFFF;
  color: #D94B45;
  font-size: 21rpx;
  font-weight: 700;
}

@keyframes archive-enter {
  from { transform: translateY(12rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes history-enter {
  from { transform: translateY(9rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 340px) {
  .archive-hero,
  .summary-block,
  .student-card,
  .state-shell,
  .inline-error,
  .history-item,
  .load-more {
    margin-right: 20rpx;
    margin-left: 20rpx;
  }

  .archive-hero { padding-right: 25rpx; padding-left: 26rpx; }
  .summary-cell { padding-right: 11rpx; padding-left: 11rpx; font-size: 18rpx; }
  .summary-number { font-size: 34rpx; }
  .section-caption { display: none; }
  .history-stream::before { left: 52rpx; }
  .history-mark { width: 62rpx; height: 62rpx; }
  .history-copy { padding-right: 17rpx; padding-left: 17rpx; }
  .history-row { flex-direction: column; gap: 3rpx; }
}

@media (prefers-reduced-motion: reduce) {
  .archive-hero,
  .summary-block,
  .student-card,
  .history-item,
  .attachment-btn,
  .load-more,
  .inline-error button {
    animation: none !important;
    transition-duration: .01ms !important;
  }

  .attachment-btn:active,
  .load-more:active,
  .inline-error button:active {
    transform: none;
  }
}

/* Teacher operations theme: bright learning studio v2. */
.page {
  --primary: #20B486;
  --primary-strong: #15946D;
  --primary-soft: #E7F8F1;
  --accent: #20B486;
  --accent-strong: #15946D;
  --accent-soft: #E7F8F1;
  --success: #15946D;
  --success-soft: #E7F8F1;
  --gold: #20B486;
  --gold-soft: #E7F8F1;
  --warning: #15946D;
  --warning-soft: #E7F8F1;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --danger-soft: #FFF0EE;
  --info: #20B486;
  --info-soft: #E7F8F1;
  --ink: #26352F;
  --text-secondary: #5A6A62;
  --text-muted: #5A6A62;
  --page-bg: #F8FCF9;
  --surface: #FFFFFF;
  --surface-muted: #F1F8F4;
  --border: #D7E7DE;
  --hairline: #E6F0EA;
  background-color: #F8FCF9;
  background-image: repeating-linear-gradient(0deg, transparent 0 63rpx, rgba(32, 180, 134, .035) 64rpx 65rpx);
}
.page {
  box-sizing: border-box;
  letter-spacing: 0;
}
.archive-hero {
  margin: 0;
  padding: 30rpx 28rpx 25rpx 36rpx;
  border: 0;
  border-bottom: 1rpx solid #D7E7DE;
  border-left: 8rpx solid #20B486;
  border-radius: 0;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(32, 180, 134, .045) 48rpx 49rpx),
    #FFFFFF;
  box-shadow: none;
}
.archive-hero::after {
  top: 0;
  right: 28rpx;
  width: 112rpx;
  height: 8rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: #20B486;
  opacity: 1;
  transform: none;
}
.hero-title-line {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 8rpx;
}
.eyebrow,
.section-kicker,
.history-kicker { color: #15946D; }
.hero-title,
.section-heading,
.student-title,
.history-title { color: #26352F; }
.hero-title { margin-top: 0; }
.hero-sub { color: #5A6A62; }
.record-chip {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.summary-grid {
  align-items: start;
}
.summary-cell {
  min-height: 0;
  padding: 14rpx 16rpx;
  border-color: #D7E7DE;
  border-top-color: #B8DDCD;
  border-radius: 12rpx;
  background: #FFFFFF;
  color: #5A6A62;
}
.summary-cell.tone-mint { border-top-color: #20B486; }
.summary-cell.tone-practice { border-top-color: #15946D; }
.summary-number { color: #26352F; }
.student-card {
  border: 1rpx solid #D7E7DE;
  border-left: 5rpx solid #20B486;
  border-radius: 14rpx;
  background: #FFFFFF;
}
.student-chip {
  border-color: #B8DDCD;
  background: #E7F8F1;
  color: #15946D;
}
.history-stream::before {
  background: repeating-linear-gradient(180deg, #B8DDCD 0 10rpx, transparent 10rpx 17rpx);
}
.history-item {
  align-items: flex-start;
}
.history-mark {
  border-color: #F8FCF9;
  border-radius: 14rpx;
  background: #E7F8F1;
  color: #15946D;
}
.history-mark.type-feedback {
  background: #E7F8F1;
  color: #15946D;
}
.history-mark.type-transfer {
  background: #E7F8F1;
  color: #15946D;
}
.history-copy {
  padding: 18rpx 19rpx;
  border-color: #D7E7DE;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 5rpx 15rpx rgba(38, 53, 47, .045);
}
.homework-box {
  border-left-color: #20B486;
  background: #E7F8F1;
}
.attachment-btn,
.load-more {
  height: 70rpx;
  min-height: 0;
  padding: 0 18rpx;
  line-height: 70rpx;
}
.attachment-btn {
  background: #20B486;
  color: #FFFFFF;
}
.load-more {
  border-color: #B8DDCD;
  background: #FFFFFF;
  color: #15946D;
}
.state-shell {
  border-color: #D7E7DE;
  border-top-color: #20B486;
  border-radius: 14rpx;
}
.state-shell.compact { border-top-color: #15946D; }
.inline-error {
  min-height: 0;
  align-items: flex-start;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: #FFF0EE;
}
.inline-error button {
  height: 58rpx;
  min-height: 0;
  padding: 0 15rpx;
  line-height: 58rpx;
}
</style>
