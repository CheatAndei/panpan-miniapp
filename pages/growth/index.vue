<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="page-hero growth-hero">
      <view class="hero-mark"><pp-icon name="target" :size="42" motion="bob" :delay="80" /></view>
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
        <view class="streak-main">
          <view class="streak-icon"><pp-icon name="trophy" :size="36" motion="shine" :delay="180" /></view>
          <view>
            <text class="streak-label">连续学习</text>
            <text class="streak-value"><text class="num">{{ summary.metrics.streak_days }}</text> 天</text>
            <text class="streak-copy">今天完成一项任务，就能延续学习节奏</text>
          </view>
        </view>
        <view class="streak-seal">坚持</view>
      </view>

      <view class="card calendar-card">
        <view class="card-heading">
          <view class="card-title-row"><pp-icon name="calendar" :size="30" motion="pop" :delay="260" /><text class="card-title">近 14 天</text></view>
          <text class="card-note">有学习记录即点亮</text>
        </view>
        <view class="calendar-grid">
          <view v-for="day in summary.calendar" :key="day.date" :class="['day-dot',{on:day.completed,today:isToday(day.date)}]">
            <text>{{ day.day }}</text>
          </view>
        </view>
      </view>

      <view class="section-heading">
        <view class="section-title-row"><pp-icon name="report" :size="30" motion="pop" :delay="340" /><view><text class="section-kicker">本周概览</text><text class="section-title">稳步积累的每一次</text></view></view>
      </view>
      <view class="metrics-grid">
        <view class="metric"><pp-icon name="calendar" :size="28" /><text class="metric-value num">{{ summary.metrics.active_days }}</text><text class="metric-label">学习天数</text></view>
        <view class="metric"><pp-icon name="check" :size="28" /><text class="metric-value num">{{ summary.metrics.completed_tasks }}</text><text class="metric-label">完成任务</text></view>
        <view class="metric"><pp-icon name="target" :size="28" /><text class="metric-value num">{{ accuracyLabel }}</text><text class="metric-label">综合正确率</text></view>
        <view class="metric"><pp-icon name="history" :size="28" /><text class="metric-value num">{{ summary.metrics.learning_minutes }}</text><text class="metric-label">自主练习分钟</text></view>
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
        <view class="section-title-row"><pp-icon name="trophy" :size="30" motion="ring" :delay="420" /><view><text class="section-kicker">成长徽章</text><text class="section-title">把努力变成看得见的里程碑</text></view></view>
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
        <button class="achievement-btn" @tap="openAchievements">生成真实成就海报</button>
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
function openAchievements() { uni.navigateTo({ url: `/pages/achievements/index?student_id=${studentId.value}` }); }
</script>

