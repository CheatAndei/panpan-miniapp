<template>
<view class="page">
  <view v-if="loading && !user.role" class="mine-state">
    <pp-state type="loading" title="正在读取账户信息" />
  </view>
  <view v-else-if="!user.role" class="mine-state">
    <pp-state title="还没有登录" description="登录后可查看孩子信息或管理老师资料。" action-text="前往登录" @action="goLogin" />
  </view>
  <template v-else>
  <!-- 用户卡片 -->
  <view class="user-card hero-navy">
    <pp-avatar v-if="user.role==='parent'" :name="studentName" :size="128" class="parent-avatar" />
    <image v-else-if="user.avatar_url && !teacherAvatarBroken" :src="user.avatar_url" class="teacher-avatar" mode="aspectFill" @error="teacherAvatarBroken=true" />
    <pp-avatar v-else :name="teacherDisplay" :size="128" class="teacher-avatar-fallback" />
    <text class="name">{{ user.role==='teacher' ? teacherDisplay : (childName||'家长') }}</text>
    <text class="role-tag">{{ user.role==='teacher' ? '教师端' : '家长端' }}</text>
    <text class="user-subtitle">{{ user.role==='teacher' ? '管理课程与家校反馈' : '查看孩子的学习动态' }}</text>
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
      <pp-avatar :name="kid.name" :size="76" />
      <view class="bind-copy">
        <text class="bind-name">{{ kid.name }}</text>
        <text class="bind-class">{{ kid.className || '已绑定学生' }} · {{ teacherName(kid) }}</text>
      </view>
      <button class="btn-unbind" @tap.stop="unbind(kid)">解除绑定</button>
    </view>
    <view class="action-row" @tap="nav('/pages/bind/bind')">
      <view class="action-copy"><pp-icon name="plus" :size="38" /><text>绑定其他孩子</text></view>
      <pp-icon name="arrow" :size="34" />
    </view>
  </view>

  <view class="card notify-card" v-if="user.role==='teacher' && notifyStatus">
    <text class="section-title">老师资料</text>
    <view class="form-field">
      <text class="field-label">老师名称</text>
      <input v-model="teacherNickname" class="input teacher-input" placeholder="例如：李老师" />
    </view>
    <view class="teacher-preview">家长将看到：{{ teacherDisplay }}</view>
    <button class="btn-primary" :disabled="savingTeacher" @tap="saveTeacherName">{{ savingTeacher ? '保存中...' : '保存资料' }}</button>
  </view>

  <view class="card notify-card" v-if="user.role==='teacher' && notifyStatus">
    <text class="section-title">通知服务</text>
    <view class="service-health">
      <view :class="['service-mark',{ok:notifyHealthy}]"><pp-icon name="bell" :size="42" /></view>
      <view class="service-copy">
        <text class="service-title">{{ notifyHealthy ? '通知服务运行正常' : '部分通知尚未配置' }}</text>
        <text class="service-desc">{{ notifyHealthy ? '签到、签退与反馈提醒均已开启' : '如需使用通知，请联系管理员完成配置' }}</text>
      </view>
    </view>
  </view>

  <view class="card actions" v-if="user.roles && user.roles.length > 1">
    <view class="action-row" @tap="switchRole(user.role==='teacher'?'parent':'teacher')">
      <view class="action-copy"><pp-icon name="users" :size="38" /><text>{{ user.role==='teacher' ? '切换到家长端' : '切换到教师端' }}</text></view>
      <pp-icon name="arrow" :size="34" />
    </view>
  </view>

  <view class="card actions" v-if="user.role==='teacher' && (!user.roles || !user.roles.includes('parent'))">
    <view class="action-row" @tap="nav('/pages/bind/bind?source=repair')">
      <view class="action-copy"><pp-icon name="users" :size="38" /><text>绑定学生并切换到家长端</text></view>
      <pp-icon name="arrow" :size="34" />
    </view>
  </view>

  <view class="card actions">
    <view class="action-row" @tap="logout">
      <view class="action-copy action-danger"><pp-icon name="user" :size="38" /><text>退出登录</text></view>
      <pp-icon name="arrow" :size="34" />
    </view>
  </view>

  <view class="brand">番番记录 1.2.1<br/>桂ICP备2026013218号-2</view>
  </template>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { getUser, saveUser } from '@/utils/auth';
