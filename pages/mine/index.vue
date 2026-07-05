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

  <!-- 家长：老师印象 -->
  <view class="card profile-section" v-if="user.role==='parent' && profile">
    <text class="section-title">在老师印象中的孩子</text>

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
    <view class="empty-hint">老师还未填写印象</view>
  </view>

  <!-- 操作区 -->
  <view class="card actions" v-if="user.role==='parent'">
    <view v-for="kid in boundKids" :key="kid.id" class="bind-row">
      <view>
        <text class="bind-name">{{ kid.name }}</text>
        <text class="bind-class">{{ kid.className || '已绑定学生' }}</text>
      </view>
      <button class="btn-unbind" @tap.stop="unbind(kid)">解除绑定</button>
    </view>
    <view class="action-row" @tap="nav('/pages/bind/bind')">
      <text>绑定其他孩子</text>
      <text class="arrow">›</text>
    </view>
  </view>

  <view class="card notify-card" v-if="user.role==='teacher' && notifyStatus">
    <text class="section-title">老师称呼</text>
    <input v-model="teacherNickname" class="input" placeholder="例如：潘潘" />
    <button class="btn-primary" @tap="saveTeacherName">保存称呼</button>
  </view>

  <view class="card notify-card" v-if="user.role==='teacher' && notifyStatus">
    <text class="section-title">服务通知配置</text>
    <view class="notify-row"><text>小程序 AppID</text><text :class="notifyStatus.appId?'ok':'bad'">{{ notifyStatus.appId?'已配置':'未配置' }}</text></view>
    <view class="notify-row"><text>小程序密钥</text><text :class="notifyStatus.appSecret?'ok':'bad'">{{ notifyStatus.appSecret?'已配置':'未配置' }}</text></view>
    <view class="notify-row"><text>签到提醒</text><text :class="notifyStatus.templates?.checkin?'ok':'bad'">{{ notifyStatus.templates?.checkin?'已配置':'未配置' }}</text></view>
    <view class="notify-row"><text>签退提醒</text><text :class="notifyStatus.templates?.checkout?'ok':'bad'">{{ notifyStatus.templates?.checkout?'已配置':'未配置' }}</text></view>
    <view class="notify-row"><text>课后反馈</text><text :class="notifyStatus.templates?.feedback?'ok':'bad'">{{ notifyStatus.templates?.feedback?'已配置':'未配置' }}</text></view>
    <view class="notify-row"><text>上课提醒</text><text :class="notifyStatus.templates?.reminder?'ok':'bad'">{{ notifyStatus.templates?.reminder?'已配置':'未配置' }}</text></view>
  </view>

  <view class="card actions">
    <view class="action-row" @tap="logout">
      <text>退出登录</text>
      <text class="arrow">›</text>
    </view>
  </view>

  <view class="brand">番番记录 v1.0.0<br/>桂ICP备2026013218号-2</view>
  </template>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { logError } from '@/utils/ui';
