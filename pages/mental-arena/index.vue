<template>
  <view class="page student-challenge-page">
    <view class="hero">
      <view class="hero-mark">
        <pp-icon name="calculator" :size="42" motion="bob" :delay="80" />
      </view>
      <text class="eyebrow">MENTAL MATH ARENA</text>
      <text class="hero-title">口算王</text>
      <text class="hero-sub">{{ student?.name || '同学' }}，选一个战场，20题见真章</text>
    </view>

    <view v-if="loading" class="card"><pp-state type="loading" title="正在布置口算战场" /></view>
    <view v-else-if="error" class="card"><pp-state type="error" title="暂时无法进入" :description="error" action-text="重试" @action="loadPage" /></view>
    <template v-else>
      <view class="score-rule">
        <view class="score-item"><pp-icon name="check" :size="28" motion="pop" :delay="140" :stagger="70" :index="0" /><text class="score-big">100</text><text class="score-label">每题正确分</text></view>
        <view class="score-divider"></view>
        <view class="score-item"><pp-icon name="history" :size="28" motion="pop" :delay="140" :stagger="70" :index="1" /><text class="score-big">99</text><text class="score-label">最高速度奖</text></view>
        <view class="score-divider"></view>
        <view class="score-item"><pp-icon name="target" :size="28" motion="pop" :delay="140" :stagger="70" :index="2" /><text class="score-big">2099</text><text class="score-label">满分</text></view>
      </view>
      <text class="rule-note">正确率绝对优先：20题全对一定超过19题全对</text>

      <view class="battle primary-battle">
        <view class="battle-top">
          <view class="battle-heading">
            <view class="battle-icon"><pp-icon name="book" :size="34" motion="shine" :delay="420" /></view>
            <view>
              <text class="battle-kicker">PRIMARY</text>
              <text class="battle-title">小学战场</text>
            </view>
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
          <view class="battle-heading">
            <view class="battle-icon"><pp-icon name="target" :size="34" motion="pop" :delay="520" /></view>
            <view>
              <text class="battle-kicker">JUNIOR</text>
              <text class="battle-title">初中战场</text>
            </view>
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
.page{min-height:100vh;padding:0 24rpx calc(54rpx + env(safe-area-inset-bottom))}.hero{margin:0 -24rpx 22rpx;padding:52rpx 36rpx 48rpx}.eyebrow{display:block;font-size:20rpx;font-weight:800}.hero-title{display:block;margin-top:12rpx;font-size:54rpx;font-weight:900}.hero-sub{display:block;margin-top:9rpx;font-size:25rpx}.card{padding:28rpx}.score-rule{display:grid;grid-template-columns:1fr auto 1fr auto 1fr;align-items:center;padding:24rpx 20rpx;text-align:center}.score-big{display:block;font-size:34rpx;font-weight:900}.score-label{display:block;margin-top:3rpx;font-size:20rpx}.score-divider{width:1rpx;height:54rpx}.rule-note{display:block;margin:10rpx 0 22rpx;font-size:20rpx;text-align:center}.battle{margin-bottom:20rpx;padding:28rpx}.battle-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.battle-kicker{display:block;font-size:20rpx;font-weight:850}.battle-title{display:block;margin-top:6rpx;font-size:38rpx;font-weight:900}.battle-time{padding:9rpx 13rpx;font-size:20rpx;font-weight:700}.battle-desc{display:block;margin-top:16rpx;font-size:23rpx;line-height:1.6}.battle-actions{display:grid;grid-template-columns:.8fr 1.4fr;gap:12rpx;margin-top:24rpx}.rank-btn,.start-btn{min-height:88rpx;display:flex;align-items:center;justify-content:center;margin:0;font-size:25rpx;font-weight:800}.tip-card{padding:24rpx}.tip-title{display:block;font-size:26rpx;font-weight:800}.tip-copy,.fish-note{display:block;margin-top:8rpx;font-size:21rpx;line-height:1.6}.fish-note{padding:14rpx;font-weight:700}

/* 口算入口：阳光黄与薄荷绿区分战场，统一落在浅色教育底座。 */
.page {
  overflow-x: hidden;
}

.hero {
  position: relative;
  margin: 0 -24rpx 22rpx;
  padding: 46rpx 36rpx 42rpx;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  right: 34rpx;
  top: 30rpx;
  width: 116rpx;
  height: 20rpx;
  opacity: .8;
  transform: rotate(2deg);
}

.battle {
  position: relative;
  overflow: hidden;
}

.battle::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8rpx;
}

.rank-btn,
.start-btn {
  min-height: 112rpx;
}

.rank-btn:active,
.start-btn:active { transform: scale(var(--tap-scale)); }
.rank-btn[disabled],
.start-btn[disabled] { opacity: .5; }