import { confirmAction, logError, toastError } from '@/utils/ui';
import { teacherDisplayName } from '@/utils/brand';
export default {
  data(){return{
    user:{},profile:null,childName:'',studentName:'',notifyStatus:null,teacherNickname:'',boundKids:[],teacherAvatarBroken:false,
    loading:false,savingTeacher:false,switchingRole:false
  };},
  computed:{
    teacherDisplay(){return teacherDisplayName(this.teacherNickname || this.user.nickname);},
    notifyHealthy(){
      const n=this.notifyStatus;
      return Boolean(n?.appId&&n?.appSecret&&n?.templates?.checkin&&n?.templates?.checkout&&n?.templates?.feedback);
    }
  },
  onShow(){this.loadData();},
  async onPullDownRefresh(){try{await this.loadData();}finally{uni.stopPullDownRefresh();}},
  methods:{
    async loadData(){
      if(this.loading)return;
      this.loading=true;
      this.user=getUser()||{};
      try{
        if(this.user.role)await this.loadAccountProfile();
        if(this.user.role==='parent'){
          await this.loadBoundKids();
          await this.loadProfile();
        }
        if(this.user.role==='teacher')await this.loadNotifyStatus();
      }finally{this.loading=false;}
    },
    teacherName(kid){return teacherDisplayName(kid?.teacher_name,'孩子的老师');},
    async loadAccountProfile(){
      try{
        const data=await api.get('/auth/me');
        if(data.user){this.user=saveUser({...this.user,...data.user});this.teacherNickname=data.user.nickname||'';}
      }catch(e){logError('mine.accountProfile',e);}
    },
    async saveTeacherName(){
      const nickname=(this.teacherNickname||'').trim();
      if(!nickname)return uni.showToast({title:'请填写称呼',icon:'none'});
      if(this.savingTeacher)return;
      this.savingTeacher=true;
      try{
        const data=await api.put('/auth/me',{nickname,avatar_url:this.user.avatar_url||''});
        this.user=saveUser({...this.user,...data.user});
        uni.showToast({title:'已保存',icon:'success'});
      }catch(e){toastError(e,'保存失败');}
      finally{this.savingTeacher=false;}
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
        const activeKid=(this.boundKids||[]).find(k=>String(k.id)===String(cid));
        if(activeKid?.teacher_name)this.childName=(s?.name||activeKid.name||'孩子')+'家长 · '+teacherDisplayName(activeKid.teacher_name);
      }catch(e){logError('mine.loadProfile',e);}
    },
    async loadBoundKids(){
      try{const data=await api.get('/bind/students');this.boundKids=data.students||[];}
      catch(e){logError('mine.boundKids',e);}
    },
    async unbind(kid){
      const confirmed=await confirmAction({title:'解除绑定',content:'确定解除和 '+kid.name+' 的绑定？之后仍可用邀请码重新绑定。',confirmText:'解除',danger:true});
      if(!confirmed)return;
      try{
        await api.del('/bind/'+kid.id);
        if(String(uni.getStorageSync('activeChildId')||'')===String(kid.id))uni.removeStorageSync('activeChildId');
        uni.showToast({title:'已解除绑定',icon:'success'});
        await this.loadData();
      }catch(e){toastError(e,'解除失败');}
    },
    goLogin(){uni.switchTab({url:'/pages/index/index'});},
    nav(url){uni.navigateTo({url});},
    tagColor(i){const cs=['tag-c0','tag-c1','tag-c2','tag-c3','tag-c4','tag-c5'];return cs[i%cs.length];},
    async switchRole(role){
      if(this.switchingRole)return;
      this.switchingRole=true;
      try{
        const data=await api.post('/auth/switch-role',{role});
        if(!data?.token||!data?.user)throw new Error('身份切换结果不完整');
        uni.setStorageSync('token',data.token);
        this.user=saveUser(data.user);
        uni.reLaunch({url:'/pages/index/index'});
      }catch(e){toastError(e,'身份切换失败');}
      finally{this.switchingRole=false;}
    },
    async logout(){
      const confirmed=await confirmAction({title:'退出登录',content:'退出后需要重新使用微信登录。',confirmText:'退出'});
      if(confirmed){uni.clearStorageSync();uni.reLaunch({url:'/pages/index/index'});}
    }
  }
};
</script>