export default {
  data(){return{
    user:{},profile:null,childName:'',studentName:'',notifyStatus:null,teacherNickname:'',boundKids:[]
  };},
  onShow(){this.loadData();},
  methods:{
    loadData(){
      try{this.user=JSON.parse(uni.getStorageSync('user')||'{}');}catch(e){this.user={};}
      if(this.user.role==='parent'){this.loadProfile();this.loadBoundKids();}
      if(this.user.role==='teacher'){this.loadTeacherProfile();this.loadNotifyStatus();}
    },
    async loadTeacherProfile(){
      try{
        const data=await api.get('/auth/me');
        if(data.user){this.user={...this.user,...data.user};this.teacherNickname=(data.user.nickname||'').replace(/老师$/,'');uni.setStorageSync('user',JSON.stringify(this.user));}
      }catch(e){logError('mine.teacherProfile',e);}
    },
    async saveTeacherName(){
      const nickname=(this.teacherNickname||'').trim();
      if(!nickname)return uni.showToast({title:'请填写称呼',icon:'none'});
      try{
        const data=await api.put('/auth/me',{nickname});
        this.user={...this.user,...data.user};
        uni.setStorageSync('user',JSON.stringify(this.user));
        uni.showToast({title:'已保存',icon:'success'});
      }catch(e){uni.showToast({title:'保存失败',icon:'none'});}
    },
    async loadNotifyStatus(){
      try{this.notifyStatus=await api.get('/notify/status');}
      catch(e){logError('mine.notifyStatus',e);}
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
    async loadBoundKids(){
      try{const data=await api.get('/bind/students');this.boundKids=data.students||[];}
      catch(e){logError('mine.boundKids',e);}
    },
    async unbind(kid){
      uni.showModal({title:'解除绑定',content:'确定解除和 '+kid.name+' 的绑定？解除后可用邀请码重新绑定。',success:async r=>{
        if(!r.confirm)return;
        try{
          await api.del('/bind/'+kid.id);
          if(String(uni.getStorageSync('activeChildId')||'')===String(kid.id))uni.removeStorageSync('activeChildId');
          uni.showToast({title:'已解除绑定',icon:'success'});
          this.loadData();
        }catch(e){uni.showToast({title:e?.error||'解除失败',icon:'none'});}
      }});
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
.teacher-avatar{width:120rpx;height:120rpx;border-radius:50%;box-shadow:0 4rpx 14rpx rgba(36,42,50,.10),inset 0 0 0 2rpx rgba(255,255,255,.7)}
.name{font-size:36rpx;font-weight:700;color:#202733;margin-top:16rpx}
.role-tag{font-size:22rpx;background:#F3F1EA;color:#69717D;padding:6rpx 18rpx;border-radius:20rpx;margin-top:10rpx;letter-spacing:1rpx}

.profile-section{padding-bottom:32rpx}
.section-title{font-size:30rpx;font-weight:700;color:#202733;margin-bottom:24rpx}

/* 人物 + 标签（去掉旋转动画，改为清晰的静态布局） */
.character-area{display:flex;flex-direction:column;align-items:center;gap:24rpx;margin-bottom:32rpx}
.tag-cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:12rpx}
.profile-tag{font-size:24rpx;padding:8rpx 20rpx;border-radius:24rpx;font-weight:600}
.tag-c0{background:#F3F1EA;color:#202733}.tag-c1{background:#F7F1E7;color:#7B5B36}
.tag-c2{background:#EFF3F2;color:#52707E}.tag-c3{background:#F7F1E7;color:#8D6A3F}
.tag-c4{background:#EEF5EF;color:#3F7A5B}.tag-c5{background:#EFEDE7;color:#46515C}

/* 三个信息框 */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}
.info-box{background:#F8F6F1;border-radius:14rpx;padding:24rpx}
.info-box:first-child{grid-column:1/-1}
.info-label{font-size:26rpx;font-weight:700;color:#202733;margin-bottom:12rpx}
.info-text{font-size:26rpx;line-height:1.7;color:#46515C}

.empty-hint{text-align:center;color:#C3C1BA;padding:30rpx;font-size:28rpx}

.actions{margin-top:12rpx}
.action-row{display:flex;justify-content:space-between;align-items:center;font-size:28rpx;padding:12rpx 0}
.bind-row{display:flex;justify-content:space-between;align-items:center;padding:14rpx 0;border-bottom:1rpx solid #ECE8E0}
.bind-row:last-of-type{border-bottom:1rpx solid #ECE8E0}
.bind-name{display:block;font-size:28rpx;font-weight:700;color:#202733}
.bind-class{display:block;font-size:24rpx;color:#8A929B;margin-top:2rpx}
.btn-unbind{margin:0;background:#F7EDEA;color:#9F4E43;border:none;border-radius:10rpx;padding:10rpx 18rpx;font-size:24rpx;line-height:1.4}
.arrow{font-size:32rpx;color:#C3C1BA}
.notify-card{margin-top:12rpx}
.input{border:1rpx solid #E1DDD4;border-radius:10rpx;padding:18rpx;margin:12rpx 0 16rpx;font-size:28rpx;color:#46515C}
.btn-primary{background:#202733;color:#fff;border-radius:12rpx;padding:20rpx;font-size:28rpx;text-align:center;border:none;width:100%;margin-bottom:10rpx}
.notify-row{display:flex;justify-content:space-between;align-items:center;font-size:26rpx;padding:10rpx 0;border-bottom:1rpx solid #ECE8E0;color:#46515C}
.notify-row:last-child{border-bottom:none}
.ok{color:#3F8B65;font-weight:700}
.bad{color:#B85C4E;font-weight:700}

.brand{text-align:center;color:#C3C1BA;font-size:22rpx;padding:30rpx 0 20rpx}
.empty-hint{color:#202733;font-size:32rpx}
</style>
