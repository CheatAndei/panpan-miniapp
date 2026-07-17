<template>
  <view class="page page-bottom-safe">
    <view class="page-hero growth-hero">
      <text class="eyebrow">GROWTH RECORD</text>
      <text class="hero-title">成长记录</text>
      <text class="hero-sub">看见坚持、进步和下一步重点</text>
    </view>

    <view class="section-nav" aria-label="家长端学习导航">
      <button class="nav-item" @tap="goToday">今日</button>
      <button class="nav-item" @tap="goLearning">学习</button>
      <button class="nav-item active" aria-current="page">成长</button>
    </view>

    <pp-state v-if="loading && !summary" type="loading" title="正在生成成长记录" />
    <pp-state v-else-if="error && !summary" type="error" title="成长记录加载失败" :description="error" action-text="重新加载" @action="loadSummary" />

    <template v-if="summary">
      <view class="streak-card">
        <view>
          <text class="streak-label">连续学习</text>
          <text class="streak-value"><text class="num">{{ summary.metrics.streak_days }}</text> 天</text>
          <text class="streak-copy">今天完成一项任务，就能延续学习节奏</text>
        </view>
        <view class="streak-seal">坚持</view>
      </view>

      <view class="card calendar-card">
        <view class="card-heading">
          <text class="card-title">近 14 天</text>
          <text class="card-note">有学习记录即点亮</text>
        </view>
        <view class="calendar-grid">
          <view v-for="day in summary.calendar" :key="day.date" :class="['day-dot',{on:day.completed,today:isToday(day.date)}]">
            <text>{{ day.day }}</text>
          </view>
        </view>
      </view>

      <view class="section-heading">
        <text class="section-kicker">本周概览</text>
        <text class="section-title">稳步积累的每一次</text>
      </view>
      <view class="metrics-grid">
        <view class="metric"><text class="metric-value num">{{ summary.metrics.active_days }}</text><text class="metric-label">学习天数</text></view>
        <view class="metric"><text class="metric-value num">{{ summary.metrics.completed_tasks }}</text><text class="metric-label">完成任务</text></view>
        <view class="metric"><text class="metric-value num">{{ accuracyLabel }}</text><text class="metric-label">综合正确率</text></view>
        <view class="metric"><text class="metric-value num">{{ summary.metrics.learning_minutes }}</text><text class="metric-label">自主练习分钟</text></view>
      </view>

      <view class="card wrong-card">
        <view class="card-heading">
          <text class="card-title">错题掌握</text>
          <text class="mastered"><text class="num">{{ summary.metrics.mastered_wrong_count }}</text> 道已掌握</text>
        </view>
        <view v-if="summary.weak_topics.length" class="topic-list">
          <view v-for="(topic,index) in summary.weak_topics" :key="topic.name" class="topic-row">
            <text class="topic-rank">0{{ index+1 }}</text>
            <text class="topic-name">{{ topic.name }}</text>
            <text class="topic-errors">本周错 {{ topic.errors }} 次</text>
          </view>
        </view>
        <view v-else class="empty-copy">本周还没有明显薄弱项，完成练习后会自动分析。</view>
        <button class="wrong-action" @tap="openWrong">去巩固错题</button>
      </view>

      <view class="section-heading badges-heading">
        <text class="section-kicker">成长徽章</text>
        <text class="section-title">把努力变成看得见的里程碑</text>
      </view>
      <view class="badges-grid">
        <view v-for="badge in summary.badges" :key="badge.code" :class="['badge-card',{unlocked:badge.unlocked}]">
          <view class="badge-mark">{{ badge.unlocked ? '✓' : '·' }}</view>
          <text class="badge-title">{{ badge.title }}</text>
          <text class="badge-desc">{{ badge.description }}</text>
        </view>
      </view>

      <view class="card report-card">
        <view class="report-label">本周学习周报</view>
        <text class="report-title">{{ summary.report.sufficient ? '这一周，进步有迹可循' : '完成第一次学习后生成' }}</text>
        <text class="report-copy">{{ summary.report.summary }}</text>
      </view>

      <view class="share-card">
        <text class="share-eyebrow">{{ summary.share.title }}</text>
        <text class="share-title">{{ summary.share.subtitle }}</text>
        <text class="share-note">匿名分享，不展示孩子姓名、题目或班级</text>
        <button class="share-btn" open-type="share">分享成长卡</button>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh, onShareAppMessage, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref(0);
const summary = ref(null);
const loading = ref(false);
const error = ref('');
const accuracyLabel = computed(() => summary.value?.metrics?.accuracy === null ? '—' : `${summary.value.metrics.accuracy}%`);

onLoad((query) => { studentId.value = Number(query.student_id || uni.getStorageSync('activeChildId') || 0); });
onShow(() => { if (studentId.value) loadSummary(); });
onPullDownRefresh(async () => { try { await loadSummary(); } finally { uni.stopPullDownRefresh(); } });
onShareAppMessage(() => ({
  title: summary.value?.share?.subtitle ? `本周学习成长卡｜${summary.value.share.subtitle}` : '番番记录 · 学习成长卡',
  path: '/pages/index/index',
}));

