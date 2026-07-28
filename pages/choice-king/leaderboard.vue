<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero">
      <view class="hero-mark"><pp-icon name="trophy" :size="42" motion="shine" :delay="80" /></view>
      <text class="eyebrow">CHOICE LEADERBOARD</text>
      <text class="hero-title">选择刷题榜</text>
      <text class="hero-sub">只统计首次答对的不同题目，重复练习不会重复加分。</text>
    </view>

    <view class="period-tabs" aria-label="排行榜周期">
      <button :class="['period-tab',{active:period==='week'}]" :disabled="loading" @tap="switchPeriod('week')">本周刷题榜</button>
      <button :class="['period-tab',{active:period==='history'}]" :disabled="loading" @tap="switchPeriod('history')">历史刷题榜</button>
    </view>

    <view v-if="loading" class="rank-skeleton" aria-label="排行榜加载中">
      <view v-for="item in 6" :key="item" class="skeleton-row">
        <view class="skeleton-place"></view><view class="skeleton-name"></view><view class="skeleton-score"></view>
      </view>
    </view>

    <view v-else-if="error" class="state-card">
      <pp-state type="error" title="排行榜加载失败" :description="error" action-text="重新加载" @action="loadBoard" />
    </view>

    <template v-else>
      <view v-if="myRank" class="my-rank">
        <view class="my-copy">
          <view class="my-rank-icon"><pp-icon name="target" :size="30" motion="pop" :delay="220" /></view>
          <view>
          <text class="my-label">我的排名</text>
          <text class="my-name">{{ myRank.student_name || myRank.name || '我' }}</text>
          </view>
        </view>
        <view class="my-result">
          <text class="my-place">第 {{ myRank.rank }} 名</text>
          <text class="my-score">答对 {{ correctCount(myRank) }} 道</text>
        </view>
      </view>

      <view class="rank-card">
        <view class="rank-head">
          <view class="rank-head-title"><pp-icon name="trophy" :size="26" motion="pop" :delay="320" /><text>{{ period === 'week' ? '本周排名' : '历史排名' }}</text></view>
          <text>首次答对题数</text>
        </view>
        <pp-state
          v-if="!entries.length"
          title="还没有同学上榜"
          description="答对第一道选择题，就能出现在这里。"
          action-text="去刷一题"
          @action="goPractice"
        />
        <view
          v-for="(item,index) in entries"
          :key="item.student_id || `${item.rank}-${index}`"
          :class="['rank-row',{mine:isMine(item)}]"
        >
          <text :class="['place',`place-${Number(item.rank || index + 1)}`]">{{ item.rank || index + 1 }}</text>
          <view class="student-copy">
            <view class="student-line">
              <text class="student-name">{{ item.student_name || item.name || '同学' }}</text>
              <text v-if="isMine(item)" class="mine-tag">我</text>
            </view>
            <text class="result-meta">{{ item.class_name || item.group_name || '潘潘老师学习小组' }}</text>
          </view>
          <view class="score-wrap">
            <text class="score">{{ correctCount(item) }}</text>
            <text class="score-unit">道</text>
          </view>
        </view>
      </view>

      <view class="rule-card">
        <view class="rule-title-row"><pp-icon name="lightbulb" :size="28" /><text class="rule-title">排名规则</text></view>
        <text class="rule-copy">答对一道新题计 1 道；同一题反复练习只计一次。错题重写可以帮助巩固，但不会重复增加榜单题数。本周榜按北京时间周一至周日统计。</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref('');
const gradeCode = ref('g7');
const period = ref('week');
const board = ref({ entries: [], my_rank: null });
const loading = ref(false);
const error = ref('');

const entries = computed(() => board.value?.entries || board.value?.leaderboard || board.value?.rankings || []);
const myRank = computed(() => board.value?.my_rank || board.value?.mine || null);