@media (max-width: 360px) {
  .hero-title { font-size: 48rpx; }
  .battle-actions { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .rank-btn:active,
  .start-btn:active { transform: none; }
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
  margin: 0 -24rpx 18rpx;
  padding: 34rpx 30rpx 28rpx;
  border-bottom: 7rpx solid var(--primary);
  border-radius: 0;
  background-color: var(--surface);
  box-shadow: none;
}

.student-challenge-page .hero::after {
  top: 0;
  right: 36rpx;
  width: 94rpx;
  height: 10rpx;
  border-radius: 0 0 4rpx 4rpx;
  background: var(--primary);
  opacity: 1;
  transform: none;
}

.student-challenge-page .eyebrow {
  color: var(--primary-strong);
  font-size: 18rpx;
  letter-spacing: 0;
}

.student-challenge-page .hero-title {
  margin-top: 10rpx;
  color: var(--ink);
  font-size: 48rpx;
  letter-spacing: 0;
}

.student-challenge-page .hero-sub {
  color: var(--text-secondary);
}

.student-challenge-page .hero-mark {
  position: absolute;
  top: 26rpx;
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

.student-challenge-page .score-item {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
}

.student-challenge-page .score-item .pp-icon {
  margin-bottom: 5rpx;
}

.student-challenge-page .card,
.student-challenge-page .score-rule,
.student-challenge-page .tip-card {
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .score-rule {
  padding: 22rpx 16rpx;
  border-left: 7rpx solid var(--primary);
  border-top: 1rpx solid var(--border);
}

.student-challenge-page .score-big {
  color: var(--primary-strong);
  font-size: 34rpx;
}

.student-challenge-page .score-label,
.student-challenge-page .rule-note {
  color: var(--text-muted);
}

.student-challenge-page .score-divider {
  background: var(--hairline);
}

.student-challenge-page .battle {
  margin-bottom: 16rpx;
  padding: 26rpx 26rpx 24rpx 30rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.student-challenge-page .battle::before {
  width: 7rpx;
}

.student-challenge-page .primary-battle {
  border-color: var(--border);
  background: var(--surface);
}

.student-challenge-page .primary-battle::before {
  background: var(--primary-strong);
}

.student-challenge-page .junior-battle {
  border-color: #CBEADF;
  background: var(--accent-soft);
  color: var(--ink);
}

.student-challenge-page .junior-battle::before {
  background: var(--accent);
}

.student-challenge-page .battle-kicker,
.student-challenge-page .junior-battle .battle-kicker {
  color: var(--primary-strong);
  letter-spacing: 0;
}

.student-challenge-page .junior-battle .battle-kicker {
  color: var(--accent-strong);
}

.student-challenge-page .battle-title,
.student-challenge-page .junior-battle .battle-title {
  color: var(--ink);
  font-size: 36rpx;
}

.student-challenge-page .battle-desc,
.student-challenge-page .junior-battle .battle-desc {
  color: var(--text-secondary);
}

.student-challenge-page .battle-time,
.student-challenge-page .junior-battle .battle-time {
  padding: 8rpx 12rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-xs);
  background: var(--surface);
  color: var(--text-secondary);
}

.student-challenge-page .battle-actions {
  grid-template-columns: .85fr 1.35fr;
  gap: 12rpx;
}

.student-challenge-page .battle-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.student-challenge-page .battle-icon {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border: 1rpx solid #BFE4D4;
  border-radius: 13rpx;
  background: var(--primary-soft);
}

.student-challenge-page .rank-btn,
.student-challenge-page .start-btn {
  min-height: 94rpx;
  border-radius: var(--r-sm);
}

.student-challenge-page .rank-btn,
.student-challenge-page .rank-btn.dark {
  border: 1rpx solid #BFE4D4;
  background: var(--surface);
  color: var(--primary-strong);
}

.student-challenge-page .start-btn.primary {
  background: var(--primary);
  color: #FFFFFF;
}

.student-challenge-page .start-btn.junior {
  background: var(--accent);
  color: #FFFFFF;
}

.student-challenge-page .tip-card {
  padding: 22rpx;
  border-left: 7rpx solid var(--primary);
}

.student-challenge-page .tip-title {
  color: var(--ink);
}

.student-challenge-page .tip-copy {
  color: var(--text-secondary);
}

.student-challenge-page .fish-note {
  padding: 14rpx 16rpx;
  border-left: 5rpx solid var(--coral);
  border-radius: var(--r-xs);
  background: var(--coral-soft);
  color: #D94B45;
}

@media (max-width: 360px) {
  .student-challenge-page .battle-actions {
    grid-template-columns: 1fr;
  }
}
</style>
