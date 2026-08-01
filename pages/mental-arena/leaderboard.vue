<template>
  <view class="page student-challenge-page">
    <view class="hero">
      <view class="hero-mark"><pp-icon name="trophy" :size="42" motion="shine" :delay="80" /></view>
      <text class="eyebrow">LEADERBOARD</text>
      <text class="hero-title">口算排行榜</text>
      <text class="hero-sub">同一位老师名下的同学一起比拼</text>
    </view>

    <view class="battle-tabs">
      <button :class="['battle-tab',{active:battle==='primary'}]" @tap="switchBattle('primary')">小学战场</button>
      <button :class="['battle-tab',{active:battle==='junior'}]" @tap="switchBattle('junior')">初中战场</button>
    </view>
    <view class="period-tabs">
      <button :class="['period-tab',{active:period==='week'}]" @tap="switchPeriod('week')">本周榜</button>
      <button :class="['period-tab',{active:period==='history'}]" @tap="switchPeriod('history')">历史榜</button>
    </view>

    <view v-if="loading" class="state"><pp-state type="loading" title="正在刷新排名" /></view>
    <view v-else-if="error" class="state"><pp-state type="error" title="排行榜加载失败" :description="error" action-text="重试" @action="loadBoard" /></view>
    <template v-else>
      <view v-if="board.my_rank" class="my-rank">
        <view class="my-copy"><view class="my-rank-icon"><pp-icon name="target" :size="30" motion="pop" :delay="220" /></view><view><text class="my-label">我的最佳排名</text><view class="my-name-line"><text class="my-name">{{ board.my_rank.student_name }}</text><text class="grade-tag">{{ board.my_rank.grade_label }}</text></view></view></view>
        <view class="my-result"><text class="my-place">第 {{ board.my_rank.rank }} 名</text><text class="my-score">{{ board.my_rank.score }} 分</text></view>
      </view>

      <view class="rank-card">
        <view class="rank-head"><view class="rank-head-title"><pp-icon name="trophy" :size="26" motion="pop" :delay="320" /><text>名次 / 同学 · 年级</text></view><text>正确 · 用时 · 得分</text></view>
        <pp-state v-if="!board.entries?.length" title="还没有上榜记录" description="完成一局挑战，就能成为第一个上榜的人。" />
        <view v-for="item in board.entries" :key="item.student_id" :class="['rank-row',{mine:Number(item.student_id)===Number(studentId)}]">
          <text :class="['place',`place-${item.rank}`]">{{ item.rank }}</text>
          <view class="student-copy">
            <view class="student-line">
              <text class="student-name">{{ item.student_name }}</text>
              <text class="grade-tag">{{ item.grade_label }}</text>
              <text v-if="item.is_fishing" class="fish-tag">炸鱼选手</text>
            </view>
            <text class="result-meta">{{ item.correct_count }}/{{ item.total_questions }} 正确 · {{ item.elapsed_seconds }} 秒</text>
          </view>
          <text class="score">{{ item.score }}</text>
        </view>
      </view>

      <view class="rule-card">
        <view class="rule-title-row"><pp-icon name="lightbulb" :size="28" /><text class="rule-title">排名说明</text></view>
        <text class="rule-copy">七、八年级混合排名，姓名旁显示年级。每位同学只取当前周期最高分；同分时依次比较正确题数、完成用时和提交时间。本周榜按北京时间周一至周日统计。</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref('');
const battle = ref('primary');
const period = ref('week');
const board = ref({ entries: [], my_rank: null });
const loading = ref(false);
const error = ref('');

onLoad((options) => {
  studentId.value = String(options?.student_id || '');
  battle.value = options?.battle === 'junior' ? 'junior' : 'primary';
  loadBoard();
});