onLoad((options) => {
  studentId.value = String(options?.student_id || uni.getStorageSync('activeChildId') || '');
  gradeCode.value = ['g7','g8','g9'].includes(String(options?.grade || '')) ? String(options.grade) : 'g7';
  period.value = options?.period === 'history' ? 'history' : 'week';
  loadBoard();
});
onPullDownRefresh(async () => { try { await loadBoard(); } finally { uni.stopPullDownRefresh(); } });

async function resolveStudentId() {
  if (studentId.value) return studentId.value;
  const result = await api.get('/bind/students');
  const list = result.students || [];
  const current = list[0];
  studentId.value = current ? String(current.id) : '';
  return studentId.value;
}

async function loadBoard() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const id = await resolveStudentId();
    if (!id) throw { error: '请先绑定孩子后再查看排行榜' };
    board.value = await api.get(`/choice-king/leaderboard?student_id=${encodeURIComponent(id)}&period=${period.value}&grade=${gradeCode.value}&subject=math`);
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('choiceKing.leaderboard', err);
  } finally { loading.value = false; }
}

function correctCount(item) {
  return Number(item?.correct_count ?? item?.unique_correct_count ?? item?.score ?? item?.count ?? 0);
}
function isMine(item) { return Number(item?.student_id) === Number(studentId.value); }
function switchPeriod(value) {
  if (period.value === value || loading.value) return;
  period.value = value;
  loadBoard();
}
function goPractice() { uni.navigateBack({ delta: 1, fail: () => uni.redirectTo({ url: `/pages/choice-king/index?student_id=${studentId.value}` }) }); }
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom))}.hero{margin:0 -24rpx;padding:46rpx 34rpx 42rpx}.eyebrow{display:block;font-size:19rpx;font-weight:760}.hero-title{display:block;margin-top:8rpx;font-size:44rpx;font-weight:820}.hero-sub{display:block;max-width:600rpx;margin-top:8rpx;font-size:22rpx;line-height:1.55}.period-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8rpx;margin-top:20rpx;padding:7rpx}.period-tab{min-height:72rpx;margin:0;font-size:23rpx;font-weight:700}.rank-skeleton,.state-card{margin-top:18rpx;padding:20rpx}.skeleton-row{min-height:96rpx;display:flex;align-items:center;gap:16rpx}.skeleton-place{width:46rpx;height:46rpx}.skeleton-name{width:240rpx;height:27rpx}.skeleton-score{width:70rpx;height:32rpx;margin-left:auto}.my-rank{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-top:18rpx;padding:24rpx}.my-label,.my-name,.my-place,.my-score{display:block}.my-label{font-size:20rpx;font-weight:750}.my-name{margin-top:3rpx;font-size:27rpx;font-weight:780}.my-result{text-align:right}.my-place{font-size:26rpx;font-weight:800}.my-score{margin-top:2rpx;font-size:20rpx}.rank-card{margin-top:18rpx;padding:14rpx 22rpx}.rank-head{display:flex;justify-content:space-between;padding:9rpx 0 14rpx;font-size:20rpx}.rank-row{min-height:104rpx;display:flex;align-items:center;gap:14rpx}.rank-row.mine{margin:0 -10rpx;padding:0 10rpx}.place{width:46rpx;height:46rpx;display:flex;align-items:center;justify-content:center;flex:none;font-size:22rpx;font-weight:820}.student-copy{flex:1;min-width:0}.student-line{display:flex;align-items:center;gap:8rpx}.student-name{overflow:hidden;font-size:25rpx;font-weight:730;text-overflow:ellipsis;white-space:nowrap}.mine-tag{padding:3rpx 9rpx;font-size:18rpx;font-weight:760}.result-meta{display:block;margin-top:4rpx;overflow:hidden;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.score-wrap{flex:none}.score{font-size:31rpx;font-weight:850}.score-unit{margin-left:3rpx;font-size:19rpx}.rule-card{margin-top:18rpx;padding:22rpx}.rule-title,.rule-copy{display:block}.rule-title{font-size:23rpx;font-weight:780}.rule-copy{margin-top:6rpx;font-size:20rpx;line-height:1.65}

/* 选择题榜：浅色成绩册式排行。 */
.page {
  overflow-x: hidden;
}

.hero {
  position: relative;
  margin: 0 -24rpx;
  padding: 44rpx 34rpx 38rpx;
}
.hero::after {
  content: '';
  position: absolute;
  right: 32rpx;
  top: 26rpx;
  width: 108rpx;
  height: 18rpx;
  transform: rotate(2deg);
}
.period-tab {
  min-height: 88rpx;
}
.period-tab:active { transform: scale(var(--tap-scale)); }
.rank-row {
  min-height: 112rpx;
}

@media (prefers-reduced-motion: reduce) {
  .period-tab:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
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
  --accent: #20B486;
  --accent-strong: #15946D;
  --accent-soft: #E8F5EF;
  --coral: #FF7468;
  --coral-soft: #FFF0EE;
  --danger: #D94B45;
  --border: #D5E6DE;
  --hairline: #E4EFE9;
  --r: 16rpx;
  --r-sm: 14rpx;
  --r-xs: 10rpx;
  --r-lg: 16rpx;
  --shadow-sm: 0 6rpx 18rpx rgba(38, 53, 47, .06);
  --shadow: 0 10rpx 28rpx rgba(38, 53, 47, .08);
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 55rpx,
    rgba(32, 180, 134, .045) 56rpx 57rpx
  );
  color: var(--ink);
}

