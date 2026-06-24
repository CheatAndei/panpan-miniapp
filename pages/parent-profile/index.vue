<template>
<view class="page">
  <view class="hero hero-navy">
    <view class="eyebrow">AI 画像</view>
    <text class="hero-title">AI 学习画像</text>
    <view class="gold-rule"></view>
    <text class="hero-sub">潘潘老师为你生成</text>
  </view>

  <view v-if="!profile" class="card"><view class="empty">老师还未生成画像</view></view>

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
export default {
  data(){return{profile:null};},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      try{const r=await api.get('/profiles/my');this.profile=r.profile;}
      catch(e){logError('parentProfile.loadData',e);}
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:60rpx}
.hero{padding:52rpx 32rpx 40rpx;text-align:center}
.hero .gold-rule{margin:16rpx auto}
.hero-title{font-size:40rpx;font-weight:700;color:#fff;display:block}
.hero-sub{font-size:24rpx;color:rgba(255,255,255,.72);margin-top:4rpx}
.profile-card{background:linear-gradient(150deg,#244271,#1A365D 55%,#10243F);color:#fff;border-radius:24rpx;margin:24rpx;box-shadow:0 16rpx 40rpx rgba(26,54,93,.18)}
.tags-row{display:flex;flex-wrap:wrap;gap:12rpx;margin-bottom:30rpx}
.tag{background:rgba(255,255,255,.2);color:#fff;font-size:24rpx;padding:8rpx 20rpx;border-radius:24rpx}
.section{margin-bottom:24rpx}
.section.highlight{background:rgba(255,255,255,.15);padding:20rpx;border-radius:14rpx}
.s-label{font-size:24rpx;color:#E6BE6A;letter-spacing:1rpx;display:block;margin-bottom:8rpx}
.s-text{font-size:28rpx;line-height:1.7}
.empty{text-align:center;color:#CBD5E0;padding:40rpx;font-size:28rpx}
</style>
