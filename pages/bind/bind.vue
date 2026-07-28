<template>
<view class="page">
  <view class="hero">
    <view class="hero-title-row">
      <view class="hero-mark"><pp-icon name="brand" :size="40" motion="shine" /></view>
      <view class="hero-title">绑定孩子</view>
    </view>
    <view class="hero-desc">输入老师提供的邀请码，查看孩子的学习动态</view>
  </view>

  <view class="card" v-if="!bound">
    <view v-if="repairMode" class="repair-tip"><pp-icon name="users" :size="26" /><text>当前微信曾登录教师端。输入学生邀请码后，将自动新增家长身份并切换到家长首页。</text></view>
    <view class="code-group">
      <input class="code-input" :value="code" maxlength="32" placeholder="输入邀请码" @input="code=$event.detail.value.toUpperCase()" focus />
      <view class="code-hint"><pp-icon name="message" :size="22" /><text>邀请码由孩子的老师发给您</text></view>
    </view>
    <button class="btn-primary" @tap="doBind" :disabled="code.length<6 || code.length>32 || binding">
      <pp-icon name="check" :size="28" /><text>{{ binding ? '正在绑定...' : (code.length>=6 && code.length<=32 ? '确认绑定' : '请输入完整邀请码') }}</text>
    </button>
  </view>

  <view v-if="bound" class="card result-card">
    <view class="result-icon"><view class="check-circle"><pp-icon name="check" :size="40" motion="pop" /></view></view>
    <view class="result-name">{{ bound.name }}</view>
    <view class="result-class">{{ bound.className }}</view>
    <view v-if="bound.teacher_name" class="result-teacher">来自 {{ teacherName(bound) }}</view>
    <text class="result-tip">绑定成功</text>
    <button class="btn-primary" @tap="goHome"><pp-icon name="home" :size="28" /><text>进入首页</text></button>
  </view>
</view>
</template>