.student-challenge-page .hero {
  min-height: 0;
  margin: 0 -24rpx;
  padding: 34rpx 30rpx 28rpx;
  border-bottom: 7rpx solid var(--primary);
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
  margin-top: 8rpx;
  color: var(--text-secondary);
}

.student-challenge-page .period-tabs {
  gap: 0;
  margin-top: 18rpx;
  padding: 5rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-sm);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .period-tab {
  min-height: 78rpx;
  border-radius: var(--r-xs);
  background: transparent;
  color: var(--text-secondary);
}

.student-challenge-page .period-tab.active {
  background: var(--primary);
  color: #FFFFFF;
  box-shadow: none;
}

.student-challenge-page .rank-skeleton,
.student-challenge-page .state-card,
.student-challenge-page .rank-card {
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .skeleton-row {
  border-bottom-color: var(--hairline);
}

.student-challenge-page .skeleton-place,
.student-challenge-page .skeleton-name,
.student-challenge-page .skeleton-score {
  border-radius: var(--r-xs);
  background: var(--primary-soft);
}

.student-challenge-page .skeleton-place {
  border-radius: var(--r-xs);
}

.student-challenge-page .my-rank {
  margin-top: 18rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid #BFE4D4;
  border-left: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  box-shadow: none;
}

.student-challenge-page .my-label {
  color: var(--primary-strong);
}

.student-challenge-page .my-name,
.student-challenge-page .my-place {
  color: var(--ink);
}

.student-challenge-page .my-score {
  color: var(--text-secondary);
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
  border-color: #BFE4D4;
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .place-2 {
  border-color: #BFE4D4;
  background: var(--primary-soft);
  color: var(--primary-strong);
}

.student-challenge-page .place-3 {
  border-color: #F3C8C2;
  background: var(--coral-soft);
  color: #D94B45;
}

.student-challenge-page .student-name,
.student-challenge-page .score-wrap {
  color: var(--ink);
}

.student-challenge-page .mine-tag {
  border-radius: var(--r-xs);
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.student-challenge-page .result-meta {
  color: var(--text-muted);
}

.student-challenge-page .rule-card {
  margin-top: 16rpx;
  padding: 22rpx;
  border: 1rpx solid #CBEADF;
  border-left: 7rpx solid var(--primary);
  border-radius: var(--r-sm);
  background: var(--primary-soft);
}

.student-challenge-page .rule-title {
  color: var(--ink);
}

.student-challenge-page .rule-copy {
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
  border: 1rpx solid #FFD2CD;
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
</style>