async function loadSummary() {
  if (!studentId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try { summary.value = await api.get(`/growth/summary?student_id=${studentId.value}`); }
  catch (e) { error.value = e?.error || '请检查网络后重试'; logError('growth.summary', e); }
  finally { loading.value = false; }
}
function localDateKey() { const d = new Date(); const p = (v) => String(v).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function isToday(date) { return date === localDateKey(); }
function goToday() { uni.switchTab({ url: '/pages/index/index' }); }
function goLearning() { uni.navigateTo({ url: `/pages/learning-center/index?student_id=${studentId.value}` }); }
function openWrong() { uni.navigateTo({ url: `/pages/learning-session/index?student_id=${studentId.value}&type=wrong` }); }
</script>

<style scoped>
.growth-hero{padding-bottom:44rpx}.hero-title{display:block;margin-top:8rpx;color:var(--ink);font-size:44rpx;font-weight:780;letter-spacing:-1rpx}.hero-sub{display:block;margin-top:8rpx;color:var(--text-secondary);font-size:25rpx}.section-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin:20rpx 24rpx 0;padding:8rpx;border:1rpx solid var(--border);border-radius:18rpx;background:#fff}.nav-item{min-height:78rpx;border-radius:13rpx;background:transparent;color:var(--text-muted);font-size:27rpx;font-weight:650}.nav-item.active{background:var(--primary);color:#fff;box-shadow:0 7rpx 18rpx rgba(24,58,54,.14)}.streak-card{display:flex;align-items:center;justify-content:space-between;margin:20rpx 24rpx 0;padding:32rpx;border-radius:26rpx;background:linear-gradient(140deg,#183A36,#2F6E61);color:#fff;box-shadow:0 18rpx 40rpx rgba(24,58,54,.16)}.streak-label{display:block;color:#B8DDD3;font-size:21rpx;font-weight:750;letter-spacing:2rpx}.streak-value{display:block;margin-top:2rpx;font-size:30rpx;font-weight:700}.streak-value .num{font-size:62rpx;font-weight:820;line-height:1.1}.streak-copy{display:block;margin-top:7rpx;color:#D7EBE5;font-size:22rpx}.streak-seal{width:96rpx;height:96rpx;display:flex;align-items:center;justify-content:center;border:2rpx solid rgba(255,255,255,.45);border-radius:50%;color:#fff;font-size:24rpx;font-weight:780;letter-spacing:3rpx}.calendar-card{padding-bottom:26rpx}.card-heading{display:flex;align-items:center;justify-content:space-between}.card-title{font-size:29rpx;font-weight:740}.card-note{color:var(--text-muted);font-size:21rpx}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:14rpx 10rpx;margin-top:22rpx}.day-dot{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--surface-muted);color:var(--faint);font-size:21rpx}.day-dot.on{background:var(--accent);color:#fff;font-weight:750;box-shadow:0 5rpx 12rpx rgba(47,125,107,.18)}.day-dot.today{outline:3rpx solid #A9CEC4;outline-offset:3rpx}.section-heading{margin:40rpx 28rpx 16rpx}.section-kicker{display:block;color:var(--accent-strong);font-size:20rpx;font-weight:750;letter-spacing:2rpx}.section-title{display:block;margin-top:3rpx;font-size:32rpx;font-weight:760}.metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin:0 24rpx}.metric{min-height:140rpx;padding:22rpx;border:1rpx solid var(--border);border-radius:20rpx;background:#fff;box-shadow:var(--shadow-sm)}.metric-value{display:block;color:var(--ink);font-size:42rpx;font-weight:790}.metric-label{display:block;margin-top:2rpx;color:var(--text-muted);font-size:22rpx}.mastered{color:var(--accent-strong);font-size:23rpx;font-weight:700}.mastered .num{font-size:30rpx}.topic-list{margin-top:18rpx}.topic-row{display:flex;align-items:center;gap:14rpx;min-height:72rpx;border-bottom:1rpx solid var(--hairline)}.topic-rank{color:#A8B6B2;font-size:20rpx;font-weight:780}.topic-name{flex:1;color:var(--ink);font-size:26rpx;font-weight:650}.topic-errors{color:var(--warning);font-size:21rpx}.empty-copy{padding:30rpx 0;color:var(--text-muted);font-size:24rpx;line-height:1.65;text-align:center}.wrong-action{min-height:82rpx;margin-top:20rpx;border-radius:14rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:26rpx;font-weight:720}.badges-heading{margin-top:44rpx}.badges-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12rpx;margin:0 24rpx}.badge-card{min-height:190rpx;padding:18rpx 12rpx;border:1rpx dashed #C9D5D1;border-radius:18rpx;background:#F4F7F6;text-align:center;opacity:.66}.badge-card.unlocked{border-style:solid;border-color:#BFD7D0;background:#fff;opacity:1;box-shadow:var(--shadow-sm)}.badge-mark{width:54rpx;height:54rpx;margin:0 auto 10rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#E2E9E6;color:#8A9994;font-size:28rpx;font-weight:800}.unlocked .badge-mark{background:var(--accent);color:#fff}.badge-title{display:block;color:var(--ink);font-size:23rpx;font-weight:720}.badge-desc{display:block;margin-top:5rpx;color:var(--text-muted);font-size:19rpx;line-height:1.45}.report-card{margin-top:36rpx;background:linear-gradient(145deg,#FFFFFF,#F3F8F6)}.report-label{color:var(--accent-strong);font-size:20rpx;font-weight:760;letter-spacing:2rpx}.report-title{display:block;margin-top:8rpx;color:var(--ink);font-size:31rpx;font-weight:760}.report-copy{display:block;margin-top:12rpx;color:var(--text-secondary);font-size:25rpx;line-height:1.8}.share-card{margin:22rpx 24rpx 0;padding:32rpx;border-radius:24rpx;background:#183A36;color:#fff}.share-eyebrow{display:block;color:#A8D2C6;font-size:20rpx;font-weight:750;letter-spacing:2rpx}.share-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:760}.share-note{display:block;margin-top:7rpx;color:#CFE4DE;font-size:22rpx}.share-btn{min-height:84rpx;margin-top:24rpx;border-radius:14rpx;background:#fff;color:#183A36;font-size:26rpx;font-weight:720}
</style>
