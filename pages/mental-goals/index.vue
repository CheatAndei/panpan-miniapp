<template>
  <view class="page page-bottom-safe">
    <view class="hero"><text class="eyebrow">REAL RANK GOALS</text><text class="hero-title">口算冲榜目标</text><text class="hero-sub">设置真实目标，不修改任何学生成绩</text></view>
    <view class="goal-form">
      <text class="section-title">新建本周目标</text>
      <picker :range="students" range-key="name" :value="studentIndex" @change="studentIndex=Number($event.detail.value)"><view class="picker-row"><text>{{ students[studentIndex]?.name || '选择学生' }}</text><text>选择 ›</text></view></picker>
      <view class="battle-row"><button :class="{on:battle==='primary'}" @tap="battle='primary'">小学场</button><button :class="{on:battle==='junior'}" @tap="battle='junior'">初中场</button></view>
      <view class="rank-row"><text>目标周排名</text><input v-model="targetRank" type="number" placeholder="如 3" /></view>
      <button class="save-btn" :disabled="saving||!students.length" @tap="save">{{ saving?'正在计算目标…':'生成真实冲榜目标' }}</button>
      <text class="form-note">系统按当前真实榜单计算目标分数，学生端只显示与目标的差距。</text>
    </view>
    <text class="list-title">最近目标</text>
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
.page{min-height:100vh;padding:0 24rpx 50rpx;background:var(--page-bg)}.hero{margin:0 -24rpx 20rpx;padding:50rpx 34rpx 44rpx;border-radius:0 0 34rpx 34rpx;background:linear-gradient(145deg,#183A36,#2F6E61);color:#fff}.eyebrow{display:block;color:#B9DDD3;font-size:19rpx;font-weight:800;letter-spacing:3rpx}.hero-title{display:block;margin-top:8rpx;font-size:41rpx;font-weight:780}.hero-sub{display:block;margin-top:7rpx;color:#D7ECE6;font-size:23rpx}.goal-form{padding:27rpx;border-radius:22rpx;background:#fff;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}.section-title,.list-title{display:block;color:var(--ink);font-size:29rpx;font-weight:750}.picker-row,.rank-row{min-height:82rpx;display:flex;align-items:center;justify-content:space-between;margin-top:16rpx;padding:0 18rpx;border-radius:13rpx;background:var(--surface-muted);color:var(--ink);font-size:24rpx}.picker-row text:last-child{color:var(--accent-strong)}.battle-row{display:grid;grid-template-columns:1fr 1fr;gap:10rpx;margin-top:14rpx}.battle-row button{min-height:72rpx;margin:0;border-radius:12rpx;background:var(--surface-muted);color:var(--text-muted);font-size:23rpx}.battle-row button::after,.save-btn::after{border:0}.battle-row button.on{background:var(--primary);color:#fff}.rank-row input{width:180rpx;text-align:right;font-size:24rpx}.save-btn{min-height:86rpx;margin:18rpx 0 0;border-radius:14rpx;background:var(--primary);color:#fff;font-size:26rpx;font-weight:720}.form-note{display:block;margin-top:12rpx;color:var(--text-muted);font-size:20rpx;line-height:1.5}.list-title{margin:30rpx 4rpx 14rpx}.goal-card{position:relative;display:flex;align-items:center;gap:20rpx;margin-bottom:13rpx;padding:23rpx;border-radius:18rpx;background:#fff;border:1rpx solid var(--border)}.student{display:block;color:var(--ink);font-size:27rpx;font-weight:730}.meta{display:block;margin-top:4rpx;color:var(--text-muted);font-size:20rpx}.target{flex:1;text-align:right}.target text{display:block;color:var(--ink);font-size:23rpx;font-weight:680}.target text:last-child{margin-top:3rpx;color:var(--accent-strong);font-size:21rpx}.state{position:absolute;right:14rpx;top:10rpx;color:#98700E;font-size:18rpx}.state.expired{color:var(--text-muted)}.state.completed{color:var(--success)}
</style>