async function loadBoard() {
  if (!studentId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    board.value = await api.get(`/mental-arena/leaderboard?student_id=${studentId.value}&battle=${battle.value}&period=${period.value}`);
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('mentalArena.leaderboard', err);
  } finally { loading.value = false; }
}
function switchBattle(value) { if (battle.value !== value) { battle.value = value; loadBoard(); } }
function switchPeriod(value) { if (period.value !== value) { period.value = value; loadBoard(); } }
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(50rpx + env(safe-area-inset-bottom))}.hero{margin:0 -24rpx 22rpx;padding:48rpx 36rpx 42rpx}.eyebrow{display:block;font-size:20rpx;font-weight:800}.hero-title{display:block;margin-top:10rpx;font-size:43rpx;font-weight:900}.hero-sub{display:block;margin-top:8rpx;font-size:22rpx}.battle-tabs,.period-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10rpx}.period-tabs{margin-top:10rpx}.battle-tab,.period-tab{min-height:78rpx;display:flex;align-items:center;justify-content:center;margin:0;font-size:24rpx;font-weight:700}.period-tab{min-height:68rpx;font-size:22rpx}.state{margin-top:18rpx;padding:28rpx}.my-rank{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-top:18rpx;padding:24rpx}.my-label{display:block;font-size:20rpx;font-weight:800}.my-name{display:block;margin-top:4rpx;font-size:27rpx;font-weight:800}.my-result{text-align:right}.my-place{display:block;font-size:25rpx;font-weight:850}.my-score{display:block;margin-top:3rpx;font-size:22rpx}.rank-card{margin-top:18rpx;padding:16rpx 22rpx}.rank-head{display:flex;justify-content:space-between;padding:8rpx 0 15rpx;font-size:20rpx}.rank-row{display:flex;align-items:center;gap:14rpx;min-height:104rpx}.rank-row.mine{margin:0 -10rpx;padding:0 10rpx}.place{width:46rpx;height:46rpx;display:flex;align-items:center;justify-content:center;flex:none;font-size:22rpx;font-weight:850}.student-copy{flex:1;min-width:0}.student-line{display:flex;align-items:center;gap:8rpx;min-width:0}.student-name{overflow:hidden;font-size:26rpx;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.fish-tag{flex:none;padding:5rpx 9rpx;font-size:20rpx;font-weight:900}.result-meta{display:block;margin-top:5rpx;font-size:20rpx}.score{flex:none;font-size:30rpx;font-weight:900}.rule-card{margin-top:18rpx;padding:22rpx}.rule-title{display:block;font-size:23rpx;font-weight:800}.rule-copy{display:block;margin-top:6rpx;font-size:20rpx;line-height:1.6}
.my-name-line{display:flex;align-items:center;gap:8rpx;margin-top:4rpx;min-width:0}.my-name-line .my-name{min-width:0;margin-top:0}.grade-tag{flex:none;padding:4rpx 8rpx;border-radius:7rpx;background:#EDF9FC;color:#050505;font-size:18rpx;font-weight:750;line-height:1.35}.student-name{min-width:0}

/* 排行榜使用浅色表格纸，名次奖励用黄/薄荷而非深色背景。 */
.page {
  overflow-x: hidden;
}

.hero {
  position: relative;
  margin: 0 -24rpx 22rpx;
  padding: 44rpx 36rpx 38rpx;
}

.hero::after {
  content: '';
  position: absolute;
  right: 34rpx;
  top: 28rpx;
  width: 108rpx;
  height: 18rpx;
  transform: rotate(2deg);
}

.battle-tabs,
.period-tabs {
  padding: 7rpx;
}

.battle-tab,
.period-tab {
  min-height: 88rpx;
}

.battle-tab:active,
.period-tab:active { transform: scale(var(--tap-scale)); }
.rank-row {
  min-height: 112rpx;
}

@media (prefers-reduced-motion: reduce) {
  .battle-tab:active,
  .period-tab:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
.student-challenge-page {
  --page-bg: #F7FCFE;
  --surface: #FFFFFF;
  --surface-muted: #FBFDFE;
  --ink: #050505;
  --text-secondary: #50545B;
  --text-muted: #6B7078;
  --primary: #0B789A;
  --primary-strong: #050505;
  --primary-soft: #E5F8FE;
  --accent: #F79BC0;
  --accent-strong: #9B2F5F;
  --accent-soft: #FFF0F6;
  --coral: #F79BC0;
  --coral-soft: #FFF0F6;
  --danger: #B53A52;
  --border: #DCE9ED;
  --hairline: #EDF3F5;
  --r: 16rpx;
  --r-sm: 14rpx;
  --r-xs: 10rpx;
  --r-lg: 16rpx;
  --shadow-sm: 0 6rpx 18rpx rgba(5, 5, 5, .06);
  --shadow: 0 10rpx 28rpx rgba(5, 5, 5, .08);
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 55rpx,
    rgba(153, 222, 244, .045) 56rpx 57rpx
  );
  color: var(--ink);
}

.student-challenge-page .hero {
  min-height: 0;
  margin: 0 -24rpx 18rpx;
  padding: 34rpx 30rpx 28rpx;
  border-bottom: 7rpx solid var(--brand-sky);
  border-radius: 0;
  background-color: var(--surface);
  box-shadow: none;
}

.student-challenge-page .eyebrow {
  color: var(--primary-strong);
  font-size: 18rpx;
  letter-spacing: 0;
}

.student-challenge-page .hero-title {
  margin-top: 10rpx;
  color: var(--ink);
  font-size: 44rpx;
}

.student-challenge-page .hero-sub {
  color: var(--text-secondary);
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
  border: 1rpx solid #FCEEEB;
  border-radius: 14rpx;
  background: var(--coral-soft);
}

.student-challenge-page .my-copy,
.student-challenge-page .rank-head-title,
.student-challenge-page .rule-title-row {
  display: flex;
  align-items: center;
}

.student-challenge-page .my-copy {
  min-width: 0;
  gap: 12rpx;
}

.student-challenge-page .my-rank-icon {
  width: 54rpx;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 12rpx;
  background: var(--primary-soft);
}

.student-challenge-page .rank-head-title,
.student-challenge-page .rule-title-row {
  gap: 8rpx;
}

.student-challenge-page .battle-tabs,
.student-challenge-page .period-tabs {
  gap: 0;
  padding: 5rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .period-tabs {
  margin-top: 10rpx;
}

.student-challenge-page .battle-tab,
.student-challenge-page .period-tab {
  min-height: 78rpx;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-secondary);
}

.student-challenge-page .period-tab {
  min-height: 68rpx;
}

.student-challenge-page .battle-tab.active {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .period-tab.active {
  border: 0;
  background: var(--primary-soft);
  color: #050505;
}

.student-challenge-page .state,
.student-challenge-page .rank-card {
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .my-rank {
  margin-top: 16rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid #CADCF2;
  border-left: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  box-shadow: none;
}

.student-challenge-page .my-label {
  color: var(--primary-strong);
}

.student-challenge-page .my-name,
.student-challenge-page .my-place,
.student-challenge-page .my-score {
  color: var(--ink);
}

.student-challenge-page .rank-card {
  margin-top: 16rpx;
  padding: 10rpx 22rpx;
}

.student-challenge-page .rank-head {
  padding: 12rpx 0 14rpx;
  color: var(--text-muted);
}

.student-challenge-page .rank-row {
  min-height: 106rpx;
  border-top-color: var(--hairline);
}

.student-challenge-page .rank-row.mine {
  margin: 0 -10rpx;
  padding: 0 10rpx;
  border-left: 5rpx solid var(--accent);
  border-radius: 0;
  background: var(--accent-soft);
}

.student-challenge-page .place {
  width: 48rpx;
  height: 48rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-xs);
  background: var(--surface-muted);
  color: var(--text-secondary);
}

.student-challenge-page .place-1 {
  border-color: #CADCF2;
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .place-2 {
  border-color: #CADCF2;
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .place-3 {
  border-color: #F2C8D5;
  background: var(--coral-soft);
  color: #B53A52;
}

.student-challenge-page .student-name,
.student-challenge-page .score {
  color: var(--ink);
}

.student-challenge-page .fish-tag {
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #B53A52;
}

.student-challenge-page .result-meta {
  color: var(--text-muted);
}

.student-challenge-page .rule-card {
  margin-top: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #DDEEFF;
  border-left: 7rpx solid var(--accent);
  border-radius: var(--r-sm);
  background: var(--accent-soft);
}

.student-challenge-page .rule-title {
  color: var(--ink);
}

.student-challenge-page .rule-copy {
  color: var(--text-secondary);
}
</style>
