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
    <view class="name"><pp-icon :name="user.role==='teacher'?'pencil':'user'" :size="30" motion="pop" /><text>{{ user.role==='teacher' ? teacherDisplay : (childName||'家长') }}</text></view>
    <text class="role-tag">{{ user.role==='teacher' ? '教师端' : '家长端' }}</text>
    <text class="user-subtitle">{{ user.role==='teacher' ? '管理课程与家校反馈' : '查看孩子的学习动态' }}</text>
  </view>

  <!-- 家长：老师印象 -->
  <view class="card profile-section" v-if="user.role==='parent' && profile">
    <view class="section-title"><pp-icon name="trophy" :size="28" /><text>在老师印象中的孩子</text></view>

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
        <view class="info-label"><pp-icon name="user" :size="22" /><text>关于 TA</text></view>
        <text class="info-text">{{ profile.personality }}</text>
      </view>
      <view class="info-box">
        <view class="info-label"><pp-icon name="trophy" :size="22" /><text>学习优势</text></view>
        <text class="info-text">{{ profile.strengths }}</text>
      </view>
      <view class="info-box">
        <view class="info-label"><pp-icon name="target" :size="22" /><text>成长空间</text></view>
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
    <view class="section-title"><pp-icon name="pencil" :size="28" /><text>老师资料</text></view>
    <view class="form-field">
      <text class="field-label">老师名称</text>
      <input v-model="teacherNickname" class="input teacher-input" placeholder="例如：李老师" />
    </view>
    <view class="teacher-preview">家长将看到：{{ teacherDisplay }}</view>
    <button class="btn-primary" :disabled="savingTeacher" @tap="saveTeacherName"><pp-icon name="check" :size="28" /><text>{{ savingTeacher ? '保存中...' : '保存资料' }}</text></button>
  </view>

  <view class="card notify-card" v-if="user.role==='teacher' && notifyStatus">
    <view class="section-title"><pp-icon name="bell" :size="28" /><text>通知服务</text></view>
    <view class="service-health">
      <view :class="['service-mark',{ok:notifyHealthy}]"><pp-icon name="bell" :size="40" :motion="notifyHealthy ? 'pop' : 'ring'" /></view>
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
        <view class="section-title"><pp-icon name="lightbulb" :size="28" /><text>维护模式</text></view>
        <text class="maintenance-desc">开启后，家长进入新版小程序会看到维护页；教师端仍可使用。</text>
      </view>
      <switch :checked="Boolean(maintenanceStatus.maintenance)" color="#20B486" :disabled="savingMaintenance" @change="changeMaintenance" />
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
.page {
  --panpan-green: #20B486;
  --panpan-green-strong: #15946D;
  --panpan-sprout: #20B486;
  --panpan-coral: #FF7468;
  --panpan-leaf: #15946D;
  --panpan-paper: #F8FCF9;
  --panpan-ink: #26352F;
  --panpan-muted: #5A6A62;
  min-height: 100vh;
  padding-bottom: calc(44rpx + env(safe-area-inset-bottom));
  background: var(--panpan-paper);
}
.mine-state { margin: 110rpx 24rpx 0; border: 1rpx solid #CFE6D8; border-radius: 14rpx; background: #FFFFFF; box-shadow: 0 8rpx 20rpx rgba(36, 48, 41, .06); }

.user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 36rpx 24rpx 30rpx;
  border-bottom: 1rpx solid #D4E9DC;
  background:
    repeating-linear-gradient(0deg, transparent 0 47rpx, rgba(32, 180, 134, .055) 48rpx 49rpx),
    linear-gradient(135deg, #FFFFFF 0 72%, #E7F8F1 100%);
  animation: mine-enter var(--motion-slow) var(--ease-out) both;
}

.parent-avatar,
.teacher-avatar-fallback { margin-bottom: 8rpx; }
.teacher-avatar { width: 120rpx; height: 120rpx; border: 4rpx solid #FFFFFF; border-radius: 14rpx; box-shadow: 0 10rpx 24rpx rgba(21, 148, 109, .16); }
.name { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; color: var(--panpan-ink); font-size: 36rpx; font-weight: 770; }
.role-tag { margin-top: 8rpx; padding: 5rpx 14rpx; border: 1rpx solid rgba(32, 180, 134, .25); border-radius: 7rpx; background: #E7F8F1; color: var(--panpan-green-strong); font-size: 20rpx; font-weight: 700; letter-spacing: 0; }
.user-subtitle { margin-top: 7rpx; color: var(--panpan-muted); font-size: 23rpx; }

.card {
  margin: 14rpx 24rpx 0;
  padding: 24rpx;
  border: 1rpx solid #CFE6D8;
  border-radius: 14rpx;
  background: #FFFFFF;
  box-shadow: 0 8rpx 20rpx rgba(36, 48, 41, .06);
  animation: mine-card-enter var(--motion-slow) var(--ease-out) both;
}
.profile-section { margin-top: 18rpx; border-top: 6rpx solid var(--panpan-sprout); }
.section-title { display: flex; align-items: center; gap: 8rpx; margin-bottom: 19rpx; color: var(--panpan-ink); font-size: 29rpx; font-weight: 730; }
.character-area { display: flex; align-items: flex-start; gap: 20rpx; margin-bottom: 25rpx; }
.tag-cloud { flex: 1; display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 12rpx; }
.profile-tag { padding: 7rpx 15rpx; border-radius: 8rpx; background: #E7F8F1; color: var(--panpan-green-strong); font-size: 23rpx; font-weight: 650; }
.tag-c1,
.tag-c4 { background: #E7F8F1; color: #15946D; }
.tag-c2,
.tag-c5 { background: #E7F8F1; color: #15946D; }
.tag-c3 { background: #FFF0EE; color: #D94B45; }

.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx 18rpx; }
.info-box { padding: 13rpx 0 13rpx 15rpx; border-left: 5rpx solid var(--panpan-green); border-radius: 0; background: transparent; }
.info-box:first-child { grid-column: 1 / -1; }
.info-box:nth-child(2) { border-left-color: var(--panpan-leaf); }
.info-box:nth-child(3) { border-left-color: var(--panpan-coral); }
.info-label { display: flex; align-items: center; gap: 6rpx; margin-bottom: 7rpx; color: var(--panpan-ink); font-size: 25rpx; font-weight: 700; }
.info-text { color: #5A6A62; font-size: 25rpx; line-height: 1.64; }
.empty-hint { padding: 22rpx; color: var(--panpan-muted); font-size: 27rpx; text-align: center; }

.actions,
.notify-card { margin-top: 12rpx; }
.bind-row { min-height: 80rpx; display: flex; align-items: center; justify-content: space-between; gap: 14rpx; padding: 10rpx 0; border-bottom: 1rpx solid #E0EEE5; }
.bind-row:last-of-type { border-bottom: 1rpx solid #E0EEE5; }
.bind-copy { flex: 1; min-width: 0; }
.bind-name { display: block; color: var(--panpan-ink); font-size: 27rpx; font-weight: 700; }
.bind-class { display: block; margin-top: 2rpx; color: var(--panpan-muted); font-size: 23rpx; line-height: 1.48; }
.btn-unbind { min-height: 58rpx; margin: 0; padding: 6rpx 14rpx; border: 1rpx solid rgba(255, 116, 104, .28); border-radius: 8rpx; background: #FFF0EE; color: #D94B45; font-size: 23rpx; line-height: 1.4; transition: transform var(--motion-fast) var(--ease-out); }
.btn-unbind:active { transform: scale(var(--tap-scale)); }
.btn-unbind::after { border: 0; }

.action-row { min-height: 72rpx; display: flex; align-items: center; justify-content: space-between; padding: 7rpx 0; color: var(--panpan-ink); font-size: 27rpx; transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out); }
.action-row:active { transform: scale(var(--tap-scale)); opacity: .88; }
.action-copy { display: flex; align-items: center; gap: 14rpx; font-weight: 620; }
.action-danger { color: #D94B45; }

.form-field { margin: 20rpx 0; }
.field-label { display: block; margin-bottom: 8rpx; color: #5A6A62; font-size: 24rpx; font-weight: 680; }
.input { min-height: 84rpx; box-sizing: border-box; margin: 0; padding: 0 18rpx; border: 1rpx solid #CFE6D8; border-radius: 10rpx; background: #F8FCF9; color: var(--panpan-ink); font-size: 29rpx; line-height: 84rpx; }
.teacher-input { width: 100%; }
.teacher-preview { margin: 2rpx 0 16rpx; padding: 14rpx 16rpx; border-left: 5rpx solid var(--panpan-leaf); border-radius: 8rpx; background: #E7F8F1; color: #15946D; font-size: 25rpx; line-height: 1.55; }
.btn-primary { width: 100%; min-height: 86rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; margin: 0 0 8rpx; border-radius: 11rpx; background: var(--panpan-green-strong); color: #FFFFFF; font-size: 26rpx; font-weight: 720; box-shadow: 0 8rpx 18rpx rgba(21, 148, 109, .18); }
.btn-primary::after { border: 0; }

.service-health { display: flex; align-items: center; gap: 16rpx; padding: 14rpx 0 14rpx 16rpx; border-left: 5rpx solid var(--panpan-sprout); border-radius: 0; background: transparent; }
.service-mark { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 12rpx; background: #E7F8F1; }
.service-mark.ok { background: #E7F8F1; }
.service-copy { flex: 1; }
.service-title { display: block; color: var(--panpan-ink); font-size: 26rpx; font-weight: 680; }
.service-desc { display: block; margin-top: 3rpx; color: var(--panpan-muted); font-size: 22rpx; line-height: 1.52; }

.maintenance-head { display: flex; align-items: center; justify-content: space-between; gap: 24rpx; }
.maintenance-head > view { flex: 1; min-width: 0; }
.maintenance-desc { display: block; margin-top: 7rpx; color: var(--panpan-muted); font-size: 22rpx; line-height: 1.52; }
.maintenance-state { display: inline-flex; margin-top: 15rpx; padding: 6rpx 13rpx; border-radius: 7rpx; background: #E7F8F1; color: #15946D; font-size: 21rpx; font-weight: 680; }
.maintenance-state.active { background: #FFF0EE; color: #D94B45; }
.brand { padding: 26rpx 0 calc(16rpx + env(safe-area-inset-bottom)); color: #5A6A62; font-size: 21rpx; text-align: center; }

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