<style scoped>
.growth-hero{padding-bottom:44rpx}.hero-title{display:block;margin-top:8rpx;color:var(--ink);font-size:44rpx;font-weight:780;letter-spacing: 0}.hero-sub{display:block;margin-top:8rpx;color:var(--text-secondary);font-size:25rpx}.section-nav{display:grid;grid-template-columns:repeat(3,1fr);gap:8rpx;margin:20rpx 24rpx 0;padding:8rpx;border:1rpx solid var(--border);border-radius:18rpx;background:#fff}.nav-item{min-height:78rpx;border-radius:13rpx;background:transparent;color:var(--text-muted);font-size:27rpx;font-weight:650}.nav-item.active{background:var(--primary);color:#fff;box-shadow:0 7rpx 18rpx rgba(24,58,54,.14)}.streak-card{display:flex;align-items:center;justify-content:space-between;margin:20rpx 24rpx 0;padding:32rpx;border-radius:26rpx;background:#FFFFFF;color:#fff;box-shadow:0 18rpx 40rpx rgba(24,58,54,.16)}.streak-label{display:block;color:#B8DDD3;font-size:21rpx;font-weight:750;letter-spacing: 0}.streak-value{display:block;margin-top:2rpx;font-size:30rpx;font-weight:700}.streak-value .num{font-size:62rpx;font-weight:820;line-height:1.1}.streak-copy{display:block;margin-top:7rpx;color:#D7EBE5;font-size:22rpx}.streak-seal{width:96rpx;height:96rpx;display:flex;align-items:center;justify-content:center;border:2rpx solid rgba(255,255,255,.45);border-radius:50%;color:#fff;font-size:24rpx;font-weight:780;letter-spacing: 0}.calendar-card{padding-bottom:26rpx}.card-heading{display:flex;align-items:center;justify-content:space-between}.card-title{font-size:29rpx;font-weight:740}.card-note{color:var(--text-muted);font-size:21rpx}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:14rpx 10rpx;margin-top:22rpx}.day-dot{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--surface-muted);color:var(--faint);font-size:21rpx}.day-dot.on{background:var(--accent);color:#fff;font-weight:750;box-shadow:0 5rpx 12rpx rgba(47,125,107,.18)}.day-dot.today{outline:3rpx solid #A9CEC4;outline-offset:3rpx}.section-heading{margin:40rpx 28rpx 16rpx}.section-kicker{display:block;color:var(--accent-strong);font-size:20rpx;font-weight:750;letter-spacing: 0}.section-title{display:block;margin-top:3rpx;font-size:32rpx;font-weight:760}.metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin:0 24rpx}.metric{min-height:140rpx;padding:22rpx;border:1rpx solid var(--border);border-radius:20rpx;background:#fff;box-shadow:var(--shadow-sm)}.metric-value{display:block;color:var(--ink);font-size:42rpx;font-weight:790}.metric-label{display:block;margin-top:2rpx;color:var(--text-muted);font-size:22rpx}.mastered{color:var(--accent-strong);font-size:23rpx;font-weight:700}.mastered .num{font-size:30rpx}.topic-list{margin-top:18rpx}.topic-row{display:flex;align-items:center;gap:14rpx;min-height:72rpx;border-bottom:1rpx solid var(--hairline)}.topic-rank{color:#A8B6B2;font-size:20rpx;font-weight:780}.topic-name{flex:1;color:var(--ink);font-size:26rpx;font-weight:650}.topic-errors{color:var(--warning);font-size:21rpx}.empty-copy{padding:30rpx 0;color:var(--text-muted);font-size:24rpx;line-height:1.65;text-align:center}.wrong-action{min-height:82rpx;margin-top:20rpx;border-radius:14rpx;background:var(--accent-soft);color:var(--accent-strong);font-size:26rpx;font-weight:720}.badges-heading{margin-top:44rpx}.badges-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12rpx;margin:0 24rpx}.badge-card{min-height:190rpx;padding:18rpx 12rpx;border:1rpx dashed #C9D5D1;border-radius:18rpx;background:#F4F7F6;text-align:center;opacity:.66}.badge-card.unlocked{border-style:solid;border-color:#BFD7D0;background:#fff;opacity:1;box-shadow:var(--shadow-sm)}.badge-mark{width:54rpx;height:54rpx;margin:0 auto 10rpx;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#E2E9E6;color:#8A9994;font-size:28rpx;font-weight:800}.unlocked .badge-mark{background:var(--accent);color:#fff}.badge-title{display:block;color:var(--ink);font-size:23rpx;font-weight:720}.badge-desc{display:block;margin-top:5rpx;color:var(--text-muted);font-size:19rpx;line-height:1.45}.report-card{margin-top:36rpx;background:linear-gradient(145deg,#FFFFFF,#F3F8F6)}.report-label{color:var(--accent-strong);font-size:20rpx;font-weight:760;letter-spacing: 0}.report-title{display:block;margin-top:8rpx;color:var(--ink);font-size:31rpx;font-weight:760}.report-copy{display:block;margin-top:12rpx;color:var(--text-secondary);font-size:25rpx;line-height:1.8}.share-card{margin:22rpx 24rpx 0;padding:32rpx;border-radius:24rpx;background:#20B486;color:#fff}.share-eyebrow{display:block;color:#A8D2C6;font-size:20rpx;font-weight:750;letter-spacing: 0}.share-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:760}.share-note{display:block;margin-top:7rpx;color:#CFE4DE;font-size:22rpx}.share-btn{min-height:84rpx;margin-top:24rpx;border-radius:14rpx;background:#fff;color:#26352F;font-size:26rpx;font-weight:720}
.achievement-btn{min-height:84rpx;margin-top:12rpx;border:1rpx solid rgba(255,255,255,.4);border-radius:14rpx;background:transparent;color:#fff;font-size:26rpx;font-weight:720}.achievement-btn::after{border:0}

/* 家长成长页：浅色学习档案，不使用整块深色成绩卡。 */
.page {
  min-height: 100vh;
  overflow-x: hidden;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .028) 64rpx 65rpx
  );
}

