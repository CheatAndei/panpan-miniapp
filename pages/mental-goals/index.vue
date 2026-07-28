<template>
  <view class="page page-bottom-safe student-challenge-page">
    <view class="hero"><view class="hero-mark"><pp-icon name="target" :size="42" motion="shine" :delay="80" /></view><text class="eyebrow">REAL RANK GOALS</text><text class="hero-title">口算冲榜目标</text><text class="hero-sub">设置真实目标，不修改任何学生成绩</text></view>
    <view class="goal-form">
      <view class="section-title-row"><pp-icon name="target" :size="30" motion="pop" :delay="180" /><text class="section-title">新建本周目标</text></view>
      <picker :range="students" range-key="name" :value="studentIndex" @change="studentIndex=Number($event.detail.value)"><view class="picker-row"><view class="picker-student"><pp-icon name="user" :size="28" /><text>{{ students[studentIndex]?.name || '选择学生' }}</text></view><text>选择 ›</text></view></picker>
      <view class="battle-row"><button :class="{on:battle==='primary'}" @tap="battle='primary'">小学场</button><button :class="{on:battle==='junior'}" @tap="battle='junior'">初中场</button></view>
      <view class="rank-row"><text>目标周排名</text><input v-model="targetRank" type="number" placeholder="如 3" /></view>
      <button class="save-btn" :disabled="saving||!students.length" @tap="save">{{ saving?'正在计算目标…':'生成真实冲榜目标' }}</button>
      <text class="form-note">系统按当前真实榜单计算目标分数，学生端只显示与目标的差距。</text>
    </view>
    <view class="list-title-row"><pp-icon name="history" :size="30" motion="breathe" :delay="260" /><text class="list-title">最近目标</text></view>
    <pp-state v-if="loading && !goals.length" type="loading" title="正在读取目标" />
    <pp-state v-else-if="!goals.length" title="还没有冲榜目标" description="选择学生后生成一个本周目标。" />
    <view v-for="item in goals" :key="item.id" class="goal-card">
      <view><text class="student">{{ item.student_name }}</text><text class="meta">{{ item.class_name }} · {{ item.battle==='junior'?'初中场':'小学场' }}</text></view>
      <view class="target"><text>目标第 {{ item.target_rank }} 名</text><text>{{ item.target_score }} 分</text></view>
      <text :class="['state',item.status]">{{ item.status==='active'?'进行中':item.status==='completed'?'已完成':'已到期' }}</text>
    </view>
  </view>
