<template>
<view class="page">
  <view class="hero">
    <view class="hero-mark"><pp-icon name="brand" :size="104" /></view>
    <view class="hero-title">绑定孩子</view>
    <view class="hero-desc">输入老师提供的 6 位邀请码，查看孩子的学习动态</view>
  </view>

  <view class="card" v-if="!bound">
    <view class="code-group">
      <input class="code-input" :value="code" maxlength="6" placeholder="000000" @input="code=$event.detail.value.toUpperCase()" focus />
      <view class="code-hint">邀请码由孩子的老师发给您</view>
    </view>
    <button class="btn-primary" @tap="doBind" :disabled="code.length!==6 || binding">
      {{ binding ? '正在绑定...' : (code.length===6 ? '确认绑定' : '请输入完整邀请码') }}
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
import { doLogin } from '@/utils/auth';
import { toastSuccess, toastError } from '@/utils/ui';
import { teacherNameFromChild } from '@/utils/brand';
export default {
  data(){return{code:'',bound:null,binding:false};},
  onLoad(options){
    const code=String(options?.code||'').trim().toUpperCase();
    if(code)this.code=code.slice(0,6);
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
      if(this.binding||this.code.length!==6)return;
      this.binding=true;
      try{
        await doLogin();
        const res=await this.submitBinding();
        if(res.role==='teacher'){
          if(res.token) uni.setStorageSync('token', res.token);
          const u=JSON.parse(uni.getStorageSync('user')||'{}');
          u.role='teacher';uni.setStorageSync('user',JSON.stringify(u));
          toastSuccess('已成为老师');
          setTimeout(()=>uni.reLaunch({url:'/pages/index/index'}),800);
          return;
        }
        this.bound=res.student;
        if(res.student?.id)uni.setStorageSync('activeChildId',res.student.id);
      }catch(e){toastError(e,'绑定失败，请检查邀请码');}
      finally{this.binding=false;}
    },
    goHome(){
      uni.switchTab({url:'/pages/index/index'});
    }
  }
};
</script>

<style scoped>
.page{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:88rpx 40rpx calc(48rpx + env(safe-area-inset-bottom));background:radial-gradient(circle at 85% 0,rgba(47,125,107,.09),transparent 32%),var(--bg);box-sizing:border-box}
.hero{text-align:center;margin-bottom:42rpx;width:100%}
.hero-mark{width:104rpx;height:104rpx;margin:0 auto 24rpx;filter:drop-shadow(0 14rpx 24rpx rgba(24,58,54,.15))}
.hero-title{font-size:44rpx;font-weight:780;color:var(--ink);margin-bottom:10rpx;letter-spacing:2rpx}
.hero-desc{font-size:27rpx;color:var(--text-muted);line-height:1.65;max-width:500rpx;margin:0 auto}
.card{width:100%;max-width:680rpx;background:#fff;border-radius:26rpx;padding:38rpx 32rpx;border:1rpx solid var(--border);box-shadow:var(--shadow)}
.code-group{margin-bottom:32rpx}
.code-input{border:2rpx solid #C9DAD4;border-radius:18rpx;height:108rpx;line-height:108rpx;padding:0 8rpx 0 28rpx;font-size:48rpx;text-align:center;letter-spacing:24rpx;font-variant-numeric:tabular-nums;font-weight:740;color:var(--ink);width:100%;box-sizing:border-box;background:#FAFCFB}
.code-input:focus{border-color:var(--accent);box-shadow:0 0 0 5rpx rgba(47,125,107,.08)}
.code-hint{text-align:center;font-size:24rpx;color:var(--text-muted);margin-top:16rpx}
.btn-primary{width:100%;}
.btn-primary[disabled]{box-shadow:none}
.result-card{text-align:center}
.result-icon{margin-bottom:24rpx;display:flex;justify-content:center}
.check-circle{width:100rpx;height:100rpx;border-radius:30rpx;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;animation:pop .3s ease-out}
@keyframes pop{0%{transform:scale(0)}80%{transform:scale(1.1)}100%{transform:scale(1)}}
.result-name{font-size:40rpx;font-weight:780;color:var(--ink);margin-bottom:8rpx}
.result-class{font-size:28rpx;color:var(--text-muted);margin-bottom:6rpx}
.result-teacher{font-size:26rpx;color:var(--accent-strong);margin-bottom:8rpx}
.result-tip{font-size:24rpx;color:var(--success);display:block;margin-bottom:32rpx}
</style>
