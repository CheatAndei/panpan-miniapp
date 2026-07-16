<template>
  <view class="page">
    <view class="hero">
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
        <view><text class="my-label">我的最佳排名</text><text class="my-name">{{ board.my_rank.student_name }}</text></view>
        <view class="my-result"><text class="my-place">第 {{ board.my_rank.rank }} 名</text><text class="my-score">{{ board.my_rank.score }} 分</text></view>
      </view>

      <view class="rank-card">
        <view class="rank-head"><text>名次 / 同学</text><text>正确 · 用时 · 得分</text></view>
        <pp-state v-if="!board.entries?.length" title="还没有上榜记录" description="完成一局挑战，就能成为第一个上榜的人。" />
        <view v-for="item in board.entries" :key="item.student_id" :class="['rank-row',{mine:Number(item.student_id)===Number(studentId)}]">
          <text :class="['place',`place-${item.rank}`]">{{ item.rank }}</text>
          <view class="student-copy">
            <view class="student-line">
              <text class="student-name">{{ item.student_name }}</text>
              <text v-if="item.is_fishing" class="fish-tag">炸鱼选手</text>
            </view>
            <text class="result-meta">{{ item.correct_count }}/{{ item.total_questions }} 正确 · {{ item.elapsed_seconds }} 秒</text>
          </view>
          <text class="score">{{ item.score }}</text>
        </view>
      </view>

      <view class="rule-card">
        <text class="rule-title">排名说明</text>
        <text class="rule-copy">每位同学只取当前周期最高分；同分时依次比较正确题数、完成用时和提交时间。本周榜按北京时间周一至周日统计。</text>
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
.page{min-height:100vh;padding:0 24rpx calc(50rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx 22rpx;padding:48rpx 36rpx 42rpx;border-radius:0 0 36rpx 36rpx;background:linear-gradient(145deg,#173A36,#315D56);color:#fff}.eyebrow{display:block;color:#B5DDD3;font-size:20rpx;font-weight:800;letter-spacing:4rpx}.hero-title{display:block;margin-top:10rpx;font-size:43rpx;font-weight:900}.hero-sub{display:block;margin-top:8rpx;color:#D4E9E3;font-size:22rpx}.battle-tabs,.period-tabs{display:grid;grid-template-columns:1fr 1fr;gap:10rpx}.period-tabs{margin-top:10rpx}.battle-tab,.period-tab{min-height:78rpx;display:flex;align-items:center;justify-content:center;margin:0;border-radius:14rpx;background:#fff;color:#647570;font-size:24rpx;font-weight:700}.battle-tab.active{background:#183A36;color:#fff}.period-tab{min-height:68rpx;font-size:22rpx}.period-tab.active{border:2rpx solid #DCA525;background:#FFF3CD;color:#6C4900}button::after{border:0}.state{margin-top:18rpx;padding:28rpx;border-radius:22rpx;background:#fff}.my-rank{display:flex;align-items:center;justify-content:space-between;gap:18rpx;margin-top:18rpx;padding:24rpx;border:1rpx solid #E6C36B;border-radius:20rpx;background:linear-gradient(135deg,#FFF7DC,#fff)}.my-label{display:block;color:#946400;font-size:20rpx;font-weight:800}.my-name{display:block;margin-top:4rpx;color:#2E291F;font-size:27rpx;font-weight:800}.my-result{text-align:right}.my-place{display:block;color:#7D5500;font-size:25rpx;font-weight:850}.my-score{display:block;margin-top:3rpx;color:#183A36;font-size:22rpx}.rank-card{margin-top:18rpx;padding:16rpx 22rpx;border:1rpx solid #D8E5E1;border-radius:22rpx;background:#fff}.rank-head{display:flex;justify-content:space-between;padding:8rpx 0 15rpx;color:#81908C;font-size:20rpx}.rank-row{display:flex;align-items:center;gap:14rpx;min-height:104rpx;border-top:1rpx solid #E7EEEC}.rank-row.mine{margin:0 -10rpx;padding:0 10rpx;border-radius:14rpx;background:#F0F7F4}.place{width:46rpx;height:46rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:50%;background:#E9F0EE;color:#61716D;font-size:22rpx;font-weight:850}.place-1{background:#F5B83D;color:#493000}.place-2{background:#DDE4E2;color:#43534F}.place-3{background:#ECD2AE;color:#6A4821}.student-copy{flex:1;min-width:0}.student-line{display:flex;align-items:center;gap:8rpx;min-width:0}.student-name{overflow:hidden;color:#183A36;font-size:26rpx;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.fish-tag{flex:none;padding:5rpx 9rpx;border-radius:999rpx;background:#F5B83D;color:#493000;font-size:20rpx;font-weight:900}.result-meta{display:block;margin-top:5rpx;color:#647570;font-size:20rpx}.score{flex:none;color:#183A36;font-size:30rpx;font-weight:900}.rule-card{margin-top:18rpx;padding:22rpx;border-radius:18rpx;background:#E9F2EF}.rule-title{display:block;color:#285F54;font-size:23rpx;font-weight:800}.rule-copy{display:block;margin-top:6rpx;color:#60736E;font-size:20rpx;line-height:1.6}
</style>