</template>
<script setup>
import { ref } from 'vue';
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app';
import { api } from '@/utils/api';
const students=ref([]),studentIndex=ref(0),battle=ref('junior'),targetRank=ref('3'),goals=ref([]),loading=ref(false),saving=ref(false);
onShow(load);onPullDownRefresh(async()=>{try{await load();}finally{uni.stopPullDownRefresh();}});
async function load(){if(loading.value)return;loading.value=true;try{const [studentData,goalData]=await Promise.all([api.get('/students'),api.get('/mental-arena/goals')]);students.value=studentData.students||[];goals.value=goalData.goals||[];}catch(e){uni.showToast({title:e?.error||'加载失败',icon:'none'});}finally{loading.value=false;}}
async function save(){const rank=Number(targetRank.value);if(!students.value[studentIndex.value])return;if(!Number.isInteger(rank)||rank<1||rank>100)return uni.showToast({title:'请输入 1-100 的目标排名',icon:'none'});saving.value=true;try{const data=await api.post('/mental-arena/goals',{student_id:students.value[studentIndex.value].id,battle:battle.value,target_rank:rank});uni.showModal({title:'目标已生成',content:`目标第 ${data.goal.target_rank} 名，需要达到 ${data.goal.target_score} 分。`,showCancel:false});await load();}catch(e){uni.showToast({title:e?.error||'创建失败',icon:'none'});}finally{saving.value=false;}}
</script>
<style scoped>
.page{min-height:100vh;padding:0 24rpx 50rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 20rpx;padding:50rpx 34rpx 44rpx;border-radius:0 0 34rpx 34rpx;background:#FFFFFF;color:#fff}.eyebrow{display:block;color:#B9DDD3;font-size:19rpx;font-weight:800;letter-spacing: 0}.hero-title{display:block;margin-top:8rpx;font-size:41rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D7ECE6;font-size:23rpx}.goal-form{padding:27rpx;border-radius:22rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.section-title,.list-title{display:block;color:var(--ink);font-size:29rpx;font-weight:750}.picker-row,.rank-row{min-height:82rpx;display:flex;align-items:center;justify-content:space-between;margin-top:16rpx;padding:0 18rpx;border-radius:13rpx;background:var(--surface-muted);color:var(--ink);font-size:24rpx}.picker-row text:last-child{color:var(--accent-strong)}.battle-row{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:14rpx}.battle-row button{min-height:72rpx;margin:0;border-radius:12rpx;background:var(--surface-muted);color:var(--text-muted);font-size:23rpx}.battle-row button::after,.save-btn::after{border:0}.battle-row button.on{background:var(--primary);color:#fff}.rank-row input{width:180rpx;text-align:right;font-size:24rpx}.save-btn{min-height:86rpx;margin:18rpx 0 0;border-radius:14rpx;background:var(--primary);color:#fff;font-size:26rpx;font-weight:720}.form-note{display:block;margin-top:12rpx;color:var(--text-muted);font-size:20rpx;line-height:1.5}.list-title{margin:30rpx 4rpx 14rpx}.goal-card{position:relative;display:flex;align-items:center;gap:20rpx;margin-bottom:13rpx;padding:23rpx;border-radius:18rpx;background:#fff;border:1rpx solid var(--border)}.student{display:block;color:var(--ink);font-size:27rpx;font-weight:730}.meta{display:block;margin-top:4rpx;color:var(--text-muted);font-size:20rpx}.target{flex:1;text-align:right}.target text{display:block;color:var(--ink);font-size:23rpx;font-weight:680}.target text:last-child{margin-top:3rpx;color:var(--accent-strong);font-size:21rpx}.state{position:absolute;right:14rpx;top:10rpx;color:#315EA8;font-size:18rpx}.state.expired{color:var(--text-muted)}.state.completed{color:var(--success)}
.page {
  background-color: var(--page-bg, #F6FAFF);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(82, 124, 201, .028) 64rpx 65rpx
  );
}
.hero { border-radius: 0 0 24rpx 24rpx; }
.goal-form { border-radius: 18rpx; border-top: 5rpx solid var(--primary); }
.picker-row,
.rank-row { background: #F6FAFF; border: 1rpx solid var(--border); }
.picker-row text:last-child { color: var(--primary-strong); }
.battle-row button.on { background: var(--primary-strong); color: #FFFFFF; }
.save-btn { background: var(--primary-strong); color: #FFFFFF; }
.goal-card { border-radius: 16rpx; }
.target text:last-child { color: var(--primary-strong); }
.picker-row,
.rank-row,
.battle-row button,
.save-btn,
.goal-card {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}
.battle-row button:active,
.save-btn:active,
.goal-card:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}
@media (prefers-reduced-motion: reduce) {
  .picker-row,
  .rank-row,
  .battle-row button,
  .save-btn,
  .goal-card {
    transition: none !important;
  }
  .battle-row button:active,
  .save-btn:active,
  .goal-card:active { transform: none; }
}
/* mei final pass: real-goal planning board */
.page {
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(82, 124, 201, .028) 64rpx 65rpx
  );
}
.hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid rgba(82, 124, 201, .16);
  background:
    linear-gradient(rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF, #EDF5FF 72%, #EDF5FF);
  background-size: 34rpx 34rpx, 34rpx 34rpx, auto;
  color: var(--ink);
  box-shadow: 0 12rpx 28rpx rgba(36, 50, 74, .07);
  animation: goal-surface-in var(--motion-slow) var(--ease-out) both;
}
.hero::after {
  position: absolute;
  right: 34rpx;
  bottom: 0;
  width: 116rpx;
  height: 8rpx;
  border-radius: 999rpx 999rpx 0 0;
  background: var(--primary);
  content: "";
}
.eyebrow { color: var(--primary-strong); }
.hero-title { color: var(--ink); }
.hero-sub { color: var(--text-secondary); }
.goal-form {
  border-color: var(--border);
  border-top-color: var(--primary);
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
}
.picker-row,
.rank-row {
  min-height: 96rpx;
  border-color: var(--border);
  background: #F6FAFF;
}
.picker-row text:last-child { color: var(--primary-strong); }
.battle-row button {
  min-height: 80rpx;
  border: 1rpx solid var(--border);
  background: #F6FAFF;
  color: var(--text-secondary);
}
.battle-row button.on {
  border-color: #CADCF2;
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.save-btn {
  min-height: 104rpx;
  background: linear-gradient(135deg, var(--primary), var(--primary-strong));
  color: #FFFFFF;
  box-shadow: 0 12rpx 26rpx rgba(49, 94, 168, .18);
}
.goal-card {
  border-color: var(--border);
  background: #FFFFFF;
  box-shadow: var(--shadow-sm);
  animation: goal-surface-in var(--motion-slow) var(--ease-out) both;
  transition: none;
}
.goal-card:active { transform: none; opacity: 1; }
.target { padding-top: 18rpx; }
.target text:last-child { color: var(--primary-strong); }
.state { color: #315EA8; }
.state.completed {
  padding: 4rpx 9rpx;
  border-radius: 8rpx;
  background: var(--success-soft);
  color: var(--success);
}
.state.expired { color: var(--text-muted); }
.picker-row,
.battle-row button,
.save-btn {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}
.picker-row:active,
.battle-row button:active,
.save-btn:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}
@keyframes goal-surface-in {
  from { transform: translateY(12rpx); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .hero,
  .goal-card,
  .picker-row,
  .battle-row button,
  .save-btn {
    animation: none !important;
    transition: none !important;
  }
  .picker-row:active,
  .battle-row button:active,
  .save-btn:active { transform: none; }
}

/* Student challenge theme v3: warm paper and one energetic teaching green. */
.student-challenge-page {
  --page-bg: #F6FAFF;
  --surface: #FFFFFF;
  --surface-muted: #F8FBFF;
  --ink: #24324A;
  --text-secondary: #5C6C84;
  --text-muted: #6E7D91;
  --primary: #527CC9;
  --primary-strong: #315EA8;
  --primary-soft: #EDF5FF;
  --coral: #E98577;
  --coral-soft: #FFF0ED;
  --danger: #D66D62;
  --border: #DDE7F2;
  min-height: 100vh;
  background-color: var(--page-bg);
  background-image: repeating-linear-gradient(0deg, transparent 0 55rpx, rgba(82, 124, 201, .05) 56rpx 57rpx);
  color: var(--ink);
}
.student-challenge-page .hero {
  min-height: 0;
  margin-bottom: 18rpx;
  padding: 34rpx 30rpx 28rpx;
  border: 0;
  border-bottom: 6rpx solid var(--primary);
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  box-shadow: none;
}
.student-challenge-page .hero::after { display: none; }
.student-challenge-page .eyebrow { color: var(--primary-strong); }
.student-challenge-page .hero-title { color: var(--ink); }
.student-challenge-page .hero-sub { color: var(--text-secondary); }
.student-challenge-page .goal-form,
.student-challenge-page .goal-card {
  min-height: 0;
  border-color: var(--border);
  border-radius: 16rpx;
  background: var(--surface);
  box-shadow: 0 6rpx 18rpx rgba(36, 50, 74, .06);
}
.student-challenge-page .picker-row,
.student-challenge-page .rank-row,
.student-challenge-page .battle-row button {
  min-height: 76rpx;
  border-color: var(--border);
  border-radius: 14rpx;
  background: var(--surface-muted);
  color: var(--ink);
}
.student-challenge-page .battle-row { align-items: start; }
.student-challenge-page .battle-row button.on {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.student-challenge-page .save-btn {
  min-height: 88rpx;
  border-radius: 14rpx;
  background: var(--primary);
  color: #FFFFFF;
}
.student-challenge-page .state.completed { color: var(--primary-strong); }

.student-challenge-page .hero {
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
  border: 1rpx solid #CADCF2;
  border-radius: 14rpx;
  background: var(--primary-soft);
}

.student-challenge-page .section-title-row,
.student-challenge-page .picker-student,
.student-challenge-page .list-title-row {
  display: flex;
  align-items: center;
  gap: 9rpx;
}

.student-challenge-page .list-title-row {
  margin-top: 24rpx;
}

.student-challenge-page .list-title-row .list-title {
  margin-top: 0;
}
</style>
