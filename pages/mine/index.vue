<template>
<view class="page">
  <view v-if="!user.role" class="card" style="margin-top:200rpx;text-align:center">
    <text class="empty-hint" @tap="goLogin">请先登录</text>
  </view>
  <template v-else>
  <!-- 用户卡片 -->
  <view class="user-card hero-navy">
    <pp-avatar v-if="user.role==='parent'" :name="studentName" :size="128" class="parent-avatar" />
    <image v-else src="/static/pantouxiang.png" class="teacher-avatar" mode="aspectFill" />
    <text class="name">{{ user.role==='teacher' ? '潘潘老师' : (childName||'家长') }}</text>
    <text class="role-tag">{{ user.role==='teacher' ? '教师端' : '家长端' }}</text>
  </view>

  <!-- 家长：AI 画像 -->
  <view class="card profile-section" v-if="user.role==='parent' && profile">
    <text class="section-title">AI 学习画像</text>

    <!-- 人物 + 标签 -->
    <view class="character-area">
      <pp-avatar :name="studentName" :size="160" />
      <view class="tag-cloud">
        <text v-for="(t,i) in profile.tags" :key="i" :class="['profile-tag',tagColor(i)]">{{ t }}</text>
      </view>
    </view>

    <!-- 三个信息框 -->
    <view class="info-grid">
      <view class="info-box">
        <view class="info-label">关于 TA</view>
        <text class="info-text">{{ profile.personality }}</text>
      </view>
      <view class="info-box">
        <view class="info-label">学习优势</view>
        <text class="info-text">{{ profile.strengths }}</text>
      </view>
      <view class="info-box">
        <view class="info-label">成长空间</view>
        <text class="info-text">{{ profile.weaknesses }}</text>
      </view>
    </view>
  </view>

  <view class="card" v-if="user.role==='parent' && !profile">
    <view class="empty-hint">老师还未生成 AI 画像</view>
  </view>

  <!-- 操作区 -->
  <view class="card actions" v-if="user.role==='parent'">
    <view class="action-row" @tap="nav('/pages/bind/bind')">
      <text>绑定其他孩子</text>
      <text class="arrow">›</text>
    </view>
  </view>

  <view class="card actions">
    <view class="action-row" @tap="logout">
      <text>退出登录</text>
      <text class="arrow">›</text>
    </view>
  </view>

  <view class="brand">番番记录 v1.0.0</view>
  </template>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
export default {
  data(){return{
    user:{},profile:null,childName:'',studentName:''
  };},
  onShow(){this.loadData();},
  methods:{
    loadData(){
      try{this.user=JSON.parse(uni.getStorageSync('user')||'{}');}catch(e){this.user={};}
      if(this.user.role==='parent'){this.loadProfile();}
    },
    async loadProfile(){
      try{
        const cid=uni.getStorageSync('activeChildId');
        const data=await api.get(cid?'/profiles/'+cid:'/profiles/my');
        this.profile=data.profile;
        // tags 可能是 JSON 字符串，统一成数组，避免 v-for 逐字符渲染
        if(this.profile){
          let tags=this.profile.tags;
          if(typeof tags==='string'){try{tags=JSON.parse(tags);}catch(e){tags=[];}}
          this.profile.tags=Array.isArray(tags)?tags:[];
        }
        // 取学生姓名用于头像与称呼
        let s=null;
        if(cid){try{s=(await api.get('/students/'+cid)).student;}catch(e){logError('mine.student',e);}}
        if(!s){try{s=(await api.get('/bind/student')).student;}catch(e){logError('mine.bindStudent',e);}}
        if(s){this.studentName=s.name||'';this.childName=(s.name||'')+'家长';}
      }catch(e){logError('mine.loadProfile',e);}
    },
    goLogin(){uni.switchTab({url:'/pages/index/index'});},
    nav(url){uni.navigateTo({url});},
    tagColor(i){const cs=['tag-c0','tag-c1','tag-c2','tag-c3','tag-c4','tag-c5'];return cs[i%cs.length];},
    logout(){
      uni.showModal({title:'退出',content:'确定退出？',success:r=>{if(r.confirm){uni.clearStorageSync();uni.reLaunch({url:'/pages/index/index'});}}});
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:60rpx}
.user-card{display:flex;flex-direction:column;align-items:center;padding:56rpx 0 44rpx}
.parent-avatar{margin-bottom:8rpx}
.teacher-avatar{width:120rpx;height:120rpx;border-radius:50%;box-shadow:0 4rpx 16rpx rgba(0,0,0,.2),inset 0 0 0 2rpx rgba(255,255,255,.55)}
.name{font-size:36rpx;font-weight:700;color:#fff;margin-top:16rpx}
.role-tag{font-size:22rpx;background:rgba(255,255,255,.16);color:#fff;padding:6rpx 18rpx;border-radius:20rpx;margin-top:10rpx;letter-spacing:1rpx}

.profile-section{padding-bottom:32rpx}
.section-title{font-size:30rpx;font-weight:700;color:#1A365D;margin-bottom:24rpx}

/* 人物 + 标签（去掉旋转动画，改为清晰的静态布局） */
.character-area{display:flex;flex-direction:column;align-items:center;gap:24rpx;margin-bottom:32rpx}
.tag-cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:12rpx}
.profile-tag{font-size:24rpx;padding:8rpx 20rpx;border-radius:24rpx;font-weight:600}
.tag-c0{background:#EBF0F7;color:#1A365D}.tag-c1{background:#FEF5E7;color:#975A16}
.tag-c2{background:#EBF8FF;color:#2A4365}.tag-c3{background:#FFF7E6;color:#B7791F}
.tag-c4{background:#F0FFF4;color:#276749}.tag-c5{background:#EDF2F7;color:#4A5568}

/* 三个信息框 */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}
.info-box{background:#F7F8FA;border-radius:14rpx;padding:24rpx}
.info-box:first-child{grid-column:1/-1}
.info-label{font-size:26rpx;font-weight:700;color:#1A365D;margin-bottom:12rpx}
.info-text{font-size:26rpx;line-height:1.7;color:#4A5568}

.empty-hint{text-align:center;color:#CBD5E0;padding:30rpx;font-size:28rpx}

.actions{margin-top:12rpx}
.action-row{display:flex;justify-content:space-between;align-items:center;font-size:28rpx;padding:12rpx 0}
.arrow{font-size:32rpx;color:#CBD5E0}

.brand{text-align:center;color:#CBD5E0;font-size:22rpx;padding:30rpx 0 20rpx}
.empty-hint{color:#1A365D;font-size:32rpx}
</style>
