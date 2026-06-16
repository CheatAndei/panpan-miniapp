<template>
<view class="page">
  <view class="hero">
    <text class="hero-title">AI 学习画像</text>
    <text class="hero-sub">潘潘老师为你生成</text>
  </view>

  <view v-if="!profile" class="card"><view class="empty">老师还未生成画像</view></view>

  <view v-else class="card profile-card">
    <view class="tags-row">
      <text v-for="t in profile.tags" :key="t" class="tag">{{ t }}</text>
    </view>
    <view class="section">
      <text class="s-label">🧠 关于TA</text>
      <text class="s-text">{{ profile.personality }}</text>
    </view>
    <view class="section">
      <text class="s-label">💪 学习优势</text>
      <text class="s-text">{{ profile.strengths }}</text>
    </view>
    <view class="section">
      <text class="s-label">🌱 成长空间</text>
      <text class="s-text">{{ profile.weaknesses }}</text>
    </view>
    <view class="section highlight">
      <text class="s-label">💡 给家长的建议</text>
      <text class="s-text">{{ profile.suggestion }}</text>
    </view>
  </view>
</view>
</template>

<script>
import BASE, { ASSET_BASE } from '@/utils/config';
export default {
  data(){return{profile:null};},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      try{const r=await this.req('/profiles/my');this.profile=r.profile;}
      catch(e){}
    },
    req(p,m='GET',d){const t=uni.getStorageSync('token');return new Promise((resolve,reject)=>{uni.request({url:BASE+p,method:m,data:d,header:{Authorization:`Bearer ${t}`},success(r){if(r.statusCode===200)resolve(r.data);else reject(r.data);},fail:reject});});}
  }
};
</script>

<style scoped>
.page{padding-bottom:60rpx}
.hero{padding:40rpx 30rpx;background:#fff;border-bottom:1rpx solid #EDF2F7;text-align:center}
.hero-title{font-size:40rpx;font-weight:700;display:block}
.hero-sub{font-size:24rpx;opacity:.7;margin-top:4rpx}
.profile-card{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:20rpx;margin:20rpx}
.tags-row{display:flex;flex-wrap:wrap;gap:12rpx;margin-bottom:30rpx}
.tag{background:rgba(255,255,255,.2);color:#fff;font-size:24rpx;padding:8rpx 20rpx;border-radius:24rpx}
.section{margin-bottom:24rpx}
.section.highlight{background:rgba(255,255,255,.15);padding:20rpx;border-radius:14rpx}
.s-label{font-size:26rpx;opacity:.8;display:block;margin-bottom:8rpx}
.s-text{font-size:28rpx;line-height:1.7}
.empty{text-align:center;color:#CBD5E0;padding:40rpx;font-size:28rpx}
</style>
