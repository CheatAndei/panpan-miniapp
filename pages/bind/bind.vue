<template>
<view class="page">
  <view class="hero">
    <view class="hero-mark"><pp-icon name="brand" :size="104" /></view>
    <view class="hero-title">绑定孩子</view>
    <view class="hero-desc">输入老师提供的邀请码，查看孩子的学习动态</view>
  </view>

  <view class="card" v-if="!bound">
    <view v-if="repairMode" class="repair-tip">当前微信曾登录教师端。输入学生邀请码后，将自动新增家长身份并切换到家长首页。</view>
    <view class="code-group">
      <input class="code-input" :value="code" maxlength="32" placeholder="输入邀请码" @input="code=$event.detail.value.toUpperCase()" focus />
      <view class="code-hint">邀请码由孩子的老师发给您</view>
    </view>
    <button class="btn-primary" @tap="doBind" :disabled="code.length<6 || code.length>32 || binding">
      {{ binding ? '正在绑定...' : (code.length>=6 && code.length<=32 ? '确认绑定' : '请输入完整邀请码') }}
    </button>
  </view>

  <view v-if="bound" class="card result-card">
    <view class="result-icon"><view class="check-circle"><pp-icon name="check" :size="64" /></view></view>
    <view class="result-name">{{ bound.name }}</view>
    <view class="result-class">{{ bound.className }}</view>
    <view v-if="bound.teacher_name" class="result-teacher">来自 {{ teacherName(bound) }}</view>
    <text class="result-tip">绑定成功</text>
    <button class="btn-primary" @tap="goHome">进入首页</button>
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
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 88rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background:
    radial-gradient(circle at 88% 2%, rgba(244, 199, 91, .2), transparent 25%),
    radial-gradient(circle at 4% 28%, rgba(101, 191, 168, .11), transparent 28%),
    var(--page-bg);
}

.hero {
  width: 100%;
  margin-bottom: 42rpx;
  text-align: center;
  animation: bind-enter var(--motion-slow) var(--ease-out) both;
}

.hero-mark {
  width: 104rpx;
  height: 104rpx;
  margin: 0 auto 24rpx;
  filter: drop-shadow(0 14rpx 24rpx rgba(49, 94, 168, .16));
}

.hero-title {
  margin-bottom: 10rpx;
  color: var(--ink);
  font-size: 44rpx;
  font-weight: 780;
  letter-spacing: 1rpx;
}

.hero-desc {
  max-width: 500rpx;
  margin: 0 auto;
  color: var(--text-muted);
  font-size: 27rpx;
  line-height: 1.65;
}

.card {
  width: 100%;
  max-width: 680rpx;
  box-sizing: border-box;
  padding: 38rpx 32rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r);
  background: var(--surface);
  box-shadow: var(--shadow);
  animation: bind-card-enter var(--motion-slow) 50ms var(--ease-out) both;
}

.repair-tip {
  margin-bottom: 28rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid #CFE1FA;
  border-radius: var(--r-sm);
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 25rpx;
  line-height: 1.65;
}

.code-group { margin-bottom: 32rpx; }

.code-input {
  width: 100%;
  height: 108rpx;
  box-sizing: border-box;
  padding: 0 22rpx;
  border: 2rpx solid #C8D8EA;
  border-radius: var(--r-sm);
  background: var(--surface-muted);
  color: var(--ink);
  font-size: 38rpx;
  font-weight: 740;
  font-variant-numeric: tabular-nums;
  letter-spacing: 6rpx;
  line-height: 108rpx;
  text-align: center;
  transition: border-color var(--motion-base) var(--ease-out), box-shadow var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out);
}

.code-input:focus {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: 0 0 0 5rpx rgba(82, 124, 201, .12);
}

.code-hint { margin-top: 16rpx; color: var(--text-muted); font-size: 24rpx; text-align: center; }
.btn-primary { width: 100%; min-height: 96rpx; }
.btn-primary[disabled] { box-shadow: none; }
.result-card { text-align: center; }
.result-icon { display: flex; justify-content: center; margin-bottom: 24rpx; }

.check-circle {
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 30rpx;
  background: var(--success-soft);
  animation: pop 260ms var(--ease-out);
}

.result-name { margin-bottom: 8rpx; color: var(--ink); font-size: 40rpx; font-weight: 780; }
.result-class { margin-bottom: 6rpx; color: var(--text-muted); font-size: 28rpx; }
.result-teacher { margin-bottom: 8rpx; color: var(--primary-strong); font-size: 26rpx; }
.result-tip { display: block; margin-bottom: 32rpx; color: var(--success); font-size: 24rpx; }

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
