<template>
<view class="page">
  <view class="hero hero-navy">
    <view class="eyebrow">老师印象</view>
    <view class="hero-title-row">
      <view class="title-icon tone-green"><pp-icon name="user" :size="34" motion="pop" /></view>
      <text class="hero-title">在老师印象中的孩子</text>
    </view>
    <view class="gold-rule"></view>
    <text class="hero-sub">{{ teacherName }}为你生成</text>
  </view>

  <view v-if="loading" class="state-card"><pp-state type="loading" title="正在读取老师印象" /></view>
  <view v-else-if="error" class="state-card"><pp-state type="error" title="印象加载失败" :description="error" action-text="重新加载" @action="loadData" /></view>
  <view v-else-if="!profile" class="state-card"><pp-state title="老师还未填写印象" description="完成阶段记录后，老师会在这里分享观察与建议。" /></view>

  <view v-else class="card profile-card">
    <view class="tags-row">
      <text v-for="t in profile.tags" :key="t" class="tag">{{ t }}</text>
    </view>
    <view class="section">
      <view class="s-label"><pp-icon name="user" :size="24" /><text>关于 TA</text></view>
      <text class="s-text">{{ profile.personality }}</text>
    </view>
    <view class="section">
      <view class="s-label"><pp-icon name="trophy" :size="24" /><text>学习优势</text></view>
      <text class="s-text">{{ profile.strengths }}</text>
    </view>
    <view class="section">
      <view class="s-label"><pp-icon name="target" :size="24" /><text>成长空间</text></view>
      <text class="s-text">{{ profile.weaknesses }}</text>
    </view>
    <view class="section highlight">
      <view class="s-label"><pp-icon name="lightbulb" :size="24" /><text>给家长的建议</text></view>
      <text class="s-text">{{ profile.suggestion }}</text>
    </view>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
import { teacherNameFromChild } from '@/utils/brand';
export default {
  data(){return{profile:null,teacherName:'孩子的老师',loading:false,error:''};},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      if(this.loading)return;
      this.loading=true;
      this.error='';
      try{
        const kids=await api.get('/bind/students');
        const activeId=String(uni.getStorageSync('activeChildId')||'');
        const child=(kids.students||[]).find(k=>String(k.id)===activeId)||(kids.students||[])[0];
        const r=await api.get(child?.id?'/profiles/'+child.id:'/profiles/my');
        this.profile=r.profile;
        if(this.profile){
          let tags=this.profile.tags;
          if(typeof tags==='string'){try{tags=JSON.parse(tags);}catch(e){tags=[];}}
          this.profile={...this.profile,tags:Array.isArray(tags)?tags:[]};
        }
        this.teacherName=teacherNameFromChild(child);
      }
      catch(e){this.error=e?.error||'请检查网络后重试';logError('parentProfile.loadData',e);}
      finally{this.loading=false;}
    }
  }
};
</script>

<style scoped>
.page {
  --panpan-green: #20B486;
  --panpan-green-strong: #15946D;
  --panpan-sprout: #20B486;
  --panpan-coral: #FF7468;
  --panpan-leaf: #15946D;
  --panpan-paper: #F8FCF9;
  --panpan-ink: #26352F;
  --panpan-muted: #5A6A62;
  min-height: 100vh;
  padding-bottom: calc(54rpx + env(safe-area-inset-bottom));
  background: var(--panpan-paper);
}
.hero {
  padding: 38rpx 32rpx 30rpx;
  border-bottom: 1rpx solid #D4E9DC;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(32, 180, 134, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E7F8F1 100%);
  text-align: left;
  animation: profile-enter var(--motion-slow) var(--ease-out) both;
}
.hero .eyebrow {
  display: inline-flex;
  padding: 5rpx 12rpx;
  border-radius: 7rpx;
  background: #E7F8F1;
  color: var(--panpan-green-strong);
  font-size: 20rpx;
  font-weight: 720;
  letter-spacing: 0;
}
.hero .gold-rule { width: 86rpx; height: 7rpx; display: block; margin-top: 15rpx; border-radius: 4rpx; background: var(--panpan-sprout); }
.hero-title-row { display: flex; align-items: center; gap: 12rpx; margin-top: 9rpx; }
.title-icon { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; flex: none; border-radius: 10rpx; }
.title-icon.tone-green { background: #E7F8F1; }
.hero-title { color: var(--panpan-ink); font-size: 39rpx; font-weight: 770; }
.hero-sub { display: block; margin-top: 7rpx; color: var(--panpan-muted); font-size: 23rpx; }
.state-card { margin: 20rpx 24rpx; border: 1rpx solid #D4E9DC; border-radius: 14rpx; background: #FFFFFF; box-shadow: 0 8rpx 20rpx rgba(36, 48, 41, .06); }

.profile-card {
  margin: 20rpx 24rpx;
  padding: 28rpx;
  border: 1rpx solid #CFE6D8;
  border-top: 6rpx solid var(--panpan-green);
  border-radius: 16rpx;
  background: #FFFFFF;
  color: var(--panpan-ink);
  box-shadow: 0 10rpx 24rpx rgba(36, 48, 41, .07);
  animation: profile-card-enter var(--motion-slow) var(--ease-out) both;
}

.tags-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin-bottom: 26rpx; }
.tag { padding: 7rpx 15rpx; border: 1rpx solid rgba(32, 180, 134, .26); border-radius: 8rpx; background: #E7F8F1; color: var(--panpan-green-strong); font-size: 23rpx; font-weight: 650; }
.tag:nth-child(3n+2) { border-color: rgba(32, 180, 134, .25); background: #E7F8F1; color: #15946D; }
.tag:nth-child(3n) { border-color: rgba(32, 180, 134, .46); background: #E7F8F1; color: #15946D; }
.section { margin-bottom: 23rpx; padding-bottom: 21rpx; border-bottom: 1rpx dashed #D4E9DC; }
.section:last-child { margin-bottom: 0; border-bottom: 0; }
.section.highlight { padding: 18rpx; border: 1rpx solid rgba(255, 116, 104, .22); border-left: 5rpx solid var(--panpan-coral); border-radius: 10rpx; background: #FFF3F1; }
.s-label { display: flex; align-items: center; gap: 7rpx; margin-bottom: 7rpx; color: var(--panpan-green-strong); font-size: 23rpx; font-weight: 700; }
.highlight .s-label { color: #D94B45; }
.s-text { color: #5A6A62; font-size: 27rpx; line-height: 1.72; }
.empty { padding: 34rpx; color: var(--panpan-muted); font-size: 27rpx; text-align: center; }

@keyframes profile-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes profile-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .profile-card { animation: none; }
}
</style>