<style scoped>
.page{padding-bottom:60rpx}
.user-card{display:flex;flex-direction:column;align-items:center;padding:56rpx 0 44rpx}
.parent-avatar{margin-bottom:8rpx}
.teacher-avatar{width:120rpx;height:120rpx;border-radius:50%;box-shadow:0 4rpx 14rpx rgba(36,42,50,.10),inset 0 0 0 2rpx rgba(255,255,255,.7)}
.teacher-avatar-fallback{margin-bottom:8rpx}
.name{font-size:36rpx;font-weight:700;color:#183A36;margin-top:16rpx}
.role-tag{font-size:22rpx;background:#EDF5F2;color:#697B76;padding:6rpx 18rpx;border-radius:20rpx;margin-top:10rpx;letter-spacing:1rpx}

.profile-section{padding-bottom:32rpx}
.section-title{font-size:30rpx;font-weight:700;color:#183A36;margin-bottom:24rpx}

/* 人物 + 标签（去掉旋转动画，改为清晰的静态布局） */
.character-area{display:flex;flex-direction:column;align-items:center;gap:24rpx;margin-bottom:32rpx}
.tag-cloud{display:flex;flex-wrap:wrap;justify-content:center;gap:12rpx}
.profile-tag{font-size:24rpx;padding:8rpx 20rpx;border-radius:24rpx;font-weight:600}
.tag-c0{background:#EDF5F2;color:#183A36}.tag-c1{background:#EEF7F3;color:#3F7167}
.tag-c2{background:#EDF4F2;color:#52756F}.tag-c3{background:#EEF7F3;color:#2F6E61}
.tag-c4{background:#E8F4F0;color:#2F735F}.tag-c5{background:#E9F0ED;color:#536762}

/* 三个信息框 */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}
.info-box{background:#F7FAF8;border-radius:14rpx;padding:24rpx}
.info-box:first-child{grid-column:1/-1}
.info-label{font-size:26rpx;font-weight:700;color:#183A36;margin-bottom:12rpx}
.info-text{font-size:26rpx;line-height:1.7;color:#536762}

.empty-hint{text-align:center;color:#A4B1AD;padding:30rpx;font-size:28rpx}

.actions{margin-top:12rpx}
.action-row{display:flex;justify-content:space-between;align-items:center;font-size:28rpx;padding:12rpx 0}
.bind-row{display:flex;justify-content:space-between;align-items:center;padding:14rpx 0;border-bottom:1rpx solid #E5EEEB}
.bind-row:last-of-type{border-bottom:1rpx solid #E5EEEB}
.bind-name{display:block;font-size:28rpx;font-weight:700;color:#183A36}
.bind-class{display:block;font-size:24rpx;color:#7C8C87;margin-top:2rpx}
.btn-unbind{margin:0;background:#FCEEEB;color:#A94F48;border:none;border-radius:10rpx;padding:10rpx 18rpx;font-size:24rpx;line-height:1.4}
.arrow{font-size:32rpx;color:#A4B1AD}
.notify-card{margin-top:12rpx}
.form-field{margin:18rpx 0 22rpx}
.field-label{display:block;font-size:27rpx;font-weight:700;color:#183A36;margin-bottom:10rpx}
.input{border:1rpx solid #D5E3DE;border-radius:16rpx;padding:0 24rpx;margin:0;font-size:31rpx;color:#536762;min-height:92rpx;line-height:92rpx;background:#F8FBFA;box-sizing:border-box}
.teacher-input{width:100%}
.teacher-preview{font-size:26rpx;color:#2F6E61;background:#F7FAF8;border-radius:14rpx;padding:18rpx 20rpx;margin:2rpx 0 18rpx;line-height:1.6}
.btn-primary{background:#183A36;color:#fff;border-radius:14rpx;padding:24rpx;font-size:30rpx;text-align:center;border:none;width:100%;margin-bottom:10rpx}
.notify-row{display:flex;justify-content:space-between;align-items:center;font-size:26rpx;padding:10rpx 0;border-bottom:1rpx solid #E5EEEB;color:#536762}
.notify-row:last-child{border-bottom:none}
.ok{color:#2F7D6B;font-weight:700}
.bad{color:#C75D54;font-weight:700}

.brand{text-align:center;color:#A4B1AD;font-size:22rpx;padding:30rpx 0 20rpx}
.empty-hint{color:#183A36;font-size:32rpx}
</style>

<style scoped>
.page { padding-bottom: calc(44rpx + env(safe-area-inset-bottom)); }
.mine-state { margin: 150rpx 24rpx 0; border-radius: 24rpx; background: #FFFFFF; border: 1rpx solid var(--border); box-shadow: var(--shadow-sm); }
.user-card { padding: 52rpx 0 42rpx; background: linear-gradient(150deg,#F9FCFB 0%,#E9F4F0 100%); }
.teacher-avatar { width: 128rpx; height: 128rpx; border-radius: 34rpx; box-shadow: 0 12rpx 30rpx rgba(24,58,54,.13); }
.name { color: var(--ink); font-size: 38rpx; font-weight: 760; }
.role-tag { padding: 5rpx 16rpx; border-radius: 9rpx; background: var(--accent-soft); color: var(--accent-strong); font-size: 21rpx; font-weight: 650; }
.user-subtitle { margin-top: 8rpx; color: var(--text-muted); font-size: 24rpx; }
.section-title { color: var(--ink); font-size: 30rpx; }

.profile-section { margin-top: 22rpx; }
.character-area { align-items: flex-start; flex-direction: row; }
.tag-cloud { justify-content: flex-start; flex: 1; }
.profile-tag { border-radius: 11rpx; background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }
.info-box { border-radius: 18rpx; background: var(--surface-muted); }
.info-label { color: var(--ink); }
.info-text { color: var(--text-secondary); }

.bind-row { min-height: 92rpx; gap: 16rpx; border-color: var(--hairline); }
.bind-copy { flex: 1; min-width: 0; }
.bind-name { color: var(--ink); }
.bind-class { color: var(--text-muted); }
.btn-unbind { min-height: 58rpx; padding: 8rpx 16rpx; background: var(--danger-soft); color: var(--danger); border-radius: 11rpx; }
.action-row { min-height: 76rpx; padding: 8rpx 0; color: var(--ink); }
.action-copy { display: flex; align-items: center; gap: 14rpx; font-weight: 620; }
.action-danger { color: var(--danger); }

.form-field { margin: 20rpx 0; }
.field-label { color: var(--text-secondary); font-size: 25rpx; }
.teacher-preview { color: var(--accent-strong); background: var(--accent-soft); border-radius: 14rpx; }
.service-health { display: flex; align-items: center; gap: 18rpx; padding: 20rpx; border-radius: 18rpx; background: var(--surface-muted); }
.service-mark { width: 70rpx; height: 70rpx; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; background: var(--warning-soft); }
.service-mark.ok { background: var(--accent-soft); }
.service-copy { flex: 1; }
.service-title { display: block; color: var(--ink); font-size: 27rpx; font-weight: 680; }
.service-desc { display: block; margin-top: 3rpx; color: var(--text-muted); font-size: 23rpx; line-height: 1.55; }
.brand { color: var(--faint); padding-bottom: calc(18rpx + env(safe-area-inset-bottom)); }
</style>
