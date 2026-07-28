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
.maintenance-page {
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 72rpx 34rpx calc(72rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 92% 5%, rgba(244, 199, 91, .2), transparent 26%),
    radial-gradient(circle at 5% 22%, rgba(82, 124, 201, .12), transparent 28%),
    var(--page-bg);
}

.paper-card {
  width: 100%;
  box-sizing: border-box;
  padding: 54rpx 38rpx 44rpx;
  border: 1rpx solid var(--border);
  border-radius: var(--r-lg);
  background: var(--surface);
  box-shadow: var(--shadow);
  text-align: center;
  animation: maintenance-enter var(--motion-slow) var(--ease-out) both;
}

.brand-mark {
  display: inline-flex;
  padding: 8rpx 18rpx;
  border-radius: var(--r-xs);
  background: var(--primary-soft);
  color: var(--primary-strong);
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.status-dot {
  width: 116rpx;
  height: 116rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 38rpx auto 26rpx;
  border-radius: 34rpx;
  background: linear-gradient(145deg, var(--primary-soft), var(--warning-soft));
}

.dot-core {
  width: 34rpx;
  height: 34rpx;
  border: 9rpx solid var(--primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: turn 1.1s linear infinite;
}

.title {
  display: block;
  color: var(--ink);
  font-size: 42rpx;
  font-weight: 780;
  letter-spacing: -1rpx;
}

.message {
  display: block;
  margin-top: 20rpx;
  color: var(--text-secondary);
  font-size: 27rpx;
  line-height: 1.8;
}

.eta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid var(--hairline);
  border-radius: var(--r-sm);
  background: var(--surface-muted);
}

.eta-label { color: var(--text-muted); font-size: 24rpx; }
.eta-value { color: var(--primary-strong); font-size: 25rpx; font-weight: 700; }

.retry-btn {
  min-height: 96rpx;
  margin: 34rpx 0 0;
  border-radius: var(--r-sm);
  background: var(--primary-strong);
  color: #FFFFFF;
  font-size: 28rpx;
  font-weight: 700;
  box-shadow: 0 10rpx 24rpx rgba(49, 94, 168, .2);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.retry-btn:active { transform: scale(var(--tap-scale)); }
.retry-btn[disabled] { opacity: .55; box-shadow: none; }
.retry-btn::after { border: 0; }
.care { display: block; margin-top: 22rpx; color: var(--text-muted); font-size: 22rpx; }

@keyframes turn { to { transform: rotate(360deg); } }
@keyframes maintenance-enter {
  from { opacity: 0; transform: translateY(18rpx); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .paper-card { animation: none; }
  .retry-btn { transition: none; }
  .dot-core { animation-duration: 1.8s; }
}
</style>
