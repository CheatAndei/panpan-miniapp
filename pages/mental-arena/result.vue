<template>
  <view class="page">
    <view v-if="loading" class="state"><pp-state type="loading" title="正在结算战绩" /></view>
    <view v-else-if="error" class="state"><pp-state type="error" title="战绩加载失败" :description="error" action-text="重试" @action="loadResult" /></view>
    <template v-else-if="challenge">
      <view class="result-hero">
        <text class="result-kicker">{{ challenge.battle_label }} · 挑战完成</text>
        <text v-if="challenge.is_fishing" class="fish-tag">炸鱼选手</text>
        <text class="score">{{ challenge.score }}</text>
        <text class="score-label">本局得分</text>
        <text class="score-rule">{{ challenge.correct_count }} × 100 正确分 + {{ challenge.speed_bonus }} 速度奖</text>
      </view>

      <view class="metrics">
        <view><text class="metric-number">{{ accuracy }}%</text><text class="metric-label">正确率</text></view>
        <view><text class="metric-number">{{ challenge.correct_count }}/{{ challenge.total_questions }}</text><text class="metric-label">答对</text></view>
        <view><text class="metric-number">{{ timeText }}</text><text class="metric-label">用时</text></view>
      </view>

      <view class="action-grid">
        <button class="rank-btn" @tap="openLeaderboard">查看排行榜</button>
        <button class="again-btn" @tap="playAgain">再来一局</button>
      </view>

      <view class="card">
        <view class="section-head">
          <text class="section-title">答题回顾</text>
          <text class="wrong-count">错 {{ wrongAnswers.length }} 题</text>
        </view>
        <view v-if="!wrongAnswers.length" class="perfect">
          <text class="perfect-mark">满分正确</text>
          <text class="perfect-copy">全部答对，保持手感，明天继续！</text>
        </view>
        <view v-for="item in wrongAnswers" :key="item.question_id" class="answer-row">
          <text class="answer-no">{{ item.position }}</text>
          <view class="answer-copy">
            <text class="answer-stem">{{ item.stem }}</text>
            <text class="your-answer">你的答案：{{ item.answer || '未作答' }}</text>
            <text class="correct-answer">正确答案：{{ item.correct_answer }}</text>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const challengeId = ref('');
const challenge = ref(null);
const loading = ref(false);
const error = ref('');

const accuracy = computed(() => challenge.value ? Math.round(challenge.value.correct_count * 100 / challenge.value.total_questions) : 0);
const wrongAnswers = computed(() => (challenge.value?.answers || []).filter((item) => !item.is_correct));
const timeText = computed(() => {
  const seconds = Number(challenge.value?.elapsed_seconds || 0);
  return seconds < 60 ? `${seconds}秒` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});

onLoad((options) => { challengeId.value = String(options?.id || ''); loadResult(); });

async function loadResult() {
  if (!challengeId.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await api.get(`/mental-arena/challenges/${challengeId.value}`);
    challenge.value = result.challenge;
    if (challenge.value.status !== 'completed') throw { error: '这局还没有交卷' };
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('mentalArena.result', err);
  } finally { loading.value = false; }
}

function openLeaderboard() {
  uni.navigateTo({ url: `/pages/mental-arena/leaderboard?student_id=${challenge.value.student_id}&battle=${challenge.value.battle}` });
}
function playAgain() {
  uni.redirectTo({ url: `/pages/mental-arena/index?student_id=${challenge.value.student_id}` });
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(52rpx + env(safe-area-inset-bottom));background:#F3F7F5}.state{margin-top:24rpx;padding:28rpx;border-radius:22rpx;background:#fff}.result-hero{margin:0 -24rpx;padding:56rpx 32rpx 48rpx;border-radius:0 0 38rpx 38rpx;background:linear-gradient(150deg,#153A34,#2B6A5E);color:#fff;text-align:center}.result-kicker{display:block;color:#B8DED5;font-size:22rpx;font-weight:750;letter-spacing:2rpx}.fish-tag{display:inline-flex;margin-top:13rpx;padding:9rpx 18rpx;border-radius:999rpx;background:#F5B83D;color:#493000;font-size:24rpx;font-weight:950;letter-spacing:2rpx}.score{display:block;margin-top:16rpx;color:#FFE8A4;font-size:104rpx;font-weight:950;line-height:1}.score-label{display:block;margin-top:8rpx;color:#fff;font-size:24rpx}.score-rule{display:block;margin-top:13rpx;color:#C7E2DB;font-size:20rpx}.metrics{display:grid;grid-template-columns:repeat(3,1fr);margin-top:22rpx;padding:24rpx 10rpx;border:1rpx solid #D8E6E1;border-radius:22rpx;background:#fff;text-align:center}.metrics view{border-right:1rpx solid #E3ECE9}.metrics view:last-child{border:0}.metric-number{display:block;color:#183A36;font-size:32rpx;font-weight:850}.metric-label{display:block;margin-top:4rpx;color:#788984;font-size:20rpx}.action-grid{display:grid;grid-template-columns:1fr 1fr;gap:14rpx;margin-top:18rpx}.rank-btn,.again-btn{min-height:90rpx;display:flex;align-items:center;justify-content:center;margin:0;border-radius:15rpx;font-size:26rpx;font-weight:800}.rank-btn{background:#F5B83D;color:#493000}.again-btn{background:#183A36;color:#fff}button::after{border:0}.card{margin-top:20rpx;padding:28rpx;border:1rpx solid #D8E6E1;border-radius:22rpx;background:#fff}.section-head{display:flex;align-items:center;justify-content:space-between}.section-title{color:#183A36;font-size:30rpx;font-weight:800}.wrong-count{padding:8rpx 14rpx;border-radius:999rpx;background:#FCE9E5;color:#A7463F;font-size:21rpx;font-weight:750}.perfect{margin-top:22rpx;padding:25rpx;border-radius:16rpx;background:#E8F4F0;text-align:center}.perfect-mark{display:block;color:#236856;font-size:30rpx;font-weight:850}.perfect-copy{display:block;margin-top:6rpx;color:#55716A;font-size:22rpx}.answer-row{display:flex;gap:16rpx;padding:22rpx 0;border-bottom:1rpx solid #E4ECE9}.answer-row:last-child{border:0}.answer-no{width:46rpx;height:46rpx;display:flex;align-items:center;justify-content:center;flex:none;border-radius:13rpx;background:#FCE9E5;color:#A7463F;font-size:23rpx;font-weight:800}.answer-copy{flex:1;min-width:0}.answer-stem{display:block;color:#183A36;font-size:27rpx;font-weight:680;line-height:1.55}.your-answer,.correct-answer{display:block;margin-top:7rpx;font-size:22rpx}.your-answer{color:#A7463F}.correct-answer{color:#26705F;font-weight:720}
</style>
