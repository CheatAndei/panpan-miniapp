<template>
<view class="page">
  <view class="hero">
    <view class="hero-badge">邀请码</view>
    <view class="hero-title">绑定孩子</view>
    <view class="hero-desc">输入潘潘老师提供的 6 位邀请码，查看孩子的学习动态</view>
  </view>

  <view class="card" v-if="!bound">
    <view class="code-group">
      <input class="code-input" v-model="code" maxlength="6" placeholder="000000" @input="c=$event.detail.value.toUpperCase()" focus />
      <view class="code-hint">潘潘老师会通过微信发给您</view>
    </view>
    <button class="btn-primary" @tap="doBind" :disabled="code.length!==6">
      {{ code.length===6 ? '确认绑定' : '请输入完整邀请码' }}
    </button>
  </view>

  <view v-if="bound" class="card result-card">
    <view class="result-icon"><view class="check-circle"></view></view>
    <view class="result-name">{{ bound.name }}</view>
    <view class="result-class">{{ bound.className }}</view>
    <text class="result-tip">绑定成功</text>
    <button class="btn-primary" @tap="goHome">进入首页</button>
  </view>
</view>
</template>

<script>
import BASE, { ASSET_BASE } from '@/utils/config';
export default {
  data(){return{code:'',bound:null};},
  methods:{
    async doBind(){
      try{
        const t=uni.getStorageSync('token');
        const p=new Promise((resolve,reject)=>{uni.request({url:BASE+'/bind',method:'POST',data:{invite_code:this.code},header:{Authorization:`Bearer ${t}`},success(r){if(r.statusCode===200)resolve(r.data);else reject(r.data);},fail:reject});});
        const res=await p;
        if(res.role==='teacher'){
          const u=JSON.parse(uni.getStorageSync('user')||'{}');
          u.role='teacher';uni.setStorageSync('user',JSON.stringify(u));
          uni.showToast({title:'已成为老师',icon:'success'});
          setTimeout(()=>uni.reLaunch({url:'/pages/index/index'}),800);
          return;
        }
        this.bound=res.student;
      }catch(e){uni.showToast({title:(e.error||'绑定失败，请检查邀请码'),icon:'none'});}
    },
    goHome(){
      uni.switchTab({url:'/pages/index/index'});
    }
  }
};
</script>

<style scoped>
.page{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:80rpx 40rpx 0;background:#F5F6F8}
.hero{text-align:center;margin-bottom:48rpx;width:100%}
.hero-badge{display:inline-block;background:#1A365D;color:#fff;font-size:22rpx;padding:6rpx 20rpx;border-radius:20rpx;letter-spacing:4rpx;margin-bottom:20rpx}
.hero-title{font-size:44rpx;font-weight:800;color:#1A365D;margin-bottom:16rpx;letter-spacing:4rpx}
.hero-desc{font-size:28rpx;color:#718096;line-height:1.6;max-width:500rpx;margin:0 auto}
.card{width:100%;background:#fff;border-radius:16rpx;padding:40rpx 32rpx}
.code-group{margin-bottom:32rpx}
.code-input{border:2px solid #E2E8F0;border-radius:14rpx;height:100rpx;line-height:100rpx;padding:0 16rpx;font-size:52rpx;text-align:center;letter-spacing:28rpx;font-weight:700;color:#1A365D;width:100%;box-sizing:border-box;background:#F7F8FA}
.code-input:focus{border-color:#1A365D}
.code-hint{text-align:center;font-size:24rpx;color:#A0AEC0;margin-top:16rpx}
.btn-primary{background:#1A365D;color:#fff;border-radius:12rpx;padding:26rpx;font-size:32rpx;border:none;width:100%;font-weight:700}
.btn-primary[disabled]{background:#CBD5E0;color:#fff}
.result-card{text-align:center}
.result-icon{margin-bottom:24rpx;display:flex;justify-content:center}
.check-circle{width:80rpx;height:80rpx;border-radius:50%;background:#F0FFF4;position:relative;animation:pop .3s ease-out}
.check-circle::after{content:'';position:absolute;left:28rpx;top:20rpx;width:18rpx;height:34rpx;border:solid #38A169;border-width:0 4rpx 4rpx 0;transform:rotate(45deg)}
@keyframes pop{0%{transform:scale(0)}80%{transform:scale(1.1)}100%{transform:scale(1)}}
.result-name{font-size:40rpx;font-weight:800;color:#1A365D;margin-bottom:8rpx}
.result-class{font-size:28rpx;color:#718096;margin-bottom:6rpx}
.result-tip{font-size:24rpx;color:#38A169;display:block;margin-bottom:32rpx}
</style>
