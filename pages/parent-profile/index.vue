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
.page{padding-bottom:calc(60rpx + env(safe-area-inset-bottom))}
.hero{padding:48rpx 34rpx 38rpx;text-align:left}
.hero .gold-rule{display:none}
.hero-title{font-size:40rpx;font-weight:760;color:var(--ink);display:block;margin-top:8rpx}
.hero-sub{font-size:24rpx;color:#697B76;margin-top:4rpx}
.state-card{margin:22rpx 24rpx;background:#fff;border-radius:22rpx;border:1rpx solid var(--border)}
.profile-card{background:#FFFFFF;color:var(--ink);border-radius:22rpx;margin:24rpx;border:1rpx solid var(--border);box-shadow:var(--shadow-sm)}
.tags-row{display:flex;flex-wrap:wrap;gap:12rpx;margin-bottom:30rpx}
.tag{background:var(--accent-soft);color:var(--accent-strong);font-size:24rpx;padding:8rpx 18rpx;border-radius:11rpx}
.section{margin-bottom:24rpx}
.section.highlight{background:var(--accent-soft);padding:22rpx;border-radius:17rpx}
.s-label{font-size:24rpx;color:var(--accent-strong);display:block;margin-bottom:8rpx;font-weight:650}
.s-text{font-size:28rpx;line-height:1.75;color:var(--text-secondary)}
.empty{text-align:center;color:#A4B1AD;padding:40rpx;font-size:28rpx}
</style>
