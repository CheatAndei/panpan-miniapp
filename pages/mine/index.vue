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
        <text class="service-title">{{ notifyHealthy ? '通知配置已就绪' : '部分通知尚未配置' }}</text>
        <text class="service-desc">{{ notifyHealthy ? '实际送达仍取决于家长是否完成本次订阅' : notifyMissingText }}</text>
      </view>
    </view>
  </view>

  <view class="card actions" v-if="user.roles && user.roles.length > 1">
    <view class="action-row" @tap="switchRole(user.role==='teacher'?'parent':'teacher')">
      <view class="action-copy"><pp-icon name="users" :size="38" /><text>{{ user.role==='teacher' ? '切换到家长端' : '切换到教师端' }}</text></view>
      <pp-icon name="arrow" :size="34" />
    </view>
  </view>

  <view class="card maintenance-card" v-if="user.role==='teacher'">
    <view class="maintenance-head">
      <view>
        <text class="section-title">维护模式</text>
        <text class="maintenance-desc">开启后，家长进入新版小程序会看到维护页；教师端仍可使用。</text>
      </view>
      <switch :checked="Boolean(maintenanceStatus.maintenance)" color="#527CC9" :disabled="savingMaintenance" @change="changeMaintenance" />
    </view>
    <view :class="['maintenance-state',{active:maintenanceStatus.maintenance}]">
      {{ maintenanceStatus.maintenance ? '当前已开启' : '当前未开启' }}
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

  <view class="brand">番番记录 1.4.0<br/>桂ICP备2026013218号-2</view>
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
    loading:false,savingTeacher:false,switchingRole:false,savingMaintenance:false,
    maintenanceStatus:{maintenance:false}
  };},
  computed:{
    teacherDisplay(){return teacherDisplayName(this.teacherNickname || this.user.nickname);},
    notifyHealthy(){
      const n=this.notifyStatus;
      return Boolean(n?.appId&&n?.appSecret&&n?.templates?.checkin&&n?.templates?.checkout&&n?.templates?.reminder&&n?.templates?.feedback&&n?.templates?.homework);
    },
    notifyMissingLabels(){
      const n=this.notifyStatus||{};
      const templates=n.templates||{};
      return [
        [n.appId,'小程序 AppID'],
        [n.appSecret,'小程序密钥'],
        [templates.checkin,'签到通知'],
        [templates.checkout,'签退通知'],
        [templates.reminder,'上课提醒'],
        [templates.feedback,'课后反馈'],
        [templates.homework,'作业提醒']
      ].filter(([ready])=>!ready).map(([,label])=>label);
    },
    notifyMissingText(){
      return this.notifyMissingLabels.length
        ? `缺少：${this.notifyMissingLabels.join('、')}。请联系管理员完成配置`
        : '通知配置状态尚未加载完整，请稍后重试';
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
        if(this.user.role==='teacher')await Promise.all([this.loadNotifyStatus(),this.loadMaintenanceStatus()]);
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
    async loadMaintenanceStatus(){
      try{this.maintenanceStatus=await api.get('/system/status',null,{handleUnauthorized:false});}
      catch(e){logError('mine.maintenanceStatus',e);}
    },
    async changeMaintenance(event){
      const enabled=Boolean(event?.detail?.value);
      if(enabled){
        const confirmed=await confirmAction({
          title:'开启维护模式',
          content:'家长使用新版小程序时将无法进入业务页面。确认现在开启？',
          confirmText:'确认开启',
          danger:true
        });
        if(!confirmed){await this.loadMaintenanceStatus();return;}
      }
      this.savingMaintenance=true;
      try{
        this.maintenanceStatus=await api.put('/system/maintenance',{
          maintenance:enabled,
          title:this.maintenanceStatus.title,
          message:this.maintenanceStatus.message,
          estimated_restore_at:this.maintenanceStatus.estimated_restore_at
        });
        uni.setStorageSync('systemMaintenance',this.maintenanceStatus);
        uni.showToast({title:enabled?'维护已开启':'维护已关闭',icon:'success'});
      }catch(e){
        toastError(e,'切换失败');
        await this.loadMaintenanceStatus();
      }finally{this.savingMaintenance=false;}
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
.page { min-height: 100vh; padding-bottom: calc(44rpx + env(safe-area-inset-bottom)); background: var(--page-bg); }
.mine-state { margin: 150rpx 24rpx 0; border: 1rpx solid var(--border); border-radius: var(--r); background: var(--surface); box-shadow: var(--shadow-sm); }

.user-card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 54rpx 24rpx 44rpx;
  border-bottom: 1rpx solid var(--hairline);
  background:
    linear-gradient(rgba(82, 124, 201, .045) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(82, 124, 201, .045) 1rpx, transparent 1rpx),
    linear-gradient(150deg, #FFFFFF, var(--primary-soft));
  background-size: 40rpx 40rpx, 40rpx 40rpx, auto;
  animation: mine-enter var(--motion-slow) var(--ease-out) both;
}

.user-card::after {
  content: '';
  position: absolute;
  width: 190rpx;
  height: 190rpx;
  right: -74rpx;
  top: -94rpx;
  border-radius: 50%;
  background: rgba(244, 199, 91, .25);
}

.parent-avatar,
.teacher-avatar-fallback { margin-bottom: 8rpx; }
.teacher-avatar { width: 128rpx; height: 128rpx; border: 4rpx solid #FFFFFF; border-radius: 34rpx; box-shadow: 0 12rpx 30rpx rgba(49, 94, 168, .15); }
.name { margin-top: 16rpx; color: var(--ink); font-size: 38rpx; font-weight: 760; }
.role-tag { margin-top: 10rpx; padding: 5rpx 16rpx; border-radius: var(--r-xs); background: var(--primary-soft); color: var(--primary-strong); font-size: 21rpx; font-weight: 680; letter-spacing: 1rpx; }
.user-subtitle { margin-top: 8rpx; color: var(--text-muted); font-size: 24rpx; }

.card { animation: mine-card-enter var(--motion-slow) var(--ease-out) both; }
.profile-section { margin-top: 22rpx; padding-bottom: 32rpx; }
.section-title { display: block; margin-bottom: 24rpx; color: var(--ink); font-size: 30rpx; font-weight: 720; }
.character-area { display: flex; align-items: flex-start; gap: 24rpx; margin-bottom: 32rpx; }
.tag-cloud { flex: 1; display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 12rpx; }
.profile-tag { padding: 8rpx 18rpx; border-radius: var(--r-xs); background: var(--primary-soft); color: var(--primary-strong); font-size: 24rpx; font-weight: 620; }
.tag-c1,
.tag-c4 { background: var(--success-soft); color: var(--success); }
.tag-c2,
.tag-c5 { background: var(--warning-soft); color: var(--warning); }
.tag-c3 { background: var(--danger-soft); color: var(--danger); }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }
.info-box { padding: 24rpx; border: 1rpx solid var(--hairline); border-radius: var(--r-sm); background: var(--surface-muted); }
.info-box:first-child { grid-column: 1 / -1; }
.info-label { margin-bottom: 12rpx; color: var(--ink); font-size: 26rpx; font-weight: 700; }
.info-text { color: var(--text-secondary); font-size: 26rpx; line-height: 1.7; }
.empty-hint { padding: 30rpx; color: var(--text-muted); font-size: 28rpx; text-align: center; }

.actions,
.notify-card { margin-top: 12rpx; }
.bind-row { min-height: 92rpx; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 14rpx 0; border-bottom: 1rpx solid var(--hairline); }
.bind-row:last-of-type { border-bottom: 1rpx solid var(--hairline); }
.bind-copy { flex: 1; min-width: 0; }
.bind-name { display: block; color: var(--ink); font-size: 28rpx; font-weight: 700; }
.bind-class { display: block; margin-top: 2rpx; color: var(--text-muted); font-size: 24rpx; line-height: 1.5; }
.btn-unbind { min-height: 62rpx; margin: 0; padding: 8rpx 16rpx; border: none; border-radius: var(--r-xs); background: var(--danger-soft); color: var(--danger); font-size: 24rpx; line-height: 1.4; transition: transform var(--motion-fast) var(--ease-out); }
.btn-unbind:active { transform: scale(var(--tap-scale)); }
.btn-unbind::after { border: 0; }

.action-row { min-height: 82rpx; display: flex; align-items: center; justify-content: space-between; padding: 8rpx 0; color: var(--ink); font-size: 28rpx; transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out); }
.action-row:active { transform: scale(var(--tap-scale)); opacity: .88; }
.action-copy { display: flex; align-items: center; gap: 14rpx; font-weight: 620; }
.action-danger { color: var(--danger); }

.form-field { margin: 20rpx 0; }
.field-label { display: block; margin-bottom: 10rpx; color: var(--text-secondary); font-size: 25rpx; font-weight: 680; }
.input { min-height: 92rpx; box-sizing: border-box; margin: 0; padding: 0 24rpx; border: 1rpx solid #D6E2F1; border-radius: var(--r-sm); background: var(--surface-muted); color: var(--ink); font-size: 31rpx; line-height: 92rpx; }
.teacher-input { width: 100%; }
.teacher-preview { margin: 2rpx 0 18rpx; padding: 18rpx 20rpx; border-radius: var(--r-sm); background: var(--primary-soft); color: var(--primary-strong); font-size: 26rpx; line-height: 1.6; }
.btn-primary { width: 100%; min-height: 96rpx; margin-bottom: 10rpx; }

.service-health { display: flex; align-items: center; gap: 18rpx; padding: 20rpx; border: 1rpx solid var(--hairline); border-radius: var(--r-sm); background: var(--surface-muted); }
.service-mark { width: 70rpx; height: 70rpx; display: flex; align-items: center; justify-content: center; border-radius: 20rpx; background: var(--warning-soft); }
.service-mark.ok { background: var(--success-soft); }
.service-copy { flex: 1; }
.service-title { display: block; color: var(--ink); font-size: 27rpx; font-weight: 680; }
.service-desc { display: block; margin-top: 3rpx; color: var(--text-muted); font-size: 23rpx; line-height: 1.55; }

.maintenance-head { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; }
.maintenance-head > view { flex: 1; min-width: 0; }
.maintenance-desc { display: block; margin-top: 8rpx; color: var(--text-muted); font-size: 23rpx; line-height: 1.55; }
.maintenance-state { display: inline-flex; margin-top: 18rpx; padding: 7rpx 15rpx; border-radius: var(--r-xs); background: var(--surface-muted); color: var(--text-muted); font-size: 22rpx; font-weight: 650; }
.maintenance-state.active { background: var(--warning-soft); color: var(--warning); }
.brand { padding: 30rpx 0 calc(18rpx + env(safe-area-inset-bottom)); color: var(--faint); font-size: 22rpx; text-align: center; }

@keyframes mine-enter {
  from { opacity: 0; transform: translateY(-10rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes mine-card-enter {
  from { opacity: 0; transform: translateY(14rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 360px) {
  .character-area { align-items: center; flex-direction: column; }
  .tag-cloud { justify-content: center; }
  .info-grid { grid-template-columns: 1fr; }
  .info-box:first-child { grid-column: auto; }
}

@media (prefers-reduced-motion: reduce) {
  .user-card,
  .card { animation: none; }
  .btn-unbind,
  .action-row { transition: none; }
}
</style>
