<template>
<view class="page">
  <view v-if="!user.role" class="card" style="margin-top:200rpx;text-align:center">
    <text class="empty-hint" @tap="goLogin">请先登录</text>
  </view>
  <template v-else>
  <!-- 用户卡片 -->
  <view class="user-card">
    <image v-if="user.role==='parent'" src="/static/av-parent.png" class="parent-avatar" mode="aspectFit" />
    <image v-else src="/static/pantouxiang.png" class="teacher-avatar" mode="aspectFill" />
    <text class="name">{{ user.role==='teacher' ? '潘潘老师' : (childName||'家长') }}</text>
    <text class="role-tag">{{ user.role==='teacher' ? '教师端' : '家长端' }}</text>
  </view>

  <!-- 家长：AI 画像 -->
  <view class="card profile-section" v-if="user.role==='parent' && profile">
    <text class="section-title">AI 学习画像</text>

    <!-- 人物 + 漂浮标签 -->
    <view class="character-area">
      <view class="orbit-container">
        <view class="orbit-track">
          <text v-for="(t,i) in profile.tags" :key="i"
            :class="['float-tag',tagColor(i)]"
            :style="{transform:'rotate('+(i*360/profile.tags.length)+'deg) translateY(-160rpx)'}">
            {{ t }}
          </text>
        </view>
      </view>
      <view class="character-center">
        <image :src="charImg" class="char-img" mode="aspectFit"
          @error="charImg=gender==='girl'?'/static/default-girl.png':'/static/default-boy.png'" />
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

  <view class="brand">番番记录 v1</view>
  </template>
</view>
</template>

<script>
import BASE, { ASSET_BASE } from '@/utils/config';
import { getStudentAvatar } from '@/utils/traits';
export default {
  data(){return{
    user:{},profile:null,childName:'',charImg:'/static/av-study.png',gender:'boy'
  };},
  onShow(){this.loadData();},
  methods:{
    req(p,m='GET',d){const t=uni.getStorageSync('token');return new Promise((r,j)=>{uni.request({url:BASE+p,method:m,data:d,header:{Authorization:`Bearer ${t}`},success(res){if(res.statusCode===200)r(res.data);else j(res.data);},fail:j});});},
    loadData(){
      try{this.user=JSON.parse(uni.getStorageSync('user')||'{}');}catch(e){this.user={};}
      if(this.user.role==='parent'){this.loadProfile();}
    },
    async loadProfile(){
      try{
        const t=uni.getStorageSync('token');
        const cid=uni.getStorageSync('activeChildId');
        const url=cid?BASE+'/profiles/'+cid:BASE+'/profiles/my';
        const p=new Promise((r,j)=>{uni.request({url,header:{Authorization:`Bearer ${t}`},success(res){if(res.statusCode===200)r(res.data);else j(res.data);},fail:j});});
        const data=await p;
        this.profile=data.profile;
        // 匹配头像：tags 可能是 JSON 字符串
        let tagArr = data.profile?.tags || [];
        if (typeof tagArr === 'string') { try { tagArr = JSON.parse(tagArr); } catch(e) { tagArr = []; } }
        // 获取学生性格+性别，统一匹配
        let personality='',gender='boy';
        let s=null;
        if(cid){try{s=(await this.req('/students/'+cid)).student;}catch(e){}}
        if(!s){try{s=(await this.req('/bind/student')).student;}catch(e){}}
        if(s){personality=s.personality||'';gender=s.gender||'boy';this.gender=gender;this.childName=s.name+'家长'||'';}
        this.charImg = getStudentAvatar(personality, tagArr, gender);
      }catch(e){}
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
.user-card{display:flex;flex-direction:column;align-items:center;padding:40rpx 0 30rpx}
.parent-avatar{width:120rpx;height:120rpx;border-radius:50%;margin-bottom:16rpx}
.teacher-avatar{width:100rpx;height:100rpx;border-radius:50%}
.name{font-size:34rpx;font-weight:700;color:#1A365D;margin-top:16rpx}
.role-tag{font-size:22rpx;background:#EBF0F7;color:#1A365D;padding:4rpx 16rpx;border-radius:10rpx;margin-top:8rpx}

.profile-section{padding-bottom:32rpx}
.section-title{font-size:30rpx;font-weight:700;color:#1A365D;margin-bottom:24rpx}

/* 人物+漂浮标签 */
.character-area{position:relative;height:420rpx;display:flex;align-items:center;justify-content:center;margin-bottom:32rpx}
.orbit-container{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.orbit-track{width:320rpx;height:320rpx;border-radius:50%;border:1rpx dashed #E2E8F0;position:relative;animation:spin 20s linear infinite}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.float-tag{position:absolute;left:50%;top:50%;transform-origin:0 0;white-space:nowrap;font-size:22rpx;padding:6rpx 14rpx;border-radius:14rpx;font-weight:600}
.tag-c0{background:#EBF0F7;color:#1A365D}.tag-c1{background:#FFF0F0;color:#9B2C2C}
.tag-c2{background:#EBF8FF;color:#2A4365}.tag-c3{background:#FFFFF0;color:#975A16}
.tag-c4{background:#F0FFF4;color:#276749}.tag-c5{background:#FAF5FF;color:#553C9A}
.character-center{width:160rpx;height:160rpx;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;z-index:1;box-shadow:0 4rpx 16rpx rgba(26,54,93,.12)}
.char-img{width:140rpx;height:140rpx}

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
