<template>
  <view class="page page-bottom-safe">
    <view class="page-hero">
      <text class="eyebrow">CLASS ARCHIVE</text>
      <text class="hero-title">{{ data?.class?.name || '学习小组历史' }}</text>
      <text class="hero-sub">已发布的课程、反馈、清单、作业和打卡计划都保留在这里</text>
    </view>

    <pp-state v-if="loading && !data" type="loading" title="正在整理历史记录" />
    <pp-state v-else-if="error && !data" type="error" title="历史记录加载失败" :description="error" action-text="重新加载" @action="loadHistory(true)" />

    <template v-if="data">
      <view class="summary-grid">
        <view class="summary-cell"><text class="summary-number num">{{ data.summary.student_count }}</text><text>当前学生</text></view>
        <view class="summary-cell"><text class="summary-number num">{{ data.summary.feedback_count }}</text><text>课后反馈</text></view>
        <view class="summary-cell"><text class="summary-number num">{{ data.summary.homework_count + data.summary.practice_count }}</text><text>练习任务</text></view>
      </view>

      <view class="card student-card">
        <view class="section-title"><text>当前学生</text><text class="section-note">{{ data.students.length }} 人</text></view>
        <view v-if="data.students.length" class="student-chips">
          <text v-for="student in data.students" :key="student.id" class="student-chip">{{ student.name }}</text>
        </view>
        <text v-else class="empty-copy">当前没有学生，历史记录仍会保留。</text>
      </view>

      <view class="history-head">
        <view><text class="history-kicker">按时间倒序</text><text class="history-title">已发布内容</text></view>
        <text class="history-total">共 {{ data.pagination.total }} 条</text>
      </view>

      <view v-if="!items.length" class="card"><pp-state title="还没有历史内容" description="发布课程、反馈或练习后会自动收录。" /></view>
      <view v-for="item in items" :key="item.id" class="history-item">
        <view :class="['history-mark',`type-${item.type}`]"><pp-icon :name="iconFor(item.type)" :size="34" /></view>
        <view class="history-copy">
          <view class="history-row"><text class="item-title">{{ item.title }}</text><text class="item-date num">{{ item.date }}</text></view>
          <text v-if="item.summary" class="item-summary">{{ item.summary }}</text>
          <view v-if="item.homework" class="homework-box"><text class="homework-label">专属清单</text><text>{{ item.homework }}</text></view>
          <button v-if="item.attachment_url" class="attachment-btn" @tap="openAttachment(item.attachment_url)">打开学习笔记 PDF</button>
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
.page{min-height:100vh;background:var(--bg)}.hero-title{display:block;margin-top:8rpx;color:var(--ink);font-size:43rpx;font-weight:780}.hero-sub{display:block;margin-top:8rpx;color:var(--text-muted);font-size:23rpx;line-height:1.5}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10rpx;margin:20rpx 24rpx}.summary-cell{min-height:112rpx;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1rpx solid var(--border);border-radius:18rpx;background:#fff;color:var(--text-muted);font-size:20rpx}.summary-number{display:block;margin-bottom:2rpx;color:var(--ink);font-size:36rpx;font-weight:800}.student-card{padding:24rpx}.student-card .section-title{display:flex;align-items:center;justify-content:space-between}.section-note{color:var(--text-muted);font-size:21rpx}.student-chips{display:flex;flex-wrap:wrap;gap:10rpx;margin-top:18rpx}.student-chip{padding:9rpx 15rpx;border-radius:10rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:22rpx;font-weight:650}.empty-copy{display:block;margin-top:16rpx;color:var(--text-muted);font-size:23rpx}.history-head{display:flex;align-items:flex-end;justify-content:space-between;margin:34rpx 28rpx 15rpx}.history-kicker{display:block;color:var(--accent-strong);font-size:20rpx;font-weight:750;letter-spacing:2rpx}.history-title{display:block;margin-top:3rpx;color:var(--ink);font-size:32rpx;font-weight:760}.history-total{color:var(--text-muted);font-size:21rpx}.history-item{display:flex;align-items:flex-start;gap:16rpx;margin:0 24rpx 14rpx;padding:24rpx;border:1rpx solid var(--border);border-radius:20rpx;background:#fff;box-shadow:var(--shadow-sm)}.history-mark{width:64rpx;height:64rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:18rpx;background:var(--accent-soft);color:var(--accent-strong)}.history-mark.type-transfer{background:#FFF2D8;color:#8C6108}.history-copy{flex:1;min-width:0}.history-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.item-title{color:var(--ink);font-size:27rpx;font-weight:720;line-height:1.4}.item-date{flex:none;color:var(--text-muted);font-size:20rpx}.item-summary{display:block;margin-top:7rpx;color:var(--text-secondary);font-size:23rpx;line-height:1.6;white-space:pre-wrap}.homework-box{margin-top:14rpx;padding:16rpx;border-left:5rpx solid #D4A746;border-radius:10rpx;background:#FFF9EA;color:#4C4535;font-size:23rpx;line-height:1.6}.homework-label{display:block;margin-bottom:3rpx;color:#956A18;font-size:19rpx;font-weight:750}.attachment-btn{min-height:68rpx;margin:14rpx 0 0;border-radius:12rpx;background:var(--primary);color:#fff;font-size:22rpx;font-weight:700}.attachment-btn::after{border:0}.load-more{min-height:82rpx;margin:20rpx 24rpx 0;border:1rpx solid var(--border);border-radius:15rpx;background:#fff;color:var(--accent-strong);font-size:25rpx;font-weight:700}.load-more::after{border:0}
</style>