.growth-hero {
  position: relative;
  margin: 0;
  padding: 44rpx 32rpx 38rpx;
  overflow: hidden;
  border-bottom: 1rpx solid var(--border);
  background:
    linear-gradient(rgba(32, 180, 134, .045) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, var(--primary-soft));
  background-size: 42rpx 42rpx, auto;
}

.growth-hero::after {
  content: '';
  position: absolute;
  right: 28rpx;
  top: 26rpx;
  width: 104rpx;
  height: 18rpx;
  border-radius: 4rpx;
  background: var(--primary);
  opacity: .78;
  transform: rotate(2deg);
}

.eyebrow {
  display: block;
  color: var(--accent-strong);
  font-size: 19rpx;
  font-weight: 780;
  letter-spacing: 0;
}

.hero-title { color: var(--ink); letter-spacing: 0; }
.hero-sub { color: var(--text-secondary); }

.section-nav {
  border-color: var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.nav-item {
  min-height: 88rpx;
  color: var(--text-muted);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.nav-item.active {
  background: var(--primary-soft);
  color: var(--primary-strong);
  box-shadow: none;
}

.nav-item:active { transform: scale(var(--tap-scale)); }

.streak-card {
  position: relative;
  overflow: hidden;
  border: 1rpx solid #BFE4D4;
  border-left: 8rpx solid var(--primary);
  border-radius: var(--r);
  background:
    linear-gradient(rgba(255, 116, 104, .07) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, var(--primary-soft));
  background-size: 100% 42rpx, auto;
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}

.streak-label { color: var(--warning); }
.streak-value { color: var(--ink); }
.streak-value .num { color: var(--primary-strong); }
.streak-copy { color: var(--text-secondary); }

.streak-seal {
  border-color: #BFE4D4;
  border-radius: 18rpx;
  background: #FFFFFF;
  color: var(--warning);
  transform: rotate(2deg);
}

.card,
.metric,
.badge-card.unlocked {
  border-color: var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.card-title,
.section-title,
.metric-value,
.topic-name,
.badge-title,
.report-title { color: var(--ink); }

.card-note,
.metric-label,
.badge-desc,
.empty-copy { color: var(--text-muted); }

.day-dot { background: var(--surface-muted); color: var(--faint); }
.day-dot.on {
  background: var(--accent);
  color: #FFFFFF;
  box-shadow: none;
}
.day-dot.today {
  outline-color: var(--primary);
  outline-offset: 3rpx;
}

.section-kicker { color: var(--primary-strong); }
.mastered { color: var(--accent-strong); }
.topic-row { border-bottom-color: var(--hairline); }
.topic-rank { color: var(--primary); }
.topic-errors { color: var(--coral); }

.wrong-action {
  min-height: 112rpx;
  border: 1rpx solid #BFE4D4;
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  color: var(--primary-strong);
  transition: transform var(--motion-fast) var(--ease-out);
}

.badge-card {
  border-color: var(--border);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
}

.badge-card.unlocked {
  border-top: 5rpx solid var(--primary);
}

.badge-mark { background: var(--primary-soft); color: var(--primary); }
.unlocked .badge-mark { background: var(--primary-soft); color: var(--warning); }

.report-card {
  border-left: 7rpx solid var(--accent);
  background: var(--surface);
}

.report-label { color: var(--accent-strong); }
.report-copy { color: var(--text-secondary); }

.share-card {
  margin-bottom: 24rpx;
  border: 1rpx solid #D5E6DE;
  border-top: 7rpx solid var(--primary);
  border-radius: var(--r);
  background:
    linear-gradient(90deg, rgba(32, 180, 134, .055) 1rpx, transparent 1rpx),
    var(--surface);
  background-size: 44rpx 100%, auto;
  color: var(--ink);
  box-shadow: var(--shadow);
}

.share-eyebrow { color: var(--primary-strong); }
.share-title { color: var(--ink); }
.share-note { color: var(--text-muted); }

.share-btn,
.achievement-btn {
  min-height: 112rpx;
  border-radius: var(--r-sm);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.share-btn {
  background: var(--primary-strong);
  color: #FFFFFF;
}

.achievement-btn {
  border-color: #BFE4D4;
  background: var(--primary-soft);
  color: #15946D;
}

.share-btn::after,
.achievement-btn::after,
.wrong-action::after,
.nav-item::after { border: 0; }

.share-btn:active,
.achievement-btn:active,
.wrong-action:active { transform: scale(var(--tap-scale)); }

.streak-card,
.calendar-card,
.metrics-grid,
.wrong-card,
.badges-grid,
.report-card,
.share-card {
  animation: growth-section-in var(--motion-slow) var(--ease-out) both;
}

@keyframes growth-section-in {
  from { opacity: 0; transform: translateY(16rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 360px) {
  .streak-card { align-items: flex-start; }
  .streak-seal { width: 82rpx; height: 82rpx; }
  .badges-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .streak-card,
  .calendar-card,
  .metrics-grid,
  .wrong-card,
  .badges-grid,
  .report-card,
  .share-card { animation: none; }
  .nav-item,
  .share-btn,
  .achievement-btn,
  .wrong-action { transition: none; }
  .nav-item:active,
  .share-btn:active,
  .achievement-btn:active,
  .wrong-action:active { transform: none; }
}

/* Student challenge theme v3: progress feels lively through rhythm, not a color collage. */
.student-challenge-page {
  --page-bg: #F8FCF9;
  --surface: #FFFFFF;
  --surface-muted: #F1F8F4;
  --ink: #26352F;
  --text-secondary: #5A6A62;
  --text-muted: #6D7C74;
  --primary: #20B486;
  --primary-strong: #15946D;
  --primary-soft: #E8F5EF;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --border: #D5E6DE;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(32, 180, 134, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .growth-hero {
  min-height: 0;
  padding: 34rpx 30rpx 28rpx;
  border: 0;
  border-bottom: 6rpx solid var(--primary);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.student-challenge-page .growth-hero::after { display: none; }
.student-challenge-page .eyebrow,
.student-challenge-page .section-kicker,
.student-challenge-page .streak-label,
.student-challenge-page .share-eyebrow,
.student-challenge-page .report-label { color: var(--primary-strong); }
.student-challenge-page .hero-title,
.student-challenge-page .section-title,
.student-challenge-page .card-title,
.student-challenge-page .share-title,
.student-challenge-page .report-title { color: var(--ink); }
.student-challenge-page .hero-sub,
.student-challenge-page .card-note,
.student-challenge-page .share-note,
.student-challenge-page .report-copy { color: var(--text-secondary); }
.student-challenge-page .streak-card,
.student-challenge-page .card,
.student-challenge-page .metric,
.student-challenge-page .badge-card,
.student-challenge-page .share-card {
  min-height: 0;
  border-color: var(--border);
  border-radius: 16rpx;
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 6rpx 18rpx rgba(38, 53, 47, .06);
}
.student-challenge-page .metrics-grid,
.student-challenge-page .badges-grid { align-items: start; }
.student-challenge-page .streak-card,
.student-challenge-page .report-card,
.student-challenge-page .share-card { border-left: 6rpx solid var(--primary); }
.student-challenge-page .streak-seal,
.student-challenge-page .badge-mark,
.student-challenge-page .day-dot.on,
.student-challenge-page .unlocked .badge-mark {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.student-challenge-page .wrong-card,
.student-challenge-page .topic-errors {
  border-color: #FFD2CD;
  background: var(--coral-soft);
  color: var(--danger);
}
.student-challenge-page .share-btn,
.student-challenge-page .achievement-btn {
  min-height: 86rpx;
  border-radius: 14rpx;
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .wrong-action {
  min-height: 80rpx;
  border-radius: 14rpx;
  background: var(--coral-soft);
  color: var(--danger);
}

.student-challenge-page .growth-hero {
  position: relative;
}

.student-challenge-page .hero-mark {
  position: absolute;
  top: 24rpx;
  right: 28rpx;
  width: 70rpx;
  height: 70rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #BFE4D4;
  border-radius: 14rpx;
  background: var(--primary-soft);
}

.student-challenge-page .streak-main,
.student-challenge-page .card-title-row,
.student-challenge-page .section-title-row {
  display: flex;
  align-items: center;
}

.student-challenge-page .streak-main {
  min-width: 0;
  gap: 14rpx;
}

.student-challenge-page .streak-icon {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #FFD2CD;
  border-radius: 14rpx;
  background: var(--coral-soft);
}

.student-challenge-page .card-title-row,
.student-challenge-page .section-title-row {
  gap: 10rpx;
}

.student-challenge-page .metric .pp-icon {
  margin-bottom: 8rpx;
}
</style>
