<template>
<view class="page">
  <view class="hero hero-navy">
    <view class="eyebrow">老师印象</view>
    <text class="hero-title">在老师印象中的孩子</text>
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
      <text class="s-label">关于 TA</text>
      <text class="s-text">{{ profile.personality }}</text>
    </view>
    <view class="section">
      <text class="s-label">学习优势</text>
      <text class="s-text">{{ profile.strengths }}</text>
    </view>
    <view class="section">
      <text class="s-label">成长空间</text>
      <text class="s-text">{{ profile.weaknesses }}</text>
    </view>
    <view class="section highlight">
      <text class="s-label">给家长的建议</text>
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
.page { min-height: 100vh; padding-bottom: calc(60rpx + env(safe-area-inset-bottom)); background: var(--page-bg); }
.hero { padding: 48rpx 34rpx 38rpx; text-align: left; animation: profile-enter var(--motion-slow) var(--ease-out) both; }
.hero .gold-rule { display: block; margin-top: 18rpx; }
.hero-title { display: block; margin-top: 8rpx; color: var(--ink); font-size: 40rpx; font-weight: 760; }
.hero-sub { display: block; margin-top: 8rpx; color: var(--text-muted); font-size: 24rpx; }
.state-card { margin: 22rpx 24rpx; border: 1rpx solid var(--border); border-radius: var(--r); background: var(--surface); box-shadow: var(--shadow-sm); }

.profile-card {
  margin: 24rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  animation: profile-card-enter var(--motion-slow) var(--ease-out) both;
}

.tags-row { display: flex; flex-wrap: wrap; gap: 12rpx; margin-bottom: 30rpx; }
.tag { padding: 8rpx 18rpx; border-radius: var(--r-xs); background: var(--primary-soft); color: var(--primary-strong); font-size: 24rpx; font-weight: 650; }
.tag:nth-child(3n+2) { background: var(--success-soft); color: var(--success); }
.tag:nth-child(3n) { background: var(--warning-soft); color: var(--warning); }
.section { margin-bottom: 26rpx; padding-bottom: 24rpx; border-bottom: 1rpx dashed var(--border); }
.section:last-child { margin-bottom: 0; border-bottom: 0; }
.section.highlight { padding: 22rpx; border: 1rpx solid #E8D28A; border-radius: var(--r-sm); background: var(--warning-soft); }
.s-label { display: block; margin-bottom: 8rpx; color: var(--primary-strong); font-size: 24rpx; font-weight: 680; }
.highlight .s-label { color: var(--warning); }
.s-text { color: var(--text-secondary); font-size: 28rpx; line-height: 1.75; }
.empty { padding: 40rpx; color: var(--text-muted); font-size: 28rpx; text-align: center; }

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
