<template>
  <view class="maintenance-page">
    <view class="paper-card">
      <view class="brand-mark">番番记录</view>
      <view class="status-dot"><view class="dot-core" /></view>
      <text class="title">{{ status.title || '系统升级维护中' }}</text>
      <text class="message">{{ status.message || defaultMessage }}</text>
      <view v-if="status.estimated_restore_at" class="eta">
        <text class="eta-label">预计恢复</text>
        <text class="eta-value">{{ status.estimated_restore_at }}</text>
      </view>
      <button class="retry-btn" :disabled="checking" @tap="checkStatus">
        {{ checking ? '正在检查...' : '检查是否恢复' }}
      </button>
      <text class="care">学习记录已妥善保存，请放心。</text>
    </view>
  </view>
</template>

<script>
import { api } from '@/utils/api';

export default {
  data() {
    return {
      checking: false,
      status: uni.getStorageSync('systemMaintenance') || {},
      defaultMessage: '正在升级题库、批改和反馈功能，数据已安全备份。完成后即可正常使用，请稍后再试。',
    };
  },
  onShow() { this.checkStatus(); },
  methods: {
    async checkStatus() {
      if (this.checking) return;
      this.checking = true;
      try {
        this.status = await api.get('/system/status', null, { handleUnauthorized: false, timeout: 6000 });
        uni.setStorageSync('systemMaintenance', this.status);
        if (!this.status.maintenance) {
          uni.reLaunch({ url: '/pages/index/index' });
        }
      } catch (error) {
        uni.showToast({ title: '暂时无法连接，请稍后重试', icon: 'none' });
      } finally {
        this.checking = false;
      }
    },
  },
};
</script>

<style scoped>
.maintenance-page{min-height:100vh;box-sizing:border-box;display:flex;align-items:center;padding:72rpx 34rpx calc(72rpx + env(safe-area-inset-bottom));background:radial-gradient(circle at 15% 10%,rgba(47,125,107,.12),transparent 34%),#F6F0E4}
.paper-card{width:100%;box-sizing:border-box;padding:54rpx 38rpx 44rpx;border:1rpx solid rgba(103,125,116,.18);border-radius:34rpx;background:rgba(255,253,248,.94);box-shadow:0 28rpx 72rpx rgba(67,74,63,.12);text-align:center}
.brand-mark{display:inline-flex;padding:8rpx 18rpx;border-radius:999rpx;background:#E6F1ED;color:#2F6E61;font-size:22rpx;font-weight:700;letter-spacing:2rpx}
.status-dot{width:116rpx;height:116rpx;display:flex;align-items:center;justify-content:center;margin:38rpx auto 26rpx;border-radius:34rpx;background:#E6F1ED}
.dot-core{width:34rpx;height:34rpx;border:9rpx solid #2F7D6B;border-top-color:transparent;border-radius:50%;animation:turn 1.1s linear infinite}
.title{display:block;color:#183A36;font-size:42rpx;font-weight:780;letter-spacing:-1rpx}
.message{display:block;margin-top:20rpx;color:#61716B;font-size:27rpx;line-height:1.8}
.eta{display:flex;justify-content:space-between;align-items:center;margin-top:28rpx;padding:20rpx 22rpx;border-radius:18rpx;background:#F2F6F3}
.eta-label{color:#7A8984;font-size:24rpx}.eta-value{color:#264F48;font-size:25rpx;font-weight:700}
.retry-btn{min-height:90rpx;margin:34rpx 0 0;border-radius:16rpx;background:#183A36;color:#fff;font-size:28rpx;font-weight:700}
.retry-btn[disabled]{opacity:.55}.retry-btn::after{border:0}
.care{display:block;margin-top:22rpx;color:#8A9691;font-size:22rpx}
@keyframes turn{to{transform:rotate(360deg)}}
</style>
