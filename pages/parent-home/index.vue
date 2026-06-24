<template>
<view class="page">
  <view v-if="loading" class="loading">加载中…</view>
  <!-- 孩子卡片 -->
  <view class="hero hero-navy" v-if="child">
    <pp-avatar :name="child.name" :size="128" class="avatar" />
    <text class="child-name">{{ child.name }}</text>
    <text class="child-class">{{ child.className }}</text>
  </view>

  <!-- 签到 -->
  <view class="card" v-if="todayCheckin">
    <view :class="['checkin-badge', todayCheckin.checkedIn?'in':'out']">
      <view :class="['i-dot',todayCheckin.checkedIn?'green':'amber']"></view>
      {{ todayCheckin.checkedIn ? '今日已签到 '+todayCheckin.checkInTime : '等待签到' }}
    </view>
  </view>

  <!-- 学习小组详情入口 -->
  <view class="card" @tap="nav('/pages/parent-schedule/index')">
    <view class="card-head">
      <text class="card-title">学习小组详情</text>
      <text class="card-arrow">查看完整课表</text>
    </view>
    <view v-if="schedules.length===0" class="empty-sm">暂无学习安排</view>
    <view v-for="s in schedules" :key="s.id" class="sc-line">
      <text class="sc-day">{{ dayNames[s.day_of_week] }}</text>
      <text class="sc-time">{{ s.start_time }}-{{ s.end_time }}</text>
      <text class="sc-name">{{ s.title||s.class_name }}</text>
    </view>
  </view>

  <!-- 最新反馈 -->
  <view class="card" @tap="nav('/pages/parent-feedback/index')" v-if="feedback">
    <view class="card-head">
      <text class="card-title">最新反馈</text>
      <text class="card-arrow">查看全部</text>
    </view>
    <text class="fb-date">{{ feedback.class_date }}</text>
    <text class="fb-text">{{ (feedback.summary||'').slice(0,120) }}{{ feedback.summary&&feedback.summary.length>120?'...':'' }}</text>
    <!-- 图片预览 -->
    <view v-if="fbImages.length>0" class="fb-images">
      <image v-for="(img,i) in fbImages.slice(0,4)" :key="i" :src="img" mode="aspectFill" class="fb-img" @tap.stop="previewImg(i)" />
      <view v-if="fbImages.length>4" class="img-more">+{{ fbImages.length-4 }}</view>
    </view>
    <text v-if="feedback.homework" class="fb-hw">作业：{{ feedback.homework }}</text>
  </view>

  <view class="card" v-else>
    <view class="card-title">最新反馈</view>
    <view class="empty-sm">暂无反馈</view>
  </view>

  <!-- AI 画像入口 -->
  <view class="card" @tap="nav('/pages/mine/index')">
    <view class="card-head">
      <text class="card-title">AI 学习画像</text>
      <text class="card-arrow">查看详情</text>
    </view>
    <view v-if="profile" class="tags">
      <text v-for="t in (profile.tags||[])" :key="t" class="tag tag-blue">{{ t }}</text>
    </view>
    <view v-else class="empty-sm">老师还未生成画像</view>
  </view>

  <view class="card">
    <button class="btn-outline" @tap="nav('/pages/parent-leave/index')">请假申请</button>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
export default {
  data(){return{
    child:null,todayCheckin:null,schedules:[],feedback:null,profile:null,loading:false,
    dayNames:['周日','周一','周二','周三','周四','周五','周六'],fbImages:[]
  };},
  onShow(){this.loadData();},
  methods:{
    async loadData(){
      const t=uni.getStorageSync('token');if(!t)return;
      this.loading=true;
      try{
        const [s,c,sc,f,p]=await Promise.all([
          api.get('/bind/student'),api.get('/checkins/today'),
          api.get('/schedules'),api.get('/feedbacks/latest'),api.get('/profiles/my')
        ]);
        this.child=s.student;this.todayCheckin=c;
        this.schedules=(sc.schedules||[]).slice(0,3);
        this.feedback=f.feedback;this.profile=p.profile;
        if(this.feedback&&this.feedback.image_urls){
          try{this.fbImages=JSON.parse(this.feedback.image_urls).map(u=>api.assetUrl(u));}catch(e){this.fbImages=[];}
        }
      }catch(e){logError('parentHome.loadData',e);}
      finally{this.loading=false;}
    },
    previewImg(i){uni.previewImage({current:this.fbImages[i],urls:this.fbImages});},
    nav(url){uni.navigateTo({url});}
  }
};
</script>

<style scoped>
.page{padding-bottom:40rpx}
.hero{display:flex;flex-direction:column;align-items:center;padding:56rpx 0 44rpx}
.avatar{margin-bottom:8rpx}
.child-name{font-size:36rpx;font-weight:700;color:#fff;margin-top:14rpx}
.child-class{font-size:24rpx;color:rgba(255,255,255,.72);margin-top:4rpx}

.checkin-badge{display:flex;align-items:center;gap:10rpx;padding:16rpx 20rpx;border-radius:10rpx;font-size:28rpx;font-weight:600}
.checkin-badge.in{background:#F0FFF4;color:#276749}
.checkin-badge.out{background:#FFFFF0;color:#975A16}

.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14rpx}
.card-title{font-size:28rpx;font-weight:700;color:#1A365D}
.card-arrow{font-size:24rpx;color:#A0AEC0}

.sc-line{display:flex;gap:12rpx;padding:8rpx 0;font-size:26rpx;align-items:center}
.sc-day{color:#D69E2E;font-weight:600;width:64rpx;font-size:24rpx}
.sc-time{color:#A0AEC0;width:120rpx;font-size:24rpx}
.sc-name{color:#4A5568}

.fb-date{font-size:24rpx;color:#A0AEC0;margin-bottom:8rpx}
.fb-text{font-size:28rpx;color:#4A5568;line-height:1.6;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
.fb-images{display:flex;gap:10rpx;margin-top:14rpx;flex-wrap:wrap}
.fb-img{width:150rpx;height:150rpx;border-radius:8rpx;background:#F0F0F0}
.img-more{width:150rpx;height:150rpx;border-radius:8rpx;background:#F7F8FA;display:flex;align-items:center;justify-content:center;font-size:36rpx;color:#A0AEC0}
.fb-hw{font-size:24rpx;color:#D69E2E;margin-top:10rpx}

.tags{display:flex;gap:10rpx;flex-wrap:wrap}
.empty-sm{text-align:center;color:#CBD5E0;padding:24rpx;font-size:26rpx}

.btn-outline{border:1px solid #1A365D;color:#1A365D;background:#fff;border-radius:10rpx;padding:20rpx;font-size:28rpx;width:100%;font-weight:600}
</style>
