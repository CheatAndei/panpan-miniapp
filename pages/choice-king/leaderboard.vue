<template>
  <view class="page page-bottom-safe">
    <view class="hero">
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
          <text class="my-label">我的排名</text>
          <text class="my-name">{{ myRank.student_name || myRank.name || '我' }}</text>
        </view>
        <view class="my-result">
          <text class="my-place">第 {{ myRank.rank }} 名</text>
          <text class="my-score">答对 {{ correctCount(myRank) }} 道</text>
        </view>
      </view>

      <view class="rank-card">
        <view class="rank-head">
          <text>{{ period === 'week' ? '本周排名' : '历史排名' }}</text>
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
        <text class="rule-title">排名规则</text>
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
const period = ref('week');
const board = ref({ entries: [], my_rank: null });
const loading = ref(false);
const error = ref('');

const entries = computed(() => board.value?.entries || board.value?.leaderboard || board.value?.rankings || []);
const myRank = computed(() => board.value?.my_rank || board.value?.mine || null);

onLoad((options) => {
  studentId.value = String(options?.student_id || uni.getStorageSync('activeChildId') || '');
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
    board.value = await api.get(`/choice-king/leaderboard?student_id=${encodeURIComponent(id)}&period=${period.value}`);
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
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx;padding:46rpx 34rpx 42rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff}.eyebrow{display:block;color:#B5DDD3;font-size:19rpx;font-weight:760;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:44rpx;font-weight:820}.hero-sub{display:block;max-width:600rpx;margin-top:8rpx;color:#D4E9E3;font-size:22rpx;line-height:1.55}.period-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8rpx;margin-top:20rpx;padding:7rpx;border:1rpx solid #D8E5E1;border-radius:17rpx;background:#fff}.period-tab{min-height:72rpx;margin:0;border-radius:12rpx;background:transparent;color:#647570;font-size:23rpx;font-weight:700}.period-tab::after{border:0}.period-tab.active{background:#183A36;color:#fff;box-shadow:0 7rpx 18rpx rgba(24,58,54,.14)}.rank-skeleton,.state-card{margin-top:18rpx;padding:20rpx;border:1rpx solid #D8E5E1;border-radius:22rpx;background:#fff}.skeleton-row{min-height:96rpx;display:flex;align-items:center;gap:16rpx;border-bottom:1rpx solid #EDF2F0}.skeleton-row:last-child{border-bottom:0}.skeleton-place,.skeleton-name,.skeleton-score{background:linear-gradient(100deg,#EAF1EF 20%,#F9FBFA 40%,#EAF1EF 60%);background-size:200% 100%;animation:shimmer 1.2s linear infinite}.skeleton-place{width:46rpx;height:46rpx;border-radius:50%}.skeleton-name{width:240rpx;height:27rpx;border-radius:8rpx}.skeleton-score{width:70rpx;height:32rpx;margin-left:auto;border-radius:8rpx}@keyframes shimmer{to{background-position:-200% 0}}.my-rank{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-top:18rpx;padding:24rpx;border:1rpx solid #BFD9D1;border-radius:20rpx;background:linear-gradient(135deg,#EAF5F1,#fff)}.my-label,.my-name,.my-place,.my-score{display:block}.my-label{color:#2F7D6B;font-size:20rpx;font-weight:750}.my-name{margin-top:3rpx;color:#203A35;font-size:27rpx;font-weight:780}.my-result{text-align:right}.my-place{color:#205F52;font-size:26rpx;font-weight:800}.my-score{margin-top:2rpx;color:#60746E;font-size:20rpx}.rank-card{margin-top:18rpx;padding:14rpx 22rpx;border:1rpx solid #D8E5E1;border-radius:22rpx;background:#fff}.rank-head{display:flex;justify-content:space-between;padding:9rpx 0 14rpx;color:#82918D;font-size:20rpx}.rank-row{min-height:104rpx;display:flex;align-items:center;gap:14rpx;border-top:1rpx solid #E7EEEC}.rank-row.mine{margin:0 -10rpx;padding:0 10rpx;background:#F0F7F4}.place{width:46rpx;height:46rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:50%;background:#E9F0EE;color:#61716D;font-size:22rpx;font-weight:820}.place-1{background:#F2C95C;color:#513900}.place-2{background:#DDE5E2;color:#40534E}.place-3{background:#E8C6A0;color:#66451E}.student-copy{flex:1;min-width:0}.student-line{display:flex;align-items:center;gap:8rpx}.student-name{overflow:hidden;color:#183A36;font-size:25rpx;font-weight:730;text-overflow:ellipsis;white-space:nowrap}.mine-tag{padding:3rpx 9rpx;border-radius:8rpx;background:#DCEFE9;color:#276959;font-size:18rpx;font-weight:760}.result-meta{display:block;margin-top:4rpx;overflow:hidden;color:#71817C;font-size:19rpx;text-overflow:ellipsis;white-space:nowrap}.score-wrap{flex:none;color:#183A36}.score{font-size:31rpx;font-weight:850}.score-unit{margin-left:3rpx;font-size:19rpx}.rule-card{margin-top:18rpx;padding:22rpx;border-radius:18rpx;background:#E8F2EF}.rule-title,.rule-copy{display:block}.rule-title{color:#285F54;font-size:23rpx;font-weight:780}.rule-copy{margin-top:6rpx;color:#60736E;font-size:20rpx;line-height:1.65}@media(prefers-reduced-motion:reduce){.skeleton-place,.skeleton-name,.skeleton-score{animation:none}}
</style>
