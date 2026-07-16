<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">MENTAL MATH ARENA</text>
      <text class="hero-title">口算王</text>
      <text class="hero-sub">{{ student?.name || '同学' }}，选一个战场，20题见真章</text>
    </view>

    <view v-if="loading" class="card"><pp-state type="loading" title="正在布置口算战场" /></view>
    <view v-else-if="error" class="card"><pp-state type="error" title="暂时无法进入" :description="error" action-text="重试" @action="loadPage" /></view>
    <template v-else>
      <view class="score-rule">
        <view><text class="score-big">100</text><text class="score-label">每题正确分</text></view>
        <view class="score-divider"></view>
        <view><text class="score-big">99</text><text class="score-label">最高速度奖</text></view>
        <view class="score-divider"></view>
        <view><text class="score-big">2099</text><text class="score-label">满分</text></view>
      </view>
      <text class="rule-note">正确率绝对优先：20题全对一定超过19题全对</text>

      <view class="battle primary-battle">
        <view class="battle-top">
          <view>
            <text class="battle-kicker">PRIMARY</text>
            <text class="battle-title">小学战场</text>
          </view>
          <text class="battle-time">建议 180 秒内</text>
        </view>
        <text class="battle-desc">3-5个数字混合运算、整除口算和简易方程，全程不出现负数。</text>
        <view class="battle-actions">
          <button class="rank-btn" @tap="openLeaderboard('primary')">查看排行</button>
          <button class="start-btn primary" :disabled="starting" @tap="startBattle('primary')">进入小学战场</button>
        </view>
      </view>

      <view class="battle junior-battle">
        <view class="battle-top">
          <view>
            <text class="battle-kicker">JUNIOR</text>
            <text class="battle-title">初中战场</text>
          </view>
          <text class="battle-time">建议 240 秒内</text>
        </view>
        <text class="battle-desc">有理数、绝对值、分数小数、巧算、整式求值与一元一次方程。</text>
        <view class="battle-actions">
          <button class="rank-btn dark" @tap="openLeaderboard('junior')">查看排行</button>
          <button class="start-btn junior" :disabled="starting" @tap="startBattle('junior')">进入初中战场</button>
        </view>
      </view>

      <view class="tip-card">
        <text class="tip-title">排行榜规则</text>
        <text class="tip-copy">分战场统计本周榜和历史榜；每人只保留最好成绩。同分依次比较正确题数、用时和完成时间。</text>
        <text class="fish-note">初中同学挑战小学战场仍正常排名，同时会获得醒目的「炸鱼选手」标记。</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';

const studentId = ref('');
const student = ref(null);
const loading = ref(false);
const starting = ref(false);
const error = ref('');
let loaded = false;

onLoad((options) => { studentId.value = String(options?.student_id || ''); });
onShow(() => { if (!loaded) loadPage(); });

async function resolveStudentId() {
  if (studentId.value) return studentId.value;
  const result = await api.get('/bind/students');
  const list = result.students || [];
  const activeId = String(uni.getStorageSync('activeChildId') || '');
  const current = list.find((item) => String(item.id) === activeId) || list[0];
  studentId.value = current ? String(current.id) : '';
  return studentId.value;
}

async function loadPage() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const id = await resolveStudentId();
    if (!id) throw { error: '请先绑定孩子' };
    const result = await api.get(`/students/${id}`);
    student.value = result.student || null;
    if (!student.value) throw { error: '没有找到学生信息' };
    loaded = true;
  } catch (err) {
    error.value = err?.error || '请检查网络后重试';
    logError('mentalArena.load', err);
  } finally { loading.value = false; }
}

async function startBattle(battle) {
  if (starting.value) return;
  starting.value = true;
  try {
    const result = await api.post('/mental-arena/challenges', { student_id: Number(studentId.value), battle });
    uni.navigateTo({ url: `/pages/mental-arena/challenge?id=${result.challenge.id}` });
  } catch (err) {
    uni.showToast({ title: err?.error || '开局失败，请重试', icon: 'none' });
  } finally { starting.value = false; }
}

function openLeaderboard(battle) {
  uni.navigateTo({ url: `/pages/mental-arena/leaderboard?student_id=${studentId.value}&battle=${battle}` });
}
</script>

<style scoped>
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom));background:#F3F7F5}.hero{margin:0 -24rpx 22rpx;padding:52rpx 36rpx 48rpx;border-radius:0 0 36rpx 36rpx;background:linear-gradient(145deg,#122E2B,#265E54);color:#fff}.eyebrow{display:block;color:#A9D8CB;font-size:20rpx;font-weight:800;letter-spacing:4rpx}.hero-title{display:block;margin-top:12rpx;font-size:54rpx;font-weight:900;letter-spacing:4rpx}.hero-sub{display:block;margin-top:9rpx;color:#D4EAE4;font-size:25rpx}.card{padding:28rpx;border-radius:22rpx;background:#fff}.score-rule{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;padding:24rpx 20rpx;border:1rpx solid #D5E5DF;border-radius:20rpx;background:#fff;text-align:center}.score-big{display:block;color:#183A36;font-size:34rpx;font-weight:900}.score-label{display:block;margin-top:3rpx;color:#71817C;font-size:20rpx}.score-divider{width:1rpx;height:54rpx;background:#DDE8E4}.rule-note{display:block;margin:10rpx 0 22rpx;color:#52706A;font-size:20rpx;text-align:center}.battle{margin-bottom:20rpx;padding:28rpx;border-radius:24rpx;box-shadow:0 12rpx 28rpx rgba(24,58,54,.08)}.primary-battle{border:1rpx solid #EAC96F;background:linear-gradient(145deg,#FFF9E7,#FFFFFF)}.junior-battle{border:1rpx solid #335C57;background:linear-gradient(145deg,#173A36,#274F49);color:#fff}.battle-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.battle-kicker{display:block;color:#9C6A00;font-size:20rpx;font-weight:850;letter-spacing:3rpx}.junior-battle .battle-kicker{color:#A7D6CA}.battle-title{display:block;margin-top:6rpx;color:#2D2517;font-size:38rpx;font-weight:900}.junior-battle .battle-title{color:#fff}.battle-time{padding:9rpx 13rpx;border-radius:999rpx;background:#F8E4A8;color:#745108;font-size:20rpx;font-weight:700}.junior-battle .battle-time{background:#35685F;color:#D8EFE9}.battle-desc{display:block;margin-top:16rpx;color:#6C5A36;font-size:23rpx;line-height:1.6}.junior-battle .battle-desc{color:#C8DED8}.battle-actions{display:grid;grid-template-columns:.8fr 1.4fr;gap:12rpx;margin-top:24rpx}.rank-btn,.start-btn{min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;border-radius:15rpx;font-size:25rpx;font-weight:800}.rank-btn{border:1rpx solid #B88B27;background:#fff;color:#7B570A}.rank-btn.dark{border-color:#6B9990;background:transparent;color:#D8EFE9}.start-btn.primary{background:#F5B83D;color:#493000}.start-btn.junior{background:#E2F1ED;color:#183A36}button::after{border:0}.tip-card{padding:24rpx;border:1rpx solid #DCE8E4;border-radius:20rpx;background:#fff}.tip-title{display:block;color:#183A36;font-size:26rpx;font-weight:800}.tip-copy,.fish-note{display:block;margin-top:8rpx;color:#687A75;font-size:21rpx;line-height:1.6}.fish-note{padding:14rpx;border-radius:12rpx;background:#FFF0CE;color:#8C5A00;font-weight:700}
</style>