<script>
import { api } from '@/utils/api';
import { doLogin, saveUser } from '@/utils/auth';
import { toastSuccess, toastError } from '@/utils/ui';
import { teacherNameFromChild } from '@/utils/brand';
export default {
  data(){return{code:'',bound:null,binding:false,repairMode:false};},
  onLoad(options){
    const code=String(options?.code||'').trim().toUpperCase();
    if(code)this.code=code.slice(0,32);
    this.repairMode=options?.source==='repair';
  },
  methods:{
    teacherName(student){return teacherNameFromChild(student);},
    async submitBinding(){
      try{
        return await api.post('/bind',{invite_code:this.code},{handleUnauthorized:false});
      }catch(e){
        if(e?.statusCode!==401)throw e;
        await doLogin();
        return api.post('/bind',{invite_code:this.code},{handleUnauthorized:false});
      }
    },
    async doBind(){
      if(this.binding||this.code.length<6||this.code.length>32)return;
      this.binding=true;
      try{
        await doLogin();
        const res=await this.submitBinding();
        if(res.role==='teacher'){
          if(!res.token||!res.user)throw new Error('教师身份签发失败，请重试');
          uni.setStorageSync('token', res.token);
          saveUser(res.user);
          toastSuccess('已成为老师');
          setTimeout(()=>uni.reLaunch({url:'/pages/index/index'}),800);
          return;
        }
        if(res.token&&res.user){
          uni.setStorageSync('token',res.token);
          saveUser(res.user);
        }
        this.bound=res.student;
        if(res.student?.id)uni.setStorageSync('activeChildId',res.student.id);
      }catch(e){toastError(e,'绑定失败，请检查邀请码');}
      finally{this.binding=false;}
    },
    goHome(){
      uni.reLaunch({url:'/pages/index/index'});
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
  --panpan-line: #CFE6D8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 52rpx 32rpx calc(42rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background-color: var(--panpan-paper);
  background-image: repeating-linear-gradient(
    0deg,
    transparent 0 63rpx,
    rgba(32, 180, 134, .055) 64rpx 65rpx
  );
}

.hero {
  width: 100%;
  max-width: 680rpx;
  margin-bottom: 24rpx;
  text-align: left;
  animation: bind-enter var(--motion-slow) var(--ease-out) both;
}
.hero-title-row { display: flex; align-items: center; gap: 13rpx; margin-bottom: 8rpx; }

.hero-mark {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  margin: 0;
  border: 2rpx solid var(--panpan-ink);
  border-radius: 14rpx;
  background: var(--panpan-sprout);
  box-shadow: 8rpx 8rpx 0 rgba(36, 48, 41, .08);
}

.hero-title {
  color: var(--panpan-ink);
  font-size: 42rpx;
  font-weight: 780;
  letter-spacing: 0;
}

.hero-desc {
  max-width: 570rpx;
  color: var(--panpan-muted);
  font-size: 25rpx;
  line-height: 1.6;
}

.card {
  width: 100%;
  max-width: 680rpx;
  box-sizing: border-box;
  padding: 30rpx;
  border: 1rpx solid var(--panpan-line);
  border-top: 7rpx solid var(--panpan-green);
  border-radius: 16rpx;
  background: #FFFFFF;
  box-shadow: 0 12rpx 28rpx rgba(36, 48, 41, .08);
  animation: bind-card-enter var(--motion-slow) 50ms var(--ease-out) both;
}

.repair-tip {
  display: flex;
  align-items: flex-start;
  gap: 9rpx;
  margin-bottom: 22rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid rgba(255, 116, 104, .42);
  border-left: 6rpx solid var(--panpan-coral);
  border-radius: 10rpx;
  background: #FFF2F0;
  color: #D94B45;
  font-size: 24rpx;
  line-height: 1.58;
}
.repair-tip text { flex: 1; min-width: 0; }

.code-group { margin-bottom: 24rpx; }

.code-input {
  width: 100%;
  height: 92rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 2rpx solid var(--panpan-line);
  border-radius: 12rpx;
  background: #F8FCF9;
  color: var(--panpan-ink);
  font-size: 34rpx;
  font-weight: 740;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  line-height: 92rpx;
  text-align: center;
  transition: border-color var(--motion-base) var(--ease-out), box-shadow var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

.code-input:focus {
  border-color: var(--panpan-green);
  background: #FFFFFF;
  box-shadow: 0 0 0 5rpx rgba(32, 180, 134, .14);
}

.code-hint { display: flex; align-items: center; justify-content: center; gap: 7rpx; margin-top: 12rpx; color: var(--panpan-muted); font-size: 22rpx; text-align: center; }
.btn-primary {
  width: 100%;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9rpx;
  margin: 0;
  border-radius: 12rpx;
  background: var(--panpan-green-strong);
  color: #FFFFFF;
  font-size: 27rpx;
  font-weight: 720;
  box-shadow: 0 9rpx 18rpx rgba(21, 148, 109, .2);
}
.btn-primary::after { border: 0; }
.btn-primary[disabled] { background: #BBDCCF; box-shadow: none; }
.result-card { text-align: center; }
.result-icon { display: flex; justify-content: center; margin-bottom: 20rpx; }

.check-circle {
  width: 88rpx;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2rpx solid var(--panpan-green);
  border-radius: 16rpx;
  background: #E7F8F1;
  color: var(--panpan-green-strong);
  animation: pop 260ms var(--ease-out);
}

.result-name { margin-bottom: 7rpx; color: var(--panpan-ink); font-size: 38rpx; font-weight: 780; }
.result-class { margin-bottom: 5rpx; color: var(--panpan-muted); font-size: 27rpx; }
.result-teacher { margin-bottom: 7rpx; color: var(--panpan-green-strong); font-size: 25rpx; }
.result-tip { display: block; margin-bottom: 26rpx; color: var(--panpan-coral); font-size: 23rpx; font-weight: 680; }

@keyframes bind-enter {
  from { opacity: 0; transform: translateY(12rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bind-card-enter {
  from { opacity: 0; transform: translateY(18rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pop {
  0% { opacity: 0; transform: scale(.86); }
  75% { transform: scale(1.04); }
  100% { opacity: 1; transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .card,
  .check-circle { animation: none; }
  .code-input { transition: none; }
}
</style>
